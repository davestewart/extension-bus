/**
 * Bus instance
 */
export interface Bus {
  call (path: string, data?: any): Promise<any>

  call (tabId: number, path: string, data?: any): Promise<any>

  assign (handlers: Handlers): Bus

  handlers: Handlers
  error: BusError
  source: string
  target: string | '*'
}

/**
 * Bus factory
 */
export type BusFactory = (
  source: string,
  options?: BusOptions,
) => Bus

/**
 * Bus options
 */
export type BusOptions = {
  target?: string | '*'
  handlers?: Handlers
  onError?: 'warn' | 'reject' | ((request: BusRequest, response: BusResponse) => void)
}

/**
 * Bus handler tree
 */
export type Handler = Handlers | ((value: any, sender: chrome.runtime.MessageSender, tab?: chrome.tabs.Tab) => any | Promise<any>)
export type Handlers = {
  [key: string]: Handler
}

/**
 * Bus request
 * @internal
 */
export type BusRequest = {
  source: string
  target: string | '*'
  path: string
  data: any
}

/**
 * Bus response
 * @internal
 */
export type BusResponse = {
  result?: any
  error?: BusError
}

/**
 * BusError value
 */
export type BusError = 'no target' | 'no handler' | 'runtime error' | 'unknown' | string
