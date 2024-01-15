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
var makeBus = (source, options = {}) => {
  const handleRequest = (request, sender, sendResponse) => {
    const { target: target2, path, data } = request || {};
    if (target2 === source || target2 === "*") {
      const handler = getHandler(handlers, path);
      const send = (data2) => {
        sendResponse({ target: source, ...data2 });
      };
      const handleError = (error) => {
        send({
          error: "message" in error ? error.message : "unknown"
        });
        console.warn(error);
      };
      if (handler && typeof handler === "function") {
        try {
          const result = handler(data, sender, sender.tab);
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
        return send({ error: "no handler" });
      }
    }
  };
  const handleResponse = function(response, request, resolve, reject) {
    var _a;
    const handleError = (error, message = "", location = "") => {
      bus.error = error;
      if (typeof onError === "function") {
        onError.call(null, request, response);
        return resolve(null);
      }
      if (onError) {
        if (error !== "no target") {
          console.warn(`bus[${source}] error "${error}" ${message}`);
        }
      }
      if (onError === "reject") {
        return reject(new Error(error));
      }
      resolve(null);
    };
    if (!response || chrome.runtime.lastError || response.error === "no handler") {
      const message = ((_a = chrome.runtime.lastError) == null ? void 0 : _a.message) || response.error || "";
      let error = message;
      if (!response && !error) {
        error = "no response";
      } else if (message.includes("does not exist")) {
        error = "no response";
      } else if (message.includes("message port closed")) {
        error = "no response";
      }
      if (error) {
        return handleError(error, `for "${request.target}:${request.path}"`);
      }
    }
    return response.error ? handleError("handler error", `at "${request.target}:${request.path}": "${response.error}"`) : resolve(response.result);
  };
  function call(tabIdOrPath, pathOrData, data) {
    if (typeof tabIdOrPath === "number") {
      return callTab(tabIdOrPath, pathOrData, data);
    }
    bus.error = "";
    const request = makeRequest(source, target, tabIdOrPath, pathOrData);
    return new Promise((resolve, reject) => {
      return chrome.runtime.sendMessage(request, (response) => handleResponse(response, request, resolve, reject));
    });
  }
  function callTab(tabId, path, data) {
    bus.error = "";
    const request = makeRequest(source, "*", path, data);
    return new Promise((resolve, reject) => {
      return chrome.tabs.sendMessage(tabId, request, (response) => handleResponse(response, request, resolve, reject));
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
    error: ""
  };
  return bus;
};
export {
  makeBus
};
//# sourceMappingURL=index.mjs.map