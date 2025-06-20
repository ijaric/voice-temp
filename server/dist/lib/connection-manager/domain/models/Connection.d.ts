import { WebSocket } from 'ws';
export interface Connection {
    id: string;
    ws: WebSocket;
    createdAt: Date;
    lastActivity: Date;
    metadata?: Record<string, any>;
}
export interface ConnectionMetadata {
    userAgent?: string;
    ip?: string;
    [key: string]: any;
}
//# sourceMappingURL=Connection.d.ts.map