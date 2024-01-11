/**
 * Bus instance
 */
export interface Bus {
  call (path: string, data?: any): Promise<any>

  call (tabId: number, path: string, data?: any): Promise<any>

  assign (handlers: Handlers<Handler>): Bus

  handlers: Handlers<Handler>
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
  handlers?: Handlers<Handler>
  onError?: 'warn' | 'reject' | ((request: BusRequest, response: BusResponse) => void)
}

/**
 * Bus handler
 */
export type Handler = (value: any, sender: chrome.runtime.MessageSender, tab?: chrome.tabs.Tab) => any | Promise<any>

/**
 * Bus handler block
 */
export type Handlers<T> = {
  [key: string]: Handlers<T> | T
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

// Bus error
export type BusError = 'no target' | 'no handler' | 'runtime error' | 'unknown' | string
