import { Connection, ConnectionStats } from '../domain/models';
import { WebSocket } from 'ws';

export interface IConnectionRepository {
  add(connection: Connection): void;
  remove(connectionId: string): boolean;
  get(connectionId: string): Connection | undefined;
  getAll(): Connection[];
  getActive(): Connection[];
  exists(connectionId: string): boolean;
  updateLastActivity(connectionId: string): void;
  getStats(): ConnectionStats;
  clear(): void;
}

export class ConnectionRepository implements IConnectionRepository {
  private connections = new Map<string, Connection>();
  private startTime = Date.now();

  add(connection: Connection): void {
    this.connections.set(connection.id, connection);
  }

  remove(connectionId: string): boolean {
    return this.connections.delete(connectionId);
  }

  get(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  getAll(): Connection[] {
    return Array.from(this.connections.values());
  }

  getActive(): Connection[] {
    return this.getAll().filter(conn => 
      conn.ws.readyState === WebSocket.OPEN
    );
  }

  exists(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  updateLastActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  getStats(): ConnectionStats {
    const active = this.getActive();
    return {
      totalConnections: this.connections.size,
      activeConnections: active.length,
      connectionIds: active.map(conn => conn.id),
      uptime: Date.now() - this.startTime
    };
  }

  clear(): void {
    this.connections.clear();
  }
} 