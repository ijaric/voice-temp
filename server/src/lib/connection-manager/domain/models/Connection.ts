import { WebSocket } from 'ws';

export interface Connection {
  id: string;
  ws: WebSocket;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
} 