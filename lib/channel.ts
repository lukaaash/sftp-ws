export interface IChannel {
    on(event: string, listener: Function): IChannel;
    send(packet: Buffer): void;
    close(reason?: CloseReason|number, description?: string): void;
}

export const enum CloseReason {
    NORMAL = 1000,                    // Normal closure; the connection successfully completed whatever purpose for which it was created.
    GOING_AWAY = 1001,                // The endpoint is going away, either because of a server failure or because the browser is navigating away from the page that opened the connection.
    PROTOCOL_ERROR = 1002,            // The endpoint is terminating the connection due to a protocol error.
    UNSUPPORTED = 1003,               // The connection is being terminated because the endpoint received data of a type it cannot accept (for example, a text-only endpoint received binary data).
    NO_STATUS = 1005,                 // Indicates that no status code was provided even though one was expected.
    ABNORMAL = 1006,                  // Used to indicate that a connection was closed abnormally (that is, with no close frame being sent) when a status code is expected.
    BAD_DATA = 1007,	              // The endpoint is terminating the connection because a message was received that contained inconsistent data (e.g., non-UTF-8 data within a text message).
    POLICY_VIOLATION = 1008,          // The endpoint is terminating the connection because it received a message that violates its policy.This is a generic status code, used when codes 1003 and 1009 are not suitable.
    TOO_LARGE = 1009,                 // The endpoint is terminating the connection because a data frame was received that is too large.
    NO_EXTENSIONS_NEGOTIATED = 1010,  // The client is terminating the connection because it expected the server to negotiate one or more extension, but the server didn't.
    UNEXPECTED_CONDITION = 1011,      // The server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.
    FAILED_TLS_HANDSHAKE = 1015,      // Indicates that the connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).
}
