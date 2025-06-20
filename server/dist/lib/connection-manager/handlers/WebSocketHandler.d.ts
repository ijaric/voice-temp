import { WebSocketServer } from 'ws';
import { Server } from 'http';
import { IConnectionService } from '../services/ConnectionService';
export interface WebSocketHandlerConfig {
    server: Server;
    path?: string;
}
export declare class WebSocketHandler {
    private config;
    private connectionService;
    private wss;
    constructor(config: WebSocketHandlerConfig, connectionService: IConnectionService);
    private setupWebSocketServer;
    private handleIncomingMessage;
    getWebSocketServer(): WebSocketServer;
    close(): void;
}
//# sourceMappingURL=WebSocketHandler.d.ts.map