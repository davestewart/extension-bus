# Extension Bus

> Universal message bus for web extensions

![splash](https://raw.githubusercontent.com/davestewart/extension-bus/main/splash.png)

## Abstract

The Web Extensions API provides a way to communicate between processes by way of [message passing](https://developer.chrome.com/docs/extensions/mv2/messaging).

However, setting up a robust, consistent and flexible messaging implementation is surprisingly complex.

This package provides an elegant solution, with:

- simple cross-process messaging
- named buses to easily target processes
- nested handlers with an API-like interface 
- transparent handling of sync and async handlers
- transparent handling of process and handler errors
- transparent handling of internal and external calls
- a consistent interface for process, tab and external calls

Once configured with targets and handlers, typical [messaging code](#sending-a-message) looks like the following:

```ts
const result = await bus.call('some/handler', payload)
```

And with consistent handling of [errors and edge cases](#error-handling) messaging becomes intuitive, simple and straightforward.

## Usage

### Installation

Install from NPM:

```
npm i @davestewart/extension-bus
```

Alternatively, you can shorten imports with an alias, for example `bus`:

```
npm i bus@npm:@davestewart/extension-bus
```

### Creating a bus

For each process, i.e. `background`, `popup`,  `content`, `page` :

- create a named `Bus`
- add handler functions
- optionally specify a `target`
- optionally configure `external` access

```js
import { makeBus } from 'bus'

// named process
const bus = makeBus('popup', {
  // optionally target a specific process
  target: 'background',
  
  // handle incoming requests
  handlers: {
    foo (value, sender) { ... },
    bar (value, { tab }) { ... },
  },

  // allow external connection
  external: true,
})
```

#### TypeScript

If you prefer to declare `handlers` separately, type their parameters with the `Handlers` type:

```ts
import { type Handlers } from 'bus'

export const handlers: Handlers = {
  // number, chrome.runtime.MessageSender
  foo (value: number, { tab }) {
    const url = tab?.url
  }
}
```

Note that:

- you can name a `bus` anything, i.e. `content`, `account`, `gmail`, etc
- any `target` must be the name of another `bus`, or `*` to target all buses (the default)
- `handlers` may be nested, then targeted using  `/` syntax, i.e. `'baz/qux'`
- new handlers may be added via `add()`, i.e. `bus.add('baz': { qux })`

### Sending a message

#### To other processes

To send a message to buses in one or more processes, call their handlers by `path`:

```js
// flat
const result = await bus.call('greet', 'hello')

// nested
const result = await bus.call('foo/bar/baz', payload)

// override target
const result = await bus.call('popup:greet', 'hello')
```

Note that calls will *always* complete; use `await` to receive returned values ([errors](#error-handling) always return `null`)

#### To other tabs

To target tab content scripts, use `callTab()`:

```js
const result = await bus.callTab(123, 'greet', 'hello')
```

#### To other extensions

To target buses in other extensions, use `callExtension()`:

```js
const result = await bus.callExtension('<extensionId>', 'account/login', { username, password })
```

See the [Receiving messages](#from-web-pages-or-other-extensions) section for more information. 

#### TypeScript

If you want to type any `call()` functions' `result` and `payload`, pass the type parameters in that order:

```ts
const window = await bus.call<Window, number>('windows/get', 1)
```

If you think a call may *not* complete (missing tab, popup closed, etc) pass a `null` union as the result type:

```ts
const window = await bus.call<Window | null>('windows/get', 1000)
if (window) {
  ...
}
```

See the [Error handling](#error-handling) section for more information.

### Receiving a message

#### From other processes

Messages that successfully target a bus will be routed to the correct handler:

```ts
// content script
const result = await bus.call('bookmarks/related', 'www.google.com')
```
Once a handler is targeted, you have a few additional conveniences:

```ts
// background script
import { type Handlers } from 'bus'

// Handlers type automatically types `sender` property
const handlers: Handlers = {
  bookmarks: {
    async related (domain: string, { tab }) {
      // reference sender
      if (tab.url?.includes(domain)) {
        // reference sibling handlers
        const bookmarks = await this.search(domain)

        // optionally return a value
        return { bookmarks }
      }
    },
    
    search (domain: string) {
      return chrome.tabs.query({ url: `https://${domain}/*` })
    }
  }
}
```

Note that:

- the first parameter is the call payload (can be any JSON-serializable value)
- the second parameter is the `sender` context (which _may_ contain a tab)
- handlers are scoped to their containing block (so `this` targets siblings)
- return a value to respond to the `source` bus

#### From web pages or other extensions

You can configure whether a bus should be able to receive external messages:

```ts
const bus = makeBus('background', {
  // always accept messages
  external: true,

  // accept calls only to these paths (supports wildcards)
  external: [
    'account/login',
    'user/*',
  ],

  // programatically accept messages
  external (path: string, sender: chrome.runtime.MessageSender): boolean {
    return sender.tab.url.startsWith('https://yourdomain.com') && path.startsWith('account/')
  },
})
```

Note: 

- it's generally more reliable to receive messages _only_ in the background process
- if the predicate fails the sending extension will receive no response

#### Sending from a non-Extension Bus extension 

If you want to message an Extension Bus extension from a non-Extension Bus extension, pass an object with `path` and optional `data` properties:

```ts
chrome.runtime.sendMessage('<extensionId>', { path: 'path/to/handler', data: 123 }, function (response) {
  if (response) {
    console.log(response.result)
  }
})
```

Note however, that Extension Bus is designed to be used across multiple extensions.

### API

See the types file for the full API:

- https://github.com/davestewart/extension-bus/tree/main/src/types.ts

## Error handling

Extension Bus guarantees all calls complete, but an "error" state occurs if:

- the targeted bus or tab does not exist
- no handler paths were matched
- a matched handler errors or rejects a promise
- extension source code was updated but not reloaded 

Failed calls return `null`, and may trigger a warning if configured:

```
extension-bus[popup] ReferenceError at "background:foo/bar": foo is not defined
```

If you're not sure if there was an error, check the `bus.error` property:

```js
const result = await bus.call('foo/bar')
if (result === null && bus.error) {
  // handle error
}
```

If there is an error, the property will contain further information:

```js
{
  code: 'handler_error',
  message: 'foo is not defined',
  target: 'background:foo/bar',
}
```

The following table explains the error codes:

| Code            | Message                                                       | Reason                                                                                                                                                           |
|-----------------|---------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `no_response`   | The message port closed before a response was received.       | There were no `target` buses loaded that matched the source bus' `target` property, or multiple buses were called via (`*`) and none contained matching handlers |
|                 | Could not establish connection. Receiving end does not exist. | The targeted tab didn't exist, was discarded, was never loaded, or wasn't reloaded after reloading the extension                                                 |
| `no_handler`    | No handler                                                    | A named `target` bus was found, but did not contain a handler at the supplied `path`                                                                             |
| `handler_error` | *The error message*                                           | A handler was found, but threw an error when called (see the `target`'s console for the full `error` object)                                                     |

Note that because of the way message passing works, a `no_handler` error will only be recorded when targeting a **single** *named* bus. This is because when targeting multiple (bus) listeners, the first listener to reply wins, so in order not to prevent a _potential_ matched bus from replying, unmatched buses **must** stay quiet; thus if _no_ buses match or contain handlers, the error can only be `no_response`.

For example:

```js
await bus.call('*:unknown') || bus.error?.code // 'no_response'
await bus.call('background:unknown') || bus.error?.code // 'no_handler'
```

### Error handling options

To modify how errors are handled, configure the `onError` option:

```js
const bus = makeBus('popup', {
  // warns in the console (unless error is "no_response") and returns null
  onError: 'warn',

  // rejects a BusError object, and should be handled by try/catch or .catch(err)
  onError: 'reject',

  // custom function, from which you can return a value
  onError: (request: BusRequest, response: BusResponse, error: Bus) => { ... },
})
```

### A note about error trapping

Handler execution is wrapped in a `try/catch` and uses `console.warn()` to log errors.

The console output will contain a call stack so should be sufficient for debugging purposes – though logging errors is really just a courtesy to prevent them being swallowed by the `catch`. If you have code that may error, you should handle it _within_ the target handler function, rather than letting errors leak into the bus.

### Writing code in development

Writing successful message handling is complicated by the fact that as code is updated / reloaded, connections are replaced, and Chrome can error (see above table).

To successfully write, run, *re*write and *re*run code which sends messages between processes:

- For `page` and `background` processes, reload the process using `Cmd+R`/`F5`
- For `popup` scripts, reopen the popup to load the new script
- For `content` scripts:
  - make sure to reload both the extension **and** content scripts tabs
  - if you're having trouble targeting the new script context in the console's "context" dropdown, open the URL in a new tab


## Demo

The package is compatible with both MV2 and MV3 and ships with near-identical demos for both:

![screenshot](https://raw.githubusercontent.com/davestewart/extension-bus/typescript/demo/assets/screenshot.png)

You can check the source code at:

- https://github.com/davestewart/extension-bus/tree/main/demo

In each demo, each of the main processes have a named `bus` configured, and each of them sends messages to one or more processes:

| Process    | Sends to              | Registered handlers | Demonstrates                            |
|------------|-----------------------|---------------------|:----------------------------------------|
| Popup      | All, Page, Background | `pass`, `fail`      | Returning and erroring calls            |
| Page       | All, Page, Background | `pass`, `fail`      | Returning and erroring calls            |
| Background | All                   | `pass`, `fail`      | Returning and erroring calls            |
|            |                       | `handle`            | Non-returning call                      |
|            |                       | `nested/hello`      | Nested handler                          |
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
  - Choose the appropriate `demo` folder in the cloned repo

To run the MV3 demo in Firefox, modify the `background` key in the `manifest.json` file as follows:

```json
{
  "background": {
    "scripts": [
      "app/background/background.js"
    ]
  }
}
```

### Getting started

Jump in and play with each of the extension's processes / buses in the browser.

Note that this will be a mix of UI for `popup` and `pages` and DevTools for `background` and `content`.

As you click the buttons in the page, or make calls in the DevTools, watch to see related pages update or console
entries appear.

### Popup and Page

To use the popup bus, click the Extension's icon in the toolbar.

Once the popup is open, or an extension page is loaded, you can:

- click the buttons to call handlers on buses in other processes:
  - **Call All** – calls all registered and loaded buses
  - **Call Background** – calls the `background` bus only
  - **Call Content** – calls the first non-`chrome:` tab  `content` bus in the current window
  - **Call Page** – calls the `pass()` handler in any loaded `page` bus
  - **Fail Page** – calls the `fail()` handler in any loaded `page` bus
- click the **Add Page** button to add a new `page` tab (which are also registered to send and receive)

Note that:

- sending and receiving messages (from other processes / buses) will update the table
- not all processes may exist at any particular time:
  - if no `page` tabs are open
  - if `content` scripts are not yet loaded or have been changed since last load

### Background and Content

Background and content buses can be interacted with via the DevTools.

#### Background

Open the `background` page from the extension's Options page, and the `content` script using the DevTools for open tabs.

As an example, here's how you might call other buses from the `background` page:

```js
// call all processes
await bus.call('pass', 'hello from background')

// call an open page function
await bus.call('page:pass', 'hello from background') || bus.error

// call an open page function that fails
await bus.call('page:fail', 'hello from background') || bus.error

// call popup (if open)
await bus.call('popup:pass', 'hello from background') || bus.error

// target a content script
// reload any tab and check the console for the tab id, e.g. 334068351
await bus.call(334068351, 'pass')

// set active tab's body color to red (must be an https:// page)
chrome.windows.getLastFocused(function (window) {
  chrome.tabs.query({ active: true, windowId: window.id }, async function (tabs) {
    const [tab] = tabs
    const result = await bus.call(tab.id, 'update', 'red')
    console.log(result)
  })
})
```

The background bus also exposes two paths to external messaging. See the [section above](#from-web-pages-or-other-extensions) for more information, but from another extension you should _only_ be able to call `pass` or `nested/hello`:

```ts
const result = await bus.callExtension('<extensionId>', 'pass')
```

To test this, you can install the MV2 extension and the MV3 extension, and message one from the other.

### Content

The content script example is set up to `reject` errors, so you can play with `try/catch ` here if you prefer that way of working.

In the console, select the "Extension Bus Demo" option from the script context dropdown, then:

```js
bus.call('fail').catch((err: BusError) => {
  console.log('Error:', err)
})
```
```
Error: {
  code: 'handler_error',
  message: 'foo is not defined',
  target: 'page:fail'
}
```

## Compatibility

The package is compatible and tested on both MV2 and MV3 Chrome and Firefox.

All code written in TypeScript, generated code comes with source maps for easy debugging.

## Support

This project open sources code from my main project [Control Space](https://controlspace.app/), a super-interactive tab manager for those who juggle **a lot** of tasks:



[![control space](https://controlspace.app/images/home/examples/actions.png)](https://controlspace.app)



If you think Control Space might work for you, click above to find out more and give it a spin.

Thanks!

Dave
