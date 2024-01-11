import { makeBus } from '../../bus/bus.es.js'
import { makeView } from '../../utils/view.js'

const handlers = {
  pass (value, sender) {
    console.log('pass called', { value, sender })
    return view.receiveMessage(value, sender)
  },

  fail (value, sender) {
    console.log('fail called', { value, sender })
    throw new Error('broken in popup')
  }
}

const bus = window.bus = makeBus('popup', { handlers })

const view = makeView(bus)

Object.assign(window, {
  bus,
})
