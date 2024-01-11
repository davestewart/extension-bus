import { Bus, BusFactory, BusOptions, BusRequest, BusResponse, Handler, Handlers } from './types'

/**
 * Resolve a nested handler by path
*/
function getHandler (input: Handlers<Handler>, path = ''): Handler | void {
  const segments = path.split(/[/.]/)
  let output: Handlers<Handler> | Handler = input
  while (segments.length > 0) {
    const segment = segments.shift()
    if (segment) {
      const target: Handler | Handlers<Handler> = output[segment]
      if (typeof target === 'function') {
        if (segments.length === 0) {
          return target.bind(target)
        }
      }
      else {
        output = target
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
  // parameters
  // -------------------------------------------------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------------------------------------------------
  // setup
  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Handle requests
   *
   * @param request       Information passed from source bus
   * @param sender        The message sender
   * @param sendResponse  A callback to send a response
   */
  const handleRequest = (request: BusRequest, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    const { target, path, data } = request || {}
    // request matches target...
    if (target === '*' || target === source) {
      // resolve handler
      const handler = getHandler(handlers, path)

      // if we have a handler...
      if (handler && typeof handler === 'function') {
        // setup send
        const send = (data: Record<string, any>) => {
          sendResponse({ target: source, ...data })
        }
        const handleError = (error: any) => {
          send({ error: 'message' in error ? error.message : 'unknown' })
          throw(error)
        }

        // execute handler
        try {
          // get the result
          const result = handler(data, sender, sender.tab)

          // if handler is async, send when done
          if (result instanceof Promise) {
            // handle success
            result
              .then(result => send({ result }))

              // catch async error
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
    }
  }

  /**
   * Generalised response handler (runtime or tabs)
   *
   * @param response  The response data sent by the bus at the scripting target
   * @param request   The original request sent by the source bus
   * @param resolve   The promise resolve function
   * @param reject    The promise reject function
   */
  const handleResponse = function (response: BusResponse, request: BusRequest, resolve: (response: any) => void, reject: (reason: any) => void) {
    // error handler
    const handleError = (error: string, message = '') => {
      // set error
      bus.error = error

      // manually handle errors
      if (typeof onError === 'function') {
        onError.call(null, request, response)
        return resolve(null)
      }

      // otherwise, warn and maybe reject
      if (onError) {
        console.warn(`bus[${source}] error "${error}" ${message}`)
      }
      if (onError === 'reject') {
        return reject(new Error(error))
      }

      // resolve null
      resolve(null)
    }

    // handle chrome error
    if (chrome.runtime.lastError) {
      const message = chrome.runtime.lastError?.message || ''
      let error = message

      // The message port closed before a response was received.
      if (message.includes('message port closed')) {
        error = 'no handler'
      }

      // 'Could not establish connection. Receiving end does not exist.'
      else if (message.includes('does not exist')) {
        error = 'no target'
      }

      // firefox runtime error
      else if (response) {
        response = {
          error
        }
      }

      // pass error to handling function
      if (error) {
        return handleError(error, `for "${request.target}:${request.path}"`)
      }
    }

    // handle no response (firefox won't send a result if target throws)
    if (!response) {
      response = { error: 'unknown' }
    }

    // handle response
    const { result, error } = response
    return error
      ? handleError('runtime error', `at "${request.target}:${request.path}": "${error}"`)
      : resolve(result)
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

  // build output object
  const bus = {
    source,
    target,
    error: '',
    call,
    handlers,
    assign (newHandlers: Handlers<Handler>) {
      Object.assign(handlers, newHandlers)
      return bus
    },
  }

  // return
  return bus
}

export type * from './types'
