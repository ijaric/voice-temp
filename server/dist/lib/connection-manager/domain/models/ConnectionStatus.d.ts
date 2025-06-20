export declare enum ConnectionState {
    CONNECTING = "connecting",
    CONNECTED = "connected",
    DISCONNECTING = "disconnecting",
    DISCONNECTED = "disconnected",
    ERROR = "error"
}
export interface ConnectionStatus {
    state: ConnectionState;
    lastUpdate: Date;
    error?: string;
}
export interface ConnectionStats {
    totalConnections: number;
    activeConnections: number;
    connectionIds: string[];
    uptime: number;
}
//# sourceMappingURL=ConnectionStatus.d.ts.map