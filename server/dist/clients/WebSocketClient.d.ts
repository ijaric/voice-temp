import { Message } from '../lib/connection-manager/domain/models';
export interface WebSocketClientConfig {
    url: string;
    protocols?: string | string[];
    reconnectAttempts?: number;
    reconnectDelay?: number;
}
export interface WebSocketClientEvents {
    onOpen?: () => void;
    onClose?: (code: number, reason: string) => void;
    onError?: (error: Error) => void;
    onMessage?: (message: Message) => void;
    onBinaryData?: (data: ArrayBuffer, metadata?: any) => void;
}
export declare class WebSocketClient {
    private ws;
    private config;
    private events;
    private reconnectAttempts;
    private isReconnecting;
    private pendingBinaryData;
    constructor(config: WebSocketClientConfig, events?: WebSocketClientEvents);
    connect(): Promise<void>;
    disconnect(): void;
    sendMessage(message: Message): boolean;
    sendBinaryData(data: ArrayBuffer, metadata?: any): boolean;
    isConnected(): boolean;
    getReadyState(): number | null;
    private handleIncomingMessage;
    private handleBinaryData;
    private prepareBinaryDataReception;
    private serializeMessage;
    private deserializeMessage;
    private shouldReconnect;
    private attemptReconnection;
}
//# sourceMappingURL=WebSocketClient.d.ts.map