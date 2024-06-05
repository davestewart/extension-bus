import {
  Bus,
  BusErrorCode,
  BusFactory,
  BusOptions,
  BusRequest,
  BusResponse,
  BusResponseError,
  Handler,
  Handlers,
} from './types'

/**
 * Resolve a nested handler by path
 */
export function getHandler (input: Handlers, path = ''): Handler | void {
  const segments = path.split('/')
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
 * Create a response object
 */
function makeResponse (target: string, payload: { error: BusResponseError } | { result: any }): BusResponse {
  return { target, ...payload }
}

/**
 * Make a universal chrome messaging bus
 *
 * @param   source    The name of this messaging bus, i.e. "content", "background", "account"
 * @param   options   Optional bus configuration options, including handlers
 */
export const makeBus: BusFactory = (source: string, options: BusOptions = {}): Bus => {

  // -------------------------------------------------------------------------------------------------------------------
  // core
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
      const send = (data: { result: any } | { error: BusResponseError }) => {
        sendResponse(makeResponse(source, data))
      }

      // if we have a handler...
      if (handler && typeof handler === 'function') {
        // setup error
        const handleError = (error: any) => {
          // build error
          const data = error instanceof Error
            ? { message: error.message, type: error.name }
            : { message: error }

          // send to calling process
          send({
            error: { code: 'handler_error', ...data }
          })

          // log locally
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
        return send({ error: { code: 'no_handler', message: `No handler` } })
      }
    }
  }

  const handleExternalRequest = (request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: BusResponse) => void) => {
    if (request && typeof request === 'object' && 'path' in request) {
      // variables
      const path = request.path
      const external = options.external

      // filter
      if (typeof path === 'string') {
        // only valid paths
        if (Array.isArray(external)) {
          if (!external.some(p => {
            const rx = new RegExp(`^${p.replace(/\*/g, '.+?')}$`)
            return rx.test(path)
          })) {
            return sendResponse()
          }
        }

        // predicate function
        if (typeof external === 'function') {
          if (!external(path, sender)) {
            return sendResponse()
          }
        }

        // handle
        return handleRequest({ source: 'external', target: '*', ...request }, sender, sendResponse)
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
      // error variables
      const code: BusErrorCode = response?.error?.code || 'no_response'
      const message = response?.error?.message ?? chromeError ?? 'Unknown'
      const type = response?.error?.type || 'Error'
      const target = `${response?.target || request.target}:${request.path}`

      // set error
      bus.error = {
        code,
        message,
        target,
      }

      // reject
      if (onError === 'reject') {
        return reject(bus.error)
      }

      // warn, unless "no_response" (as a target not existing is not an "error" per se)
      if (onError === 'warn' && code !== 'no_response') {
        console.warn(`extension-bus[${source}] ${type} at "${target}": ${message}`)
      }

      // handle
      else if (typeof onError === 'function') {
        return resolve(onError(request, response, bus))
      }

      // finally, resolve
      return resolve(null)
    }

    // handle response
    return resolve(response.result)
  }

  // -------------------------------------------------------------------------------------------------------------------
  // api
  // -------------------------------------------------------------------------------------------------------------------

  async function call <R = any, D = any>(path: string, data?: D): Promise<R> {
    return new Promise((resolve, reject) => {
      bus.error = null
      const request = makeRequest(source, target, path, data)
      return chrome.runtime.sendMessage(request, response => handleResponse(response, request, resolve, reject))
    })
  }

  async function callTab <R = any, D = any>(tabId: number | true, path: string, data?: D): Promise<R> {
    let _tabId: number
    if (tabId === true ) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      _tabId = tabs[0]?.id || 0
    }
    else {
      _tabId = tabId
    }
    return new Promise(function (resolve, reject) {
      bus.error = null
      const request = makeRequest(source, '*', path, data)
      return chrome.tabs.sendMessage(_tabId, request, response => handleResponse(response, request, resolve, reject))
    })
  }

  async function callExtension <R = any, D = any>(extensionId: string, path: string, data?: D): Promise<R> {
    return new Promise(function (resolve, reject) {
      bus.error = null
      const request = makeRequest(source, '*', path, data)
      return chrome.runtime.sendMessage(extensionId, request, response => handleResponse(response, request, resolve, reject))
    })
  }

  // -------------------------------------------------------------------------------------------------------------------
  // setup
  // -------------------------------------------------------------------------------------------------------------------

  // add listener for internal messages
  chrome.runtime.onMessage.addListener(handleRequest)

  // add listener for external messages
  if (options.external) {
    chrome.runtime.onMessageExternal.addListener(handleExternalRequest)
  }

  // defaults
  const {
    handlers = {},
    onError = 'warn',
    target = '*',
  } = options

  // bus
  const bus: Bus = {
    source,
    target,
    handlers,
    call,
    callTab,
    callExtension,
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
