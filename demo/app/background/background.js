import { makeBus } from '../../bus/index.mjs'

const handlers = {
  /**
   * Returns a value
   *
   * @usage from any process: await bus.call('pass', 123)
   */
  pass (value, sender) {
    console.log('pass called', { value, sender })
    return 'handled by background'
  },

  /**
   * Logs a runtime error
   *
   * @usage from any process: await bus.call('pass') || bus.error
   */
  fail (value, sender) {
    console.log('fail called', { value, sender })
    return foo * bar
  },

  /**
   * Handles the call, but doesn't return a value
   *
   * @usage from any process: await bus.call('background:handle')
   */
  handle (value, sender) {
    console.log('handle called', { value, sender })
  },

  /**
   * Nested handler
   *
   * @usage from any process: bus.call('nested/hello', 'world')
   */
  nested: {
    hello (value, sender) {
      console.log('nested/hello called', { value, sender })
    }
  },

  /**
   * Async handler
   *
   * @usage from any process: await bus.call('delay')
   */
  delay (value, sender) {
    console.log('delay called', { value, sender })
    return new Promise(function (resolve, reject) {
      setTimeout(() => {
        resolve(Date.now())
      }, 1000)
    })
  },

  /**
   * Calls sibling handler (`this` bound to parent scope)
   *
   * @usage from any process: await bus.call('bound')
   */
  bound (value, sender) {
    console.log('bound called', { value, sender })
    return this.delay(value, sender).then(value => `Received: ${value}`)
  },

  tabs: {
    /**
     * Returns content script its own id
     *
     * @usage from content: await bus.call('tabs/identify')
     */
    identify (value, sender) {
      return sender.tab.id
    },

    /**
     * Round trip from content to execute script in calling content
     *
     * @usage from content: bus.call('tabs/update', 'blue')
     */
    update (color, { tab }) {
      return new Promise(function (resolve) {
        chrome.tabs.executeScript(tab.id, { code: `document.body.style.color = '${color}'` }, resolve)
      })
    },
  }
}

const bus = makeBus('background', { handlers })

Object.assign(window, {
  bus,
})
