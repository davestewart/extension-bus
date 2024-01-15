import { Bus, BusErrorType, BusFactory, BusOptions, BusRequest, BusResponse, Handler, Handlers } from './types'

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

      // if we have a handler...
      if (handler && typeof handler === 'function') {
        // setup error
        const handleError = (error: any) => {
          // send error to calling process
          send({
            error: {
              type: 'handler_error',
              message: String(error) || 'Error',
            },
          })

          // log error locally
          console.warn(error)
        }

        // execute handler
        try {
          // get the result
          const result = handler(data, sender)

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
        return send({ error: { type: 'no_handler' } })
      }
    }
  }

  /**
   * Handle response from target
   *
   * Generalised for runtime or tab request
   *
   * @param response  The response data sent by the bus at the scripting target
   * @param request   The original request sent by the source bus
   * @param resolve   The promise resolve function
   * @param reject    The promise reject function
   */
  const handleResponse = function (response: BusResponse, request: BusRequest, resolve: (response: any) => void, reject: (reason: any) => void) {
    // variables
    const chromeError = chrome.runtime.lastError?.message || ''

    // handle chrome / messaging error
    if (chromeError || !response || response.error) {
      // initial type
      let type: BusErrorType = response?.error?.type || 'no_response'
      let message = response?.error?.message || chromeError || ''

      // set error
      bus.error = {
        type,
        message,
      }

      // manually handle errors
      if (typeof onError === 'function') {
        onError.call(null, request, response, bus)
        return resolve(null)
      }

      // otherwise, warn
      if (onError) {
        // variables
        const path = `"${request.target}:${request.path}"`

        // unless "no_response" (as a target not existing is not an "error" per se)
        if (type !== 'no_response') {
          console.warn(`bus[${source}] error "${message}" at ${path}`)
        }
      }

      // finally, reject or resolve
      return onError === 'reject'
        ? reject(new Error(type))
        : resolve(null)
    }

    // handle response
    return resolve(response.result)
  }

  // -------------------------------------------------------------------------------------------------------------------
  // api
  // -------------------------------------------------------------------------------------------------------------------

  function call (tabId: number, path: string, data?: any): Promise<any>
  function call (path: string, data?: any): Promise<any>
  function call (tabIdOrPath: number | string, pathOrData?: string | any, data?: any): Promise<any> {
    // reset error
    bus.error = null

    // build request
    const request = typeof tabIdOrPath === 'number'
      ? makeRequest(source, '*', pathOrData, data)
      : makeRequest(source, target, tabIdOrPath, pathOrData)

    // make call
    return new Promise((resolve, reject) => {
      const callback = (response: BusResponse) => handleResponse(response, request, resolve, reject)
      return typeof tabIdOrPath === 'number'
        ? chrome.tabs.sendMessage(tabIdOrPath, request, callback)
        : chrome.runtime.sendMessage(request, callback)
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
  const bus: Bus = {
    source,
    target,
    handlers,
    call,
    add (name: string, newHandlers: Handlers) {
      handlers[name] = newHandlers
      return bus
    },
    error: null,
  }

  // return
  return bus
}

export type * from './types'
