export interface BaseMessage {
    type: string;
    connectionId?: string;
    timestamp?: Date;
}
export interface TextMessage extends BaseMessage {
    type: 'text' | 'echo' | 'error' | 'connected' | 'binary';
    data?: any;
    message?: string;
}
export interface BinaryMessage extends BaseMessage {
    type: 'binary_metadata';
    dataType: string;
    size: number;
    toConnectionId?: string;
    fromConnectionId?: string;
}
export interface AudioMessage extends BaseMessage {
    type: 'request_test_audio';
    format?: string;
    sampleRate?: number;
}
export type Message = TextMessage | BinaryMessage | AudioMessage;
export interface MessageHandlerContext {
    connectionId: string;
    message: Message;
    binaryData?: ArrayBuffer;
}
//# sourceMappingURL=Message.d.ts.map