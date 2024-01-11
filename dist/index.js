"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  makeBus: () => makeBus
});
module.exports = __toCommonJS(src_exports);
function getHandler(input, path = "") {
  const segments = path.split(/[/.]/);
  let output = input;
  while (segments.length > 0) {
    const segment = segments.shift();
    if (segment) {
      const target = output[segment];
      if (typeof target === "function") {
        if (segments.length === 0) {
          return target.bind(target);
        }
      } else {
        output = target;
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
  const handleRequest = (request, sender, sendResponse) => {
    const { target: target2, path, data } = request || {};
    if (target2 === "*" || target2 === source) {
      const handler = getHandler(handlers, path);
      if (handler && typeof handler === "function") {
        const send = (data2) => {
          sendResponse({ target: source, ...data2 });
        };
        const handleError = (error) => {
          send({ error: "message" in error ? error.message : "unknown" });
          throw error;
        };
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
    }
  };
  const handleResponse = function(response, request, resolve, reject) {
    var _a;
    const handleError = (error2, message = "") => {
      bus.error = error2;
      if (typeof onError === "function") {
        onError.call(null, request, response);
        return resolve(null);
      }
      if (onError) {
        console.warn(`bus[${source}] error "${error2}" ${message}`);
      }
      if (onError === "reject") {
        return reject(new Error(error2));
      }
      resolve(null);
    };
    if (chrome.runtime.lastError) {
      const message = ((_a = chrome.runtime.lastError) == null ? void 0 : _a.message) || "";
      let error2 = message;
      if (message.includes("message port closed")) {
        error2 = "no handler";
      } else if (message.includes("does not exist")) {
        error2 = "no target";
      } else if (response) {
        response = {
          error: error2
        };
      }
      if (error2) {
        return handleError(error2, `for "${request.target}:${request.path}"`);
      }
    }
    if (!response) {
      response = { error: "unknown" };
    }
    const { result, error } = response;
    return error ? handleError("runtime error", `at "${request.target}:${request.path}": "${error}"`) : resolve(result);
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
  const bus = {
    source,
    target,
    error: "",
    call,
    handlers,
    assign(newHandlers) {
      Object.assign(handlers, newHandlers);
      return bus;
    }
  };
  return bus;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  makeBus
});
//# sourceMappingURL=index.js.map