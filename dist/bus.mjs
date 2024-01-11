/**
 * MIT License
 *
 * Copyright (c) 2024 Likely Logic
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/**
 * Resolve a nested handler by path
*/
function getHandler(input, path) {
    if (path === void 0) { path = ''; }
    var segments = path.split(/[/.]/);
    var output = input;
    while (segments.length > 0) {
        var segment = segments.shift();
        if (segment) {
            var target = output[segment];
            if (typeof target === 'function') {
                if (segments.length === 0) {
                    return target.bind(target);
                }
            }
            else {
                output = target;
            }
        }
    }
    return;
}
/**
 * Create a request object
 */
function makeRequest(source, target, path, data) {
    // parse target and path
    var _a = path.includes(':')
        ? path.split(':')
        : [undefined, path], _target = _a[0], _path = _a[1];
    // request object for call
    return {
        source: source,
        target: _target || target,
        path: _path,
        data: data,
    };
}
/**
 * Make a universal chrome messaging bus
 *
 * @param   source    The name of this messaging bus, i.e. "content", "background", "account"
 * @param   options   Optional bus configuration options, including handlers
 */
var makeBus = function (source, options) {
    // -------------------------------------------------------------------------------------------------------------------
    // parameters
    // -------------------------------------------------------------------------------------------------------------------
    if (options === void 0) { options = {}; }
    var 
    /**
     * A block of handlers, or nested handlers
     */
    _a = options.handlers, 
    /**
     * A block of handlers, or nested handlers
     */
    handlers = _a === void 0 ? {} : _a, 
    /**
     * How to handle errors
     */
    _b = options.onError, 
    /**
     * How to handle errors
     */
    onError = _b === void 0 ? 'warn' : _b, 
    /**
     * The name of a target bus
     */
    _c = options.target, 
    /**
     * The name of a target bus
     */
    target = _c === void 0 ? '*' : _c;
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
    var handleRequest = function (request, sender, sendResponse) {
        var _a = request || {}, target = _a.target, path = _a.path, data = _a.data;
        // request matches target...
        if (target === '*' || target === source) {
            // resolve handler
            var handler = getHandler(handlers, path);
            // if we have a handler...
            if (handler && typeof handler === 'function') {
                // setup send
                var send_1 = function (data) {
                    sendResponse(__assign({ target: source }, data));
                };
                var handleError = function (error) {
                    send_1({ error: 'message' in error ? error.message : 'unknown' });
                    throw (error);
                };
                // execute handler
                try {
                    // get the result
                    var result = handler(data, sender, sender.tab);
                    // if handler is async, send when done
                    if (result instanceof Promise) {
                        // handle success
                        result
                            .then(function (result) { return send_1({ result: result }); })
                            // catch async error
                            .catch(handleError);
                        // tell chrome handler is async
                        return true;
                    }
                    // if handler is sync, send now
                    send_1({ result: result });
                }
                // catch sync error
                catch (error) {
                    handleError(error);
                }
            }
        }
    };
    /**
     * Generalised response handler (runtime or tabs)
     *
     * @param response  The response data sent by the bus at the scripting target
     * @param request   The original request sent by the source bus
     * @param resolve   The promise resolve function
     * @param reject    The promise reject function
     */
    var handleResponse = function (response, request, resolve, reject) {
        var _a;
        // error handler
        var handleError = function (error, message) {
            if (message === void 0) { message = ''; }
            // set error
            bus.error = error;
            // manually handle errors
            if (typeof onError === 'function') {
                onError.call(null, request, response);
                return resolve(null);
            }
            // otherwise, warn and maybe reject
            if (onError) {
                console.warn("bus[".concat(source, "] error \"").concat(error, "\" ").concat(message));
            }
            if (onError === 'reject') {
                return reject(new Error(error));
            }
            // resolve null
            resolve(null);
        };
        // handle chrome error
        if (chrome.runtime.lastError) {
            var message = ((_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message) || '';
            var error_1 = message;
            // The message port closed before a response was received.
            if (message.includes('message port closed')) {
                error_1 = 'no handler';
            }
            // 'Could not establish connection. Receiving end does not exist.'
            else if (message.includes('does not exist')) {
                error_1 = 'no target';
            }
            // firefox runtime error
            else if (response) {
                response = {
                    error: error_1
                };
            }
            // pass error to handling function
            if (error_1) {
                return handleError(error_1, "for \"".concat(request.target, ":").concat(request.path, "\""));
            }
        }
        // handle no response (firefox won't send a result if target throws)
        if (!response) {
            response = { error: 'unknown' };
        }
        // handle response
        var result = response.result, error = response.error;
        return error
            ? handleError('runtime error', "at \"".concat(request.target, ":").concat(request.path, "\": \"").concat(error, "\""))
            : resolve(result);
    };
    function call(tabIdOrPath, pathOrData, data) {
        // handle calls to tabs
        if (typeof tabIdOrPath === 'number') {
            return callTab(tabIdOrPath, pathOrData, data);
        }
        // reset error
        bus.error = '';
        // make request
        var request = makeRequest(source, target, tabIdOrPath, pathOrData);
        return new Promise(function (resolve, reject) {
            return chrome.runtime.sendMessage(request, function (response) { return handleResponse(response, request, resolve, reject); });
        });
    }
    /**
     * Send message to content script tab
     *
     * @param tabId The tab id of a content script to target
     * @param path  The path of the handler to call
     * @param data  Optional data to pass to the handler
     */
    function callTab(tabId, path, data) {
        // reset error
        bus.error = '';
        // make request
        var request = makeRequest(source, '*', path, data);
        return new Promise(function (resolve, reject) {
            return chrome.tabs.sendMessage(tabId, request, function (response) { return handleResponse(response, request, resolve, reject); });
        });
    }
    // -------------------------------------------------------------------------------------------------------------------
    // setup
    // -------------------------------------------------------------------------------------------------------------------
    // add listener for incoming messages
    chrome.runtime.onMessage.addListener(handleRequest);
    // build output object
    var bus = {
        source: source,
        target: target,
        error: '',
        call: call,
        handlers: handlers,
        assign: function (newHandlers) {
            Object.assign(handlers, newHandlers);
            return bus;
        },
    };
    // return
    return bus;
};

export { makeBus };
//# sourceMappingURL=bus.mjs.map
