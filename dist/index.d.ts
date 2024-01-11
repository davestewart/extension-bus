/**
 * Bus instance
 */
interface Bus {
    call(path: string, data?: any): Promise<any>;
    call(tabId: number, path: string, data?: any): Promise<any>;
    assign(handlers: Handlers<Handler>): Bus;
    handlers: Handlers<Handler>;
    error: BusError;
    source: string;
    target: string | '*';
}
/**
 * Bus factory
 */
type BusFactory = (source: string, options?: BusOptions) => Bus;
/**
 * Bus options
 */
type BusOptions = {
    target?: string | '*';
    handlers?: Handlers<Handler>;
    onError?: 'warn' | 'reject' | ((request: BusRequest, response: BusResponse) => void);
};
/**
 * Bus handler
 */
type Handler = (value: any, sender: chrome.runtime.MessageSender, tab?: chrome.tabs.Tab) => any | Promise<any>;
/**
 * Bus handler block
 */
type Handlers<T> = {
    [key: string]: Handlers<T> | T;
};
/**
 * Bus request
 * @internal
 */
type BusRequest = {
    source: string;
    target: string | '*';
    path: string;
    data: any;
};
/**
 * Bus response
 * @internal
 */
type BusResponse = {
    result?: any;
    error?: BusError;
};
type BusError = 'no target' | 'no handler' | 'runtime error' | 'unknown' | string;

/**
 * Make a universal chrome messaging bus
 *
 * @param   source    The name of this messaging bus, i.e. "content", "background", "account"
 * @param   options   Optional bus configuration options, including handlers
 */
declare const makeBus: BusFactory;

export { makeBus };
