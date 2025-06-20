"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionRepository = void 0;
const ws_1 = require("ws");
class ConnectionRepository {
    constructor() {
        this.connections = new Map();
        this.startTime = Date.now();
    }
    add(connection) {
        this.connections.set(connection.id, connection);
    }
    remove(connectionId) {
        return this.connections.delete(connectionId);
    }
    get(connectionId) {
        return this.connections.get(connectionId);
    }
    getAll() {
        return Array.from(this.connections.values());
    }
    getActive() {
        return this.getAll().filter(conn => conn.ws.readyState === ws_1.WebSocket.OPEN);
    }
    exists(connectionId) {
        return this.connections.has(connectionId);
    }
    updateLastActivity(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.lastActivity = new Date();
        }
    }
    getStats() {
        const active = this.getActive();
        return {
            totalConnections: this.connections.size,
            activeConnections: active.length,
            connectionIds: active.map(conn => conn.id),
            uptime: Date.now() - this.startTime
        };
    }
    clear() {
        this.connections.clear();
    }
}
exports.ConnectionRepository = ConnectionRepository;
//# sourceMappingURL=ConnectionRepository.js.map