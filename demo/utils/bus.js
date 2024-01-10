/**
 * Resolve a nested handler by path
 */
function getHandler (handlers, path = '') {
  const segments = path.split(/[/.]/)
  let output = handlers
  for (const segment of segments) {
    if (segment in output) {
      const target = output[segment]
      if (typeof target === 'function') {
        return target.bind(output)
      }
      output = target
    }
    else {
      return
    }
  }
  return output
}

/**
 * Create a request object
 */
function makeRequest (source, target, path, data) {
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
 * @param   source
 * @param   options
 */
export function makeBus (source, options = {}) {

  // -------------------------------------------------------------------------------------------------------------------
  // parameters
  // -------------------------------------------------------------------------------------------------------------------

  const {
    handlers = {},
    onError = 'warn',
    target = '*',
  } = options

  // -------------------------------------------------------------------------------------------------------------------
  // setup
  // -------------------------------------------------------------------------------------------------------------------

  // handle request
  const handleRequest = (request, sender, sendResponse) => {
    const { target, path, data } = request || {}
    // request matches target...
    if (target === '*' || target === source) {
      // resolve handler
      const handler = getHandler(handlers, path)

      // if we have a handler...
      if (handler && typeof handler === 'function') {
        // setup send
        const send = (data) => {
          sendResponse({ target: source, ...data })
        }
        const handleError = (error) => {
          send({ error: error.message })
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

  // generalised response handler
  const handleResponse = function (response, request, resolve, reject) {
    // error handler
    const handleError = (error, message = '') => {
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
    const lastError = chrome.runtime.lastError
    if (lastError) {
      let error = chrome.runtime.lastError

      // The message port closed before a response was received.
      if (lastError.message.includes('message port closed')) {
        error = 'no handler'
      }

      // 'Could not establish connection. Receiving end does not exist.'
      else if (lastError.message.includes('does not exist')) {
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

  // add listener for incoming messages
  chrome.runtime.onMessage.addListener(handleRequest)

  // -------------------------------------------------------------------------------------------------------------------
  // api
  // -------------------------------------------------------------------------------------------------------------------

  // send message to scripting targets
  const call = function (path, data) {
    // handle calls to tabs
    if (typeof path === 'number') {
      return callTab(...arguments)
    }

    // reset error
    bus.error = ''

    // make request
    const request = makeRequest(source, target, path, data)
    return new Promise((resolve, reject) => {
      return chrome.runtime.sendMessage(request, response => handleResponse(response, request, resolve, reject))
    })
  }

  // send message to content script targets
  const callTab = (tabId, path, data) => {
    // reset error
    bus.error = ''

    // make request
    const request = makeRequest(source, '*', path, data)
    return new Promise((resolve, reject) => {
      return chrome.tabs.sendMessage(tabId, request, response => handleResponse(response, request, resolve, reject))
    })
  }

 // build output object
  const bus = {
    source,
    target,
    error: '',
    call,
    handlers,
    assign (data) {
      Object.assign(handlers, data)
      return bus
    },
  }

  // return
  return bus
}
