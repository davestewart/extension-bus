// src/index.ts
function getHandler(input, path = "") {
  const segments = path.split(/[/.]/);
  let parent = input;
  while (segments.length > 0) {
    const segment = segments.shift();
    if (segment) {
      const child = parent[segment];
      if (typeof child === "function") {
        if (segments.length === 0) {
          return child.bind(parent);
        }
      } else {
        parent = child;
      }
    }
  }
  return;
}
function makeRequest(source, target, path, data) {
  const [_target, _path] = path.includes(":") ? path.split(":") : [void 0, path];
  return {
    source,
    target: _target || target,
    path: _path,
    data
  };
}
function makeResponse(target, payload) {
  return { target, ...payload };
}
var makeBus = (source, options = {}) => {
  const handleRequest = (request, sender, sendResponse) => {
    const { target: target2, path, data } = request || {};
    if (target2 === source || target2 === "*") {
      const handler = getHandler(handlers, path);
      const send = (data2) => {
        sendResponse(makeResponse(source, data2));
      };
      if (handler && typeof handler === "function") {
        const handleError = (error) => {
          const data2 = error instanceof Error ? { message: error.message, type: error.name } : { message: error };
          send({
            error: { code: "handler_error", ...data2 }
          });
          console.warn(error);
        };
        try {
          const result = handler(data, sender);
          if (result instanceof Promise) {
            result.then((result2) => send({ result: result2 })).catch(handleError);
            return true;
          }
          send({ result });
        } catch (error) {
          handleError(error);
        }
      }
      if (target2 === source) {
        return send({ error: { code: "no_handler", message: `No handler` } });
      }
    }
  };
  const handleResponse = function(response, request, resolve, reject) {
    var _a, _b, _c, _d;
    const chromeError = ((_a = chrome.runtime.lastError) == null ? void 0 : _a.message) || "";
    if (chromeError || !response || response.error) {
      const code = ((_b = response == null ? void 0 : response.error) == null ? void 0 : _b.code) || "no_response";
      const message = ((_c = response == null ? void 0 : response.error) == null ? void 0 : _c.message) ?? chromeError ?? "Unknown";
      const type = ((_d = response == null ? void 0 : response.error) == null ? void 0 : _d.type) || "Error";
      const target2 = `${request.target}:${request.path}`;
      bus.error = {
        code,
        message,
        target: target2
      };
      if (onError === "reject") {
        return reject(bus.error);
      }
      if (onError === "warn" && code !== "no_response") {
        console.warn(`extension-bus[${source}] ${type} at "${target2}": ${message}`);
      } else if (typeof onError === "function") {
        return resolve(onError(request, response, bus));
      }
      return resolve(null);
    }
    return resolve(response.result);
  };
  function call(tabIdOrPath, pathOrData, data) {
    bus.error = null;
    const request = typeof tabIdOrPath === "number" ? makeRequest(source, "*", pathOrData, data) : makeRequest(source, target, tabIdOrPath, pathOrData);
    return new Promise((resolve, reject) => {
      const callback = (response) => handleResponse(response, request, resolve, reject);
      return typeof tabIdOrPath === "number" ? chrome.tabs.sendMessage(tabIdOrPath, request, callback) : chrome.runtime.sendMessage(request, callback);
    });
  }
  chrome.runtime.onMessage.addListener(handleRequest);
  const {
    /**
     * A block of handlers, or nested handlers
     */
    handlers = {},
    /**
     * How to handle errors
     */
    onError = "warn",
    /**
     * The name of a target bus
     */
    target = "*"
  } = options;
  const bus = {
    source,
    target,
    handlers,
    call,
    add(name, newHandlers) {
      handlers[name] = newHandlers;
      return bus;
    },
    error: null
  };
  return bus;
};
export {
  makeBus
};
//# sourceMappingURL=index.mjs.map