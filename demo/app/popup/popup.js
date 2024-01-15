import { makeBus } from '../../bus/index.mjs'
import { makeView } from '../../utils/view.js'

const handlers = {
  pass (value, sender) {
    console.log('pass called', { value, sender })
    return view.receiveMessage(value, sender)
  },

  fail (value, sender) {
    console.log('fail called', { value, sender })
    return foo * bar
  }
}

const bus = window.bus = makeBus('popup', { handlers })

const view = makeView(bus)

Object.assign(window, {
  bus,
})
