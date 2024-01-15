import { makeBus } from '../../bus/index.mjs'

const handlers = {
  pass (value, sender) {
    console.log('pass called', { value, sender })
    return 'handled by background'
  },

  fail (value, sender) {
    console.log('fail called', { value, sender })
    throw new Error('broken in background')
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
   * Calls sibling handler, `this` bound to parent scope
   *
   * @usage from any process: await bus.call('bound')
   */
  bound () {
    return this.delay().then(value => `Received: ${value}`)
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
