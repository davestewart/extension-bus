let id = Number(localStorage.getItem('id') || 1)

export function getId () {
  id++
  localStorage.setItem('id', String(id))
  return id
}

function makeTable () {
  const table = document.createElement('table')
  table.innerHTML = `
    <thead>
      <tr>
        <th>Target</th>
        <th>Request</th>
        <th>Response / Data / Error</th>
        <th>Sender</th>
      </tr>
    <tbody>`

  const addCell = (data) => {
    const el = document.createElement('td')
    el.textContent = data === undefined
      ? ''
      : typeof data === 'string'
        ? data
        : JSON.stringify(data, null, '  ')
    return el
  }

  const addRow = (target, request, response, sender) => {
    const row = document.createElement('tr')
    row.appendChild(addCell(target))
    row.appendChild(addCell(request))
    row.appendChild(addCell(response))
    row.appendChild(addCell(sender))
    table.querySelector('tbody').appendChild(row)
  }

  document.body.appendChild(table)

  return {
    table,
    addRow
  }
}

export function makeView (bus) {
  // data
  const id = getId()

  // elements
  const title = document.getElementById('title')
  const options = document.getElementById('options')
  const table = makeTable()

  /**
   * Receives a message and updates the table
   */
  function receiveMessage (response, sender) {
    console.log('[response]', response)
    table.addRow(undefined, undefined, response, sender)
    return `handled by ${bus.source} ${id}`
  }

  /**
   * Sends a message to the named process
   */
  async function sendMessage (path = 'pass', data = `hello from ${bus.source} ${id}`) {
    const response = await bus.call(path, data)
    table.addRow(path, data, bus.error || response)
  }

  /**
   * Sends a message to the content script in the current tab
   */
  async function callContent (path = 'pass', data = `hello from ${bus.source} ${id}`) {
    const response = await bus.callTab(true, path, data)
    table.addRow(path, data, bus.error || response)
  }

  // page title
  if (title) {
    title.innerText = `Page ${id}`
  }

  // options
  if (options) {
    options.addEventListener('change', function (event) {
      console.log(event)
    })
  }

  // call buses
  document.querySelectorAll('button[data-path]').forEach(button => {
    button.addEventListener('click', () => {
      const attr = String(button.dataset.path)
      const [target, path] = attr.split(':')
      target === 'content'
        ? callContent(attr)
        : sendMessage(attr)
    })
  })

  // add new page
  document.getElementById('add').addEventListener('click', () => {
    const url = chrome.runtime.getURL('app/page/index.html')
    chrome.tabs.create({ url }, console.log)
  })

  // add send message as global
  window.sendMessage = sendMessage

  return {
    receiveMessage,
    sendMessage,
    callContent,
    id,
  }
}
