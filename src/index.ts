import { Bus, BusFactory, BusOptions, BusRequest, BusResponse, Handler, Handlers } from './types'

/**
 * Resolve a nested handler by path
*/
function getHandler (input: Handlers, path = ''): Handler | void {
  const segments = path.split(/[/.]/)
  let parent: Handlers | Handler = input
  while (segments.length > 0) {
    const segment = segments.shift()
    if (segment) {
      const child: Handler | Handlers = parent[segment]
      if (typeof child === 'function') {
        if (segments.length === 0) {
          return child.bind(parent)
        }
      }
      else {
        parent = child
      }
    }
  }
  return
}

/**
 * Create a request object
 */
function makeRequest (source: string, target: string, path: string, data: any): BusRequest {
  // parse target and path
  const [_target, _path] = path.includes(':')
    ? path.split(':')
    : [undefined, path]

  // request object for call
  return {
    source,
    target: _target || target,
    path: _path,
    data,
  }
}

/**
 * Make a universal chrome messaging bus
 *
 * @param   source    The name of this messaging bus, i.e. "content", "background", "account"
 * @param   options   Optional bus configuration options, including handlers
 */
export const makeBus: BusFactory = (source: string, options: BusOptions = {}): Bus => {

  // -------------------------------------------------------------------------------------------------------------------
  // handlers
  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Handle request from source
   *
   * @param request       Request data from source bus
   * @param sender        The message sender / owning process
   * @param sendResponse  A callback to send a response
   */
  const handleRequest = (request: BusRequest, sender: chrome.runtime.MessageSender, sendResponse: (response?: BusResponse) => void) => {
    const { target, path, data } = request || {}
    // request matches target...
    if (target === source || target === '*') {
      // resolve handler
      const handler = getHandler(handlers, path)

      // setup send
      const send = (data: Record<string, any>) => {
        sendResponse({ target: source, ...data })
      }

      // setup error
      const handleError = (error: any) => {
        // send error to calling process
        send({
          error: 'message' in error
            ? error.message
            : 'unknown'
        })

        // log error locally
        console.warn(error)
      }

      // if we have a handler...
      if (handler && typeof handler === 'function') {
        // execute handler
        try {
          // get the result
          const result = handler(data, sender, sender.tab)

          // if handler is async, send when done
          if (result instanceof Promise) {
            // handle success / error
            result
              .then(result => send({ result }))
              .catch(handleError)

            // tell chrome handler is async
            return true
          }

          // if handler is sync, send now
          send({ result })
        }

          // catch sync error
        catch (error) {
          handleError(error)
        }
      }

      // reached named target, but no handler
      if (target === source) {
        return send({ error: 'no handler' })
      }
    }
  }

  /**
   * Handle response to source
   *
   * Generalised for runtime or tab request
   *
   * @param response  The response data sent by the bus at the scripting target
   * @param request   The original request sent by the source bus
   * @param resolve   The promise resolve function
   * @param reject    The promise reject function
   */
  const handleResponse = function (response: BusResponse, request: BusRequest, resolve: (response: any) => void, reject: (reason: any) => void) {
    // error handler
    const handleError = (error: string, message = '', location = '') => {
      // set error
      bus.error = error

      // TODO
      // change error from string message to { type: 'no response', message: 'chrome issue' }

      // manually handle errors
      if (typeof onError === 'function') {
        onError.call(null, request, response)
        return resolve(null)
      }

      // otherwise, warn...
      if (onError) {
        // unless "no target" – as a target not existing is not strictly an error
        if (error !== 'no target') {
          console.warn(`bus[${source}] error "${error}" ${message}`)
        }
      }

      // ...or reject
      if (onError === 'reject') {
        return reject(new Error(error))
      }

      // resolve null
      resolve(null)
    }

    // handle chrome / messaging error
    if (!response || chrome.runtime.lastError || response.error === 'no handler') {
      const message = chrome.runtime.lastError?.message || response.error || ''
      let error = message

      // firefox no target
      if (!response && !error) {
        error = 'no response'
      }

      // Could not establish connection. Receiving end does not exist.
      else if (message.includes('does not exist')) {
        error = 'no response'
      }

      // The message port closed before a response was received.
      else if (message.includes('message port closed')) {
        // all listeners were called, but none were matched
        error = 'no response'
      }

      // pass error to handling function
      if (error) {
        return handleError(error, `for "${request.target}:${request.path}"`)
      }
    }

    // handle response
    return response.error
      ? handleError('handler error', `at "${request.target}:${request.path}": "${response.error}"`)
      : resolve(response.result)
  }

  // -------------------------------------------------------------------------------------------------------------------
  // api
  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Send message to scripting targets
   *
   * @param tabId The tab id of a content script to target
   * @param path  The path of the handler to call
   * @param data  Optional data to pass to the handler
   */
  function call (tabId: number, path: string, data?: any): Promise<any>
  function call (path: string, data?: any): Promise<any>
  function call (tabIdOrPath: number | string, pathOrData?: string | any, data?: any): Promise<any> {
    // handle calls to tabs
    if (typeof tabIdOrPath === 'number') {
      return callTab(tabIdOrPath, pathOrData, data)
    }

    // reset error
    bus.error = ''

    // make request
    const request = makeRequest(source, target, tabIdOrPath, pathOrData)
    return new Promise((resolve, reject) => {
      return chrome.runtime.sendMessage(request, response => handleResponse(response, request, resolve, reject))
    })
  }

  /**
   * Send message to content script tab
   *
   * @param tabId The tab id of a content script to target
   * @param path  The path of the handler to call
   * @param data  Optional data to pass to the handler
   */
  function callTab (tabId: number, path: string, data?: any ): Promise<any> {
    // reset error
    bus.error = ''

    // make request
    const request = makeRequest(source, '*', path, data)
    return new Promise((resolve, reject) => {
      return chrome.tabs.sendMessage(tabId, request, response => handleResponse(response, request, resolve, reject))
    })
  }

  // -------------------------------------------------------------------------------------------------------------------
  // setup
  // -------------------------------------------------------------------------------------------------------------------

  // add listener for incoming messages
  chrome.runtime.onMessage.addListener(handleRequest)

  // parameters
  const {
    /**
     * A block of handlers, or nested handlers
     */
    handlers = {},

    /**
     * How to handle errors
     */
    onError = 'warn',

    /**
     * The name of a target bus
     */
    target = '*',
  } = options

  // bus
  const bus = {
    source,
    target,
    handlers,
    call,
    add (name: string, newHandlers: Handlers) {
      handlers[name] = newHandlers
      return bus
    },
    error: '',
  }

  // return
  return bus
}

export type * from './types'
