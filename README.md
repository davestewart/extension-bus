# Extension Bus

> Universal message bus for web extensions

## Abstract

The Web Extensions API provides a way to communicate between processes by way of [message passing](https://developer.chrome.com/docs/extensions/mv2/messaging).

However, setting up a robust, consistent and flexible messaging implementation is surprisingly complex.

This package satisfies those criteria, by way of:

- simple cross-process messaging
- named buses to easily target individual processes
- named and nested handlers to support more complex use cases
- transparent handling of sync and async calls
- transparent handling of process and runtime errors
- a consistent interface for processes and tabs

## Overview

### Installation

Install directly from GitHub:

```
npm i likelylogic/extension-bus
```

### Usage

#### Creating a new bus

For each process, i.e. `background`, `popup`,  `content`, `page` :

- create a named `Bus`
- add handler functions
- optionally specify a `target`

```js
// named process
const bus = makeBus('popup', {
  // optionally target specific process
  target: 'background',

  // handle incoming requests
  handlers: {
    foo (value, sender) { ... },
    bar (value, { tab }) { ... },
  }
})
```

Note that:

- you can name a `bus` anything, i.e. `content`, `account`, `gmail`, etc
- the `target` must be the name of another `bus`, or `*` to target all buses (the default)
- `handlers` may be nested, then targeted with `/` or `.` syntax, i.e. `'baz/qux'`
- new handlers may be added via `add()`, i.e. `bus.add('baz': { qux })`

#### Sending a message

To send a message to one or more processes, call their handlers by *path*:

```js
// make outgoing requests
const result = await bus.call('greet', 'hello from popup')
```

Note that:

- nested handlers can be targeted using `/` or `.` syntax, i.e. `bus.call('baz/qux')`
- you can override configured target(s) by prefixing with the named target, i.e. `popup:greet` or `*:test`
- you can target content scripts by passing the tab's `id` first, i.e. `.call(tabId, 'greet', 'hello')`
- calls will *always* complete; use `await` to receive returned values ([errors](#handling-errors) always return `null`)

#### Receiving a message

Messages that successfully target a bus will be routed to the correct handler:

```ts
// content
const result = await bus.call('test/exec', 123)
```
```ts
// background bus handlers
const handlers = {
  test: {
    exec (value: number, sender: chrome.runtime.MessageSender) {
      // do something with value and / or sender
      if (sender.tab?.url.includes('google.com')) {
        // reference sibling handlers
        const doubled = this.double(value)

        // optionally return a value
        return 'success: ' + doubled        
      }
    },
    
    double (value) {
      return value * 2
    }
  }
}
```

Note that:

- the first parameter is the passed data (can be any JSON-serializable value)
- the second parameter is the `sender` context
- handlers are scoped to their containing block (so `this` targets siblings)
- return a value to respond to the `source` bus

#### Handling errors

An error state occurs if:

- the targeted bus or tab does not exist
- no handler paths were matched
- a matched handler errors or rejects a promise
- extension source code was updated but not reloaded 

Failed calls return `null`.

If you're not sure if there was an error, check the `bus.error` property:

```js
const result = await bus.call('unknown')
if (result === null && bus.error) {
  // handle error
}
```

If there is an error, the property will contain information about the error:

```js
{
  type: 'handler_error',
  message: 'ReferenceError: foo is not defined'
}
```

The following table explains the error types:

| Type            | Message                                                         | Description                                                                                                                                                      |
|-----------------|-----------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `no_response`   | "The message port closed before a response was received."       | There were no `target` buses loaded that matched the source bus' `target` property, or multiple buses were called via (`*`) and none contained matching handlers |
|                 | "Could not establish connection. Receiving end does not exist." | The targeted tab didn't exist, was discarded, was never loaded, or wasn't reloaded after reloading the extension                                                 |
| `no_handler`    | _None_                                                          | A named `target` bus was found, but did not contain a handler at the supplied `path`                                                                             |
| `handler_error` | *The error message*                                             | A handler was found, but threw an error when called (see the `target`'s console for the full `error` object)                                                     |

Note that because of the way messaging passing works, a `no_handler` error will only be recorded when targeting a **single** *named* bus. This is because when targeting multiple buses, the first bus to reply wins, so in order not to prevent a _potential_ matched bus from replying, unmatched buses **must** stay quiet; thus if _no_ buses match or contain handlers, the error can only be `no_response`.

For example:

```js
await bus.call('*:unknown') || bus.error // 'no_response'
await bus.call('background:unknown') || bus.error // 'no_handler'
```

##### Customising error handling

To modify how errors are handled, configure the `onError` option:

```js
const bus = makeBus('popup', {
  // warns in the console (unless error is "no_response") and returns null
  onError: 'warn',

  // rejects the error, and should be handled by try/catch or .catch(err)
  onError: 'reject',

  // custom function (i.e. log / warn) and returns null
  onError: (request, response, error) => { ... },
})
```

##### A note about error trapping

Handler calls are wrapped in a `try/catch` and use `console.warn()` to log errors.

The console output will contain a call stack so should be sufficient for debugging purposes – though logging errors is really just a courtesy to prevent them being swallowed by the `catch`. If you have code that may error, you should handle it _within_ the target handler function, rather than letting errors leak into the bus.

## Development

### API

See the types file for the full API:

- https://github.com/likelylogic/extension-bus/tree/main/src/types.ts

### Writing and testing code

Writing successful message handling is complicated by the fact that as code is updated / reloaded, connections are replaced, and Chrome can error (see above table).

To successfully test messaging between processes, follow the following advice:

- For `page` and `background` processes, reload the process using `Cmd+R`/`F5`
- For `popup` scripts, reopen the popup to load the new script
- For `content` scripts, make sure to reload both the extension **and** content scripts tabs

Extension Bus will handle any `no_response` errors for you, but you don't want errors, you want responses! 

## Demo

The package ships with an installable demo extension:

![screenshot](https://raw.githubusercontent.com/likelylogic/extension-bus/typescript/demo/assets/screenshot.png)

You can check the source code at:

- https://github.com/likelylogic/extension-bus/tree/main/demo/app

Each of the main processes have a named `bus` configured, and each of them sends messages to one or more processes:

| Process    | Sends to              | Registered handlers | Demonstrates                            |
|------------|-----------------------|---------------------|:----------------------------------------|
| Popup      | All, Page, Background | `pass`, `fail`      | Returning and erroring calls            |
| Page       | All, Page, Background | `pass`, `fail`      | Returning and erroring calls            |
| Background | All                   | `pass`, `fail`      | Returning and erroring calls            |
|            |                       | `handle`            | Non-returning call                      |
|            |                       | `delay`             | Async handler                           |
|            |                       | `bound`             | Referencing a sibling handler           |
|            |                       | `tabs/identify`     | Returning a content script its tab `id` |
|            |                       | `tabs/update`       | Executing a script in the sending tab   |
| Content    | Background            | `pass`, `fail`,     | Returning and erroring calls            |
|            |                       | `update`            | Calling a content script by tab id      |

The examples demonstrate:

- a handler called `pass()` which always returns a result
- a handler called `fail()` which will throw an error and receive `null`
- sync and async handlers
- nested handlers
- passing payloads
- calling content scripts by id

For more informtion and usage examples, check the comments in each of the functions in the demo `.js` files.

Note that the extension will need to be reloaded if you make changes!

### Installation

To install:

- clone this repository
- From Chrome's extensions page
  - Toggle on "Developer mode"
  - Click "Load unpacked"
  - Choose the `demo` folder in the cloned repo

### Getting started

Jump in and play with each of the extension's processes / buses in the browser.

Note that this will be a mix of UI for `popup` and `pages` and DevTools for `background` and `content`.

As you click the buttons in the page, or make calls in the DevTools, watch to see related pages update or console
entries appear.

### Popup and Page

To use the popup bus, click the Extension's icon in the toolbar.

Once the popup is open you can:

- click the buttons to call handlers on buses in other processes:
  - **Call All** – calls all registered and loaded buses
  - **Call Background** – calls the `background` bus only
  - **Call Content** – calls any loaded tab  `content` bus in the first tab in the current window
  - **Call Page** – calls the `pass()` handler in any loaded `page` bus
  - **Fail Page** – calls the `fail()` handler in any loaded `page` bus
- click the **Add Page** button to add a new tab (which are also registered to send and receive)

Note that:

- sending and receiving messages (from other processes / buses) will update the table
- not all processes may exist at any particular time:
  - if no `page` tabs are open
  - if `content` scripts are not yet loaded or have been changed since last load

### Background and Content

Background and content buses should be called using the DevTools.

Open the `background` page from the Extension's page, and the `content` script using the DevTools for open tabs.

As an example, here's how you might call other buses from the `background` page:

```js
// call all processes
await bus.call('pass', 'hello from background')

// call an open page function
await bus.call('page:pass', 'hello from background')

// call an open page function that fails
await bus.call('page:fail', 'hello from background')

// call popup (if open)
await bus.call('popup:pass', 'hello from background')

// set active tab's body color to red
chrome.windows.getLastFocused(function (window) {
  chrome.tabs.query({ active: true, windowId: window.id }, async function (tabs) {
    const [tab] = tabs
    const response = await bus.call(tab.id, 'update', 'red')
    console.log(response)
  })
})
```

## Compatibility

The package is compatible and tested on MV2 Chrome and Firefox.

It has been rewritten in TypeScript, and comes with source maps.

An MV3 version is coming in the next few months.
