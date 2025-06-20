"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const ws_1 = require("ws");
class WebSocketClient {
    constructor(config, events = {}) {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.pendingBinaryData = null;
        this.config = {
            reconnectAttempts: 3,
            reconnectDelay: 1000,
            ...config
        };
        this.events = events;
    }
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new ws_1.WebSocket(this.config.url, this.config.protocols);
                this.ws.binaryType = 'arraybuffer';
                this.ws.onopen = () => {
                    console.log(`WebSocket connected to ${this.config.url}`);
                    this.reconnectAttempts = 0;
                    this.isReconnecting = false;
                    this.events.onOpen?.();
                    resolve();
                };
                this.ws.onclose = (event) => {
                    console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
                    this.events.onClose?.(event.code, event.reason);
                    if (!this.isReconnecting && this.shouldReconnect(event.code)) {
                        this.attemptReconnection();
                    }
                };
                this.ws.onerror = (event) => {
                    const error = new Error(`WebSocket error: ${event.message || 'Unknown error'}`);
                    console.error('WebSocket error:', error);
                    this.events.onError?.(error);
                    reject(error);
                };
                this.ws.onmessage = (event) => {
                    this.handleIncomingMessage(event.data);
                };
            }
            catch (error) {
                reject(error);
            }
        });
    }
    disconnect() {
        this.isReconnecting = false;
        if (this.ws) {
            this.ws.close(1000, 'Client disconnecting');
            this.ws = null;
        }
    }
    sendMessage(message) {
        if (!this.isConnected()) {
            console.warn('Cannot send message: WebSocket not connected');
            return false;
        }
        try {
            const serializedMessage = this.serializeMessage(message);
            this.ws.send(serializedMessage);
            return true;
        }
        catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }
    sendBinaryData(data, metadata) {
        if (!this.isConnected()) {
            console.warn('Cannot send binary data: WebSocket not connected');
            return false;
        }
        try {
            // Send metadata first if provided
            if (metadata) {
                const metadataMessage = {
                    type: 'binary_metadata',
                    dataType: metadata.dataType || 'binary',
                    size: data.byteLength,
                    ...metadata
                };
                this.sendMessage(metadataMessage);
            }
            // Send binary data
            this.ws.send(data);
            return true;
        }
        catch (error) {
            console.error('Error sending binary data:', error);
            return false;
        }
    }
    isConnected() {
        return this.ws?.readyState === ws_1.WebSocket.OPEN;
    }
    getReadyState() {
        return this.ws?.readyState ?? null;
    }
    handleIncomingMessage(data) {
        try {
            // Handle binary data
            if (data instanceof ArrayBuffer) {
                this.handleBinaryData(data);
                return;
            }
            // Handle text messages
            const message = this.deserializeMessage(data);
            // Handle binary metadata
            if (message.type === 'binary_metadata') {
                this.prepareBinaryDataReception(message);
                return;
            }
            this.events.onMessage?.(message);
        }
        catch (error) {
            console.error('Error handling incoming message:', error);
        }
    }
    handleBinaryData(data) {
        const pending = this.pendingBinaryData;
        if (!pending) {
            console.warn('Received binary data without metadata');
            this.events.onBinaryData?.(data);
            return;
        }
        // Add chunk to pending data
        pending.chunks.push(data);
        pending.receivedSize += data.byteLength;
        // Check if we have received all data
        if (pending.receivedSize >= pending.expectedSize) {
            // Combine all chunks into single buffer
            const combinedBuffer = new ArrayBuffer(pending.expectedSize);
            const combinedView = new Uint8Array(combinedBuffer);
            let offset = 0;
            for (const chunk of pending.chunks) {
                const chunkView = new Uint8Array(chunk);
                combinedView.set(chunkView, offset);
                offset += chunk.byteLength;
            }
            // Emit the complete binary data
            this.events.onBinaryData?.(combinedBuffer, pending.metadata);
            // Clear pending data
            this.pendingBinaryData = null;
        }
    }
    prepareBinaryDataReception(message) {
        this.pendingBinaryData = {
            expectedSize: message.size,
            dataType: message.dataType,
            receivedSize: 0,
            chunks: [],
            metadata: { ...message }
        };
    }
    serializeMessage(message) {
        return JSON.stringify({
            ...message,
            timestamp: message.timestamp || new Date()
        });
    }
    deserializeMessage(data) {
        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        throw new Error('Cannot deserialize non-string message data');
    }
    shouldReconnect(closeCode) {
        // Don't reconnect on normal closure or if max attempts reached
        return closeCode !== 1000 &&
            this.reconnectAttempts < (this.config.reconnectAttempts || 3);
    }
    async attemptReconnection() {
        if (this.isReconnecting)
            return;
        this.isReconnecting = true;
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.reconnectAttempts})`);
        await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelay || 1000));
        try {
            await this.connect();
        }
        catch (error) {
            console.error('Reconnection failed:', error);
            if (this.reconnectAttempts >= (this.config.reconnectAttempts || 3)) {
                console.error('Max reconnection attempts reached');
                this.isReconnecting = false;
            }
            else {
                this.attemptReconnection();
            }
        }
    }
}
exports.WebSocketClient = WebSocketClient;
//# sourceMappingURL=WebSocketClient.js.map