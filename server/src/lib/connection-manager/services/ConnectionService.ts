import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
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

export class ConnectionService implements IConnectionService {
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionEventHandler[] = [];
  private disconnectionHandlers: ConnectionEventHandler[] = [];

  constructor(private connectionRepository: IConnectionRepository) {}

  addConnection(ws: WebSocket, metadata?: Record<string, any>): Connection {
    const connection: Connection = {
      id: uuidv4(),
      ws,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata
    };

    this.connectionRepository.add(connection);
    
    // Notify connection handlers
    this.connectionHandlers.forEach(handler => handler(connection));

    return connection;
  }

  removeConnection(connectionId: string): boolean {
    const connection = this.connectionRepository.get(connectionId);
    const removed = this.connectionRepository.remove(connectionId);
    
    if (removed && connection) {
      // Notify disconnection handlers
      this.disconnectionHandlers.forEach(handler => handler(connection));
    }
    
    return removed;
  }

  getConnection(connectionId: string): Connection | undefined {
    return this.connectionRepository.get(connectionId);
  }

  async sendMessage(connectionId: string, message: Message): Promise<boolean> {
    const connection = this.connectionRepository.get(connectionId);
    
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      // Add connection ID and timestamp to message
      const messageWithMeta = {
        ...message,
        connectionId,
        timestamp: new Date()
      };

      connection.ws.send(JSON.stringify(messageWithMeta));
      this.connectionRepository.updateLastActivity(connectionId);
      return true;
    } catch (error) {
      console.error(`Error sending message to ${connectionId}:`, error);
      return false;
    }
  }

  async sendBinaryData(connectionId: string, data: ArrayBuffer, metadata?: any): Promise<boolean> {
    const connection = this.connectionRepository.get(connectionId);
    
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      // Send metadata first if provided
      if (metadata) {
        await this.sendMessage(connectionId, {
          type: 'binary_metadata',
          dataType: metadata.dataType || 'binary',
          size: data.byteLength,
          toConnectionId: connectionId,
          ...metadata
        });
      }

      // Send binary data
      connection.ws.send(data);
      this.connectionRepository.updateLastActivity(connectionId);
      return true;
    } catch (error) {
      console.error(`Error sending binary data to ${connectionId}:`, error);
      return false;
    }
  }

  async broadcastMessage(message: Message, excludeConnectionId?: string): Promise<void> {
    const connections = this.connectionRepository.getActive();
    
    const promises = connections
      .filter(conn => conn.id !== excludeConnectionId)
      .map(conn => this.sendMessage(conn.id, message));

    await Promise.allSettled(promises);
  }

  async broadcastBinaryData(data: ArrayBuffer, metadata?: any, excludeConnectionId?: string): Promise<void> {
    const connections = this.connectionRepository.getActive();
    
    const promises = connections
      .filter(conn => conn.id !== excludeConnectionId)
      .map(conn => this.sendBinaryData(conn.id, data, metadata));

    await Promise.allSettled(promises);
  }

  getStats(): ConnectionStats {
    return this.connectionRepository.getStats();
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onConnection(handler: ConnectionEventHandler): void {
    this.connectionHandlers.push(handler);
  }

  onDisconnection(handler: ConnectionEventHandler): void {
    this.disconnectionHandlers.push(handler);
  }

  // Internal method to handle incoming messages
  async handleMessage(connectionId: string, message: Message, binaryData?: ArrayBuffer): Promise<void> {
    this.connectionRepository.updateLastActivity(connectionId);
    
    const context: MessageHandlerContext = {
      connectionId,
      message,
      binaryData
    };

    // Execute all message handlers
    for (const handler of this.messageHandlers) {
      try {
        await handler(context);
      } catch (error) {
        console.error(`Error in message handler for ${connectionId}:`, error);
      }
    }
  }
} 