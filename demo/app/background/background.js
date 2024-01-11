import { makeBus } from '../../bus/bus.es.js'

const handlers = {
  pass (value, sender) {
    console.log('pass called', { value, sender })
    return 'handled by background'
  },

  fail (value, sender) {
    console.log('fail called', { value, sender })
    throw new Error('broken in background')
  },

  nested: {
    delay (value, sender) {
      console.log('nested/delay called', { value, sender })
      return new Promise(function (resolve, reject) {
        setTimeout(() => {
          resolve(Date.now())
        }, 1000)
      })
    }
  },

  tabs: {
    identify (value, sender) {
      return sender.tab.id
    },

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
