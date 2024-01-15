/**
 * Extension Bus instance
 */
interface Bus {
    /**
     * Call a target bus handler
     *
     * @param path        The path to the handler
     * @param data        An optional data payload
     */
    call(path: string, data?: any): Promise<any>;
    /**
     * Call a target content script handler
     *
     * @param tabId       The id of the target tab
     * @param path        The path to the handler
     * @param data        An optional data payload
     */
    call(tabId: number, path: string, data?: any): Promise<any>;
    /**
     * Add one or more handlers to the bus
     *
     * @param name        The name of the handler or group
     * @param handlers    A single handler or hash of handlers
     */
    add(name: string, handlers: Handlers): Bus;
    /**
     * A hash of handler functions
     */
    handlers: Handlers;
    /**
     * Any current error code or message
     */
    error: BusError | null;
    /**
     * The name of the bus
     */
    source: string;
    /**
     * The name of another bus to send messages to
     */
    target?: string | '*';
}
/**
 * Create a new Extension Bus
 *
 * @param source        The name of the Bus
 * @param options       Optional configuration
 */
type BusFactory = (source: string, options?: BusOptions) => Bus;
/**
 * Bus configuration options
 *
 * @property  target    The name of a bus to target
 * @property  handlers  A hash of handler functions
 * @property  onError   Optional methods on how to handle errors
 */
type BusOptions = {
    target?: string | '*';
    handlers?: Handlers;
    onError?: 'warn' | 'reject' | ((request: BusRequest, response: BusResponse, bus: Bus) => void);
};
/**
 * Handler function
 *
 * @param value         The value passed from a Bus call
 * @param sander        An object containing information about the script context that sent a message or request
 * @param tab           The sending tab if sent from a content script (will be the same as sender.tab)
 */
type HandlerFunction = (value: any, sender: chrome.runtime.MessageSender, tab?: chrome.tabs.Tab) => any | Promise<any>;
/**
 * A single handler function or hash of handler functions
 */
type Handler = HandlerFunction | Handlers;
/**
 * Bus handler tree
 */
type Handlers = {
    [key: string]: Handler;
};
/**
 * Possible Bus error values
 */
type BusError = {
    type: BusErrorType;
    message: string;
};
/**
 * Possible Bus error values
 */
type BusErrorType = 'no_response' | 'no_handler' | 'handler_error';
/**
 * Bus request
 * @internal
 */
type BusRequest = {
    source: string;
    target: string | '*';
    path: string;
    data?: any;
};
/**
 * Bus response
 * @internal
 */
type BusResponse = {
    target: string;
    result?: any;
    error?: BusError;
};

/**
 * Make a universal chrome messaging bus
 *
 * @param   source    The name of this messaging bus, i.e. "content", "background", "account"
 * @param   options   Optional bus configuration options, including handlers
 */
declare const makeBus: BusFactory;

export { type Bus, type BusError, type BusErrorType, type BusFactory, type BusOptions, type BusRequest, type BusResponse, type Handler, type HandlerFunction, type Handlers, makeBus };
