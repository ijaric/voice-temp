"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionService = void 0;
const ws_1 = require("ws");
const uuid_1 = require("uuid");
class ConnectionService {
    constructor(connectionRepository) {
        this.connectionRepository = connectionRepository;
        this.messageHandlers = [];
        this.connectionHandlers = [];
        this.disconnectionHandlers = [];
    }
    addConnection(ws, metadata) {
        const connection = {
            id: (0, uuid_1.v4)(),
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
    removeConnection(connectionId) {
        const connection = this.connectionRepository.get(connectionId);
        const removed = this.connectionRepository.remove(connectionId);
        if (removed && connection) {
            // Notify disconnection handlers
            this.disconnectionHandlers.forEach(handler => handler(connection));
        }
        return removed;
    }
    getConnection(connectionId) {
        return this.connectionRepository.get(connectionId);
    }
    async sendMessage(connectionId, message) {
        const connection = this.connectionRepository.get(connectionId);
        if (!connection || connection.ws.readyState !== ws_1.WebSocket.OPEN) {
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
        }
        catch (error) {
            console.error(`Error sending message to ${connectionId}:`, error);
            return false;
        }
    }
    async sendBinaryData(connectionId, data, metadata) {
        const connection = this.connectionRepository.get(connectionId);
        if (!connection || connection.ws.readyState !== ws_1.WebSocket.OPEN) {
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
        }
        catch (error) {
            console.error(`Error sending binary data to ${connectionId}:`, error);
            return false;
        }
    }
    async broadcastMessage(message, excludeConnectionId) {
        const connections = this.connectionRepository.getActive();
        const promises = connections
            .filter(conn => conn.id !== excludeConnectionId)
            .map(conn => this.sendMessage(conn.id, message));
        await Promise.allSettled(promises);
    }
    async broadcastBinaryData(data, metadata, excludeConnectionId) {
        const connections = this.connectionRepository.getActive();
        const promises = connections
            .filter(conn => conn.id !== excludeConnectionId)
            .map(conn => this.sendBinaryData(conn.id, data, metadata));
        await Promise.allSettled(promises);
    }
    getStats() {
        return this.connectionRepository.getStats();
    }
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    onConnection(handler) {
        this.connectionHandlers.push(handler);
    }
    onDisconnection(handler) {
        this.disconnectionHandlers.push(handler);
    }
    // Internal method to handle incoming messages
    async handleMessage(connectionId, message, binaryData) {
        this.connectionRepository.updateLastActivity(connectionId);
        const context = {
            connectionId,
            message,
            binaryData
        };
        // Execute all message handlers
        for (const handler of this.messageHandlers) {
            try {
                await handler(context);
            }
            catch (error) {
                console.error(`Error in message handler for ${connectionId}:`, error);
            }
        }
    }
}
exports.ConnectionService = ConnectionService;
//# sourceMappingURL=ConnectionService.js.map