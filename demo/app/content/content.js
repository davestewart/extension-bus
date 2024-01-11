(async function (){
  // imports
  const { makeBus } = await import(chrome.runtime.getURL('utils/bus.mjs'))
  const { getId } = await import(chrome.runtime.getURL('utils/view.js'))

  // handlers
  const handlers = {
    pass (value, sender) {
      console.log('pass called', { value, sender })
      return 'handled by content ' + id
    },

    fail (value, sender) {
      console.log('fail called', { value, sender })
      throw new Error('broken in content')
    },

    tabs: {
      update (color) {
        return new Promise(function (resolve) {
          document.body.style.color = color
          resolve(Date.now())
        })
      }
    }
  }

  // create bus
  const bus = window.bus = makeBus('content', { handlers, target: 'background' })

  // ids
  const id = getId()
  const tabId = await bus.call('background:tabs/identify')

  // debug
  console.log(`[extension-bus] tab id: ${tabId}`)
})()

console.log('[extension-bus] content script loaded')
