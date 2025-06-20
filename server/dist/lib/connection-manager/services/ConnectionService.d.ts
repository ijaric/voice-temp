import { WebSocket } from 'ws';
import { Connection, Message, MessageHandlerContext, ConnectionStats } from '../domain/models';
import { IConnectionRepository } from '../repositories/ConnectionRepository';
export type MessageHandler = (context: MessageHandlerContext) => Promise<void> | void;
export type ConnectionEventHandler = (connection: Connection) => void;
export interface IConnectionService {
    addConnection(ws: WebSocket, metadata?: Record<string, any>): Connection;
    removeConnection(connectionId: string): boolean;
    getConnection(connectionId: string): Connection | undefined;
    sendMessage(connectionId: string, message: Message): Promise<boolean>;
    sendBinaryData(connectionId: string, data: ArrayBuffer, metadata?: any): Promise<boolean>;
    broadcastMessage(message: Message, excludeConnectionId?: string): Promise<void>;
    broadcastBinaryData(data: ArrayBuffer, metadata?: any, excludeConnectionId?: string): Promise<void>;
    getStats(): ConnectionStats;
    onMessage(handler: MessageHandler): void;
    onConnection(handler: ConnectionEventHandler): void;
    onDisconnection(handler: ConnectionEventHandler): void;
    handleMessage(connectionId: string, message: Message, binaryData?: ArrayBuffer): Promise<void>;
}
export declare class ConnectionService implements IConnectionService {
    private connectionRepository;
    private messageHandlers;
    private connectionHandlers;
    private disconnectionHandlers;
    constructor(connectionRepository: IConnectionRepository);
    addConnection(ws: WebSocket, metadata?: Record<string, any>): Connection;
    removeConnection(connectionId: string): boolean;
    getConnection(connectionId: string): Connection | undefined;
    sendMessage(connectionId: string, message: Message): Promise<boolean>;
    sendBinaryData(connectionId: string, data: ArrayBuffer, metadata?: any): Promise<boolean>;
    broadcastMessage(message: Message, excludeConnectionId?: string): Promise<void>;
    broadcastBinaryData(data: ArrayBuffer, metadata?: any, excludeConnectionId?: string): Promise<void>;
    getStats(): ConnectionStats;
    onMessage(handler: MessageHandler): void;
    onConnection(handler: ConnectionEventHandler): void;
    onDisconnection(handler: ConnectionEventHandler): void;
    handleMessage(connectionId: string, message: Message, binaryData?: ArrayBuffer): Promise<void>;
}
//# sourceMappingURL=ConnectionService.d.ts.map