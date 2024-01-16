(async function (){
  // imports
  const { makeBus } = await import(chrome.runtime.getURL('bus/index.mjs'))
  const { getId } = await import(chrome.runtime.getURL('utils/view.js'))

  // handlers
  const handlers = {
    pass (value, sender) {
      console.log('pass called', { value, sender })
      return `handled in "${document.title}"`
    },

    fail (value, sender) {
      console.log('fail called', { value, sender })
      return foo * bar
    },

    /**
     * Set the color of this tab
     *
     * @usage
     *
     *  - open tab
     *  - check console for tab id
     *  - from background, popup or page process: bus.call(tabId, 'update', 'red')
     */
    update (color) {
      return new Promise(function (resolve) {
        document.body.style.color = color
        resolve(`color changed to ${color}`)
      })
    }
  }

  /**
   * Create Bus which rejects, rather than consumes the error
   */
  const bus = window.bus = makeBus('content', {
    target: 'background',
    onError: 'reject',
    handlers,
  })

  // debug
  const tabId = await bus.call('background:tabs/identify')
  console.log(`[extension-bus] tab id: ${tabId}`)
  console.log(`[extension-bus] bus:`, bus)
})()

console.log('[extension-bus] content script loaded')
