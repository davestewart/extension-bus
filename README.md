# Extension Bus

> Universal message bus for web extensions

## Abstract

The Web Extensions API provides a way to communicate between processes by way of [message passing](https://developer.chrome.com/docs/extensions/mv2/messaging).

However, the messging API is quite simple, so setting up a robust messaging implementation is complex.

This package provides a robust, consistent and flexible messaging layer, with the following features:

- simple cross-process messaging
- named buses to easily target individual processes
- named and nested handlers to handle both small and large apps
- transparent handling of both sync and async calls
- transparent handling of errors, for both process and runtime
- a consistent interface for both runtime and tabs

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
    bar (value, sender) { ... },
  }
})
```

Note that:

- you can name a `bus` anything, i.e. `content`, `account`, `gmail`, etc
- any `target` must be the name of another `bus`, or `*` to target all buses
- `handlers` may be nested, then targeted with `/` or `.` syntax, i.e. `baz/qux`
- handler functions are scoped to their containing block (so `this` targets siblings)
- new handlers may be added via `add()`, i.e. `bus.add('baz': { qux })`

#### Sending a message

To send a message to one or more processes, call their handlers by *path*:

```js
// make outgoing requests
const result = await bus.call('baz/qux', 'hello from popup')
```

Note that:

- calls will *always* complete.
- nested handlers can be targeted using `/` or `.` syntax, i.e. `baz/qux`
- you can override configured target(s) by prefixing with the named target, i.e. `popup:greet` or `*:test`
- you can target tab content scripts by passing the tab's `id` first, i.e. `.call(tabId, 'greet', 'hello')`

#### Handling errors

By default, failed calls return `null`.

If you're not sure if there was an error, check the `bus.error` property:

```js
const result = await bus.call('this/might/fail')
if (result === null && bus.error) {
  // do something else
}
```

Additionally, error handling can be configured:

```js
const bus = makeBus('popup', {
  // warns in the console (unless error is "no target") and returns null
  onError: 'warn',

  // rejects the error, and should be handled by try/catch or .catch(err)
  onError: 'reject',

  // custom function called (i.e. log / warn) and returns null
  onError: (request, response) => { ... },
})
```

For information about the error, check `bus.error`:

- `no response` – the targeted process did not exist (popup not open, no pages opened, old script version, etc)
- `no handler` – one or more targeted processes were found, but none contained the named handler
- `runtime error` – a handler was found, but threw an error (see the `target`'s console for the error)
- `unknown` – something else went wrong

##### A note about error trapping

Handler calls are wrapped in a `try/catch` and earlier versions of Extension Bus would first send the error message to the source bus, then re-**throw** the error. Unfortunately in Firefox, this resulted in an empty response, so in order to disambiguate a _failed_ response from no valid targets (where no response will be received) the only option is to _log_ errors.

Luckily, `console.error` does produce a stack so should be sufficient for debugging purposes, though logging errors is really just a courtesy to prevent them being swallowed by the `catch`. If you have code that may error, you should handle it _within_ the target handler function, rather than letting errors leak into the target bus.

## API

See the types file for the full API:

- https://github.com/likelylogic/extension-bus/tree/main/src/types.ts

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

For more informtion and usage examples, check the code in the `demo/app/*` folders.

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
