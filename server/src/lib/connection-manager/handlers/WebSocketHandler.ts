import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IConnectionService } from '../services/ConnectionService';
import { Message } from '../domain/models';

export interface WebSocketHandlerConfig {
  server: Server;
  path?: string;
}

export class WebSocketHandler {
  private wss: WebSocketServer;

  constructor(
    private config: WebSocketHandlerConfig,
    private connectionService: IConnectionService
  ) {
    this.wss = new WebSocketServer({
      server: config.server,
      path: config.path || '/api/voice'
    });

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws, req) => {
      // Add connection to the service
      const connection = this.connectionService.addConnection(ws, {
        userAgent: req.headers['user-agent'],
        ip: req.socket.remoteAddress
      });

      console.log(`New WebSocket connection established: ${connection.id}`);

      // Send welcome message
      this.connectionService.sendMessage(connection.id, {
        type: 'connected',
        message: 'Connected to voice WebSocket'
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          await this.handleIncomingMessage(connection.id, data);
        } catch (error) {
          console.error(`Error handling message from ${connection.id}:`, error);
          this.connectionService.sendMessage(connection.id, {
            type: 'error',
            message: 'Error processing message'
          });
        }
      });

      // Handle connection close
      ws.on('close', () => {
        this.connectionService.removeConnection(connection.id);
        console.log(`WebSocket connection closed: ${connection.id}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${connection.id}:`, error);
        this.connectionService.removeConnection(connection.id);
      });
    });
  }

  private async handleIncomingMessage(connectionId: string, data: any): Promise<void> {
    let message: Message;
    let binaryData: ArrayBuffer | undefined;

    // Handle binary data (audio from client)
    if (data instanceof Buffer) {
      console.log(`Received binary data from ${connectionId}: ${data.length} bytes`);
      
      try {
        // Attempt to parse binary data as JSON string
        const messageString = data.toString();
        message = JSON.parse(messageString);
        console.log(`Successfully parsed JSON from buffer for ${connectionId}`);
      } catch (e) {
        console.log(`Could not parse JSON from buffer for ${connectionId}. Treating as raw binary.`);
        // If it's not valid JSON, treat as binary data
        binaryData = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        message = { type: 'binary', connectionId };
      }
    } else {
      // Handle text messages
      message = JSON.parse(data.toString());
    }

    console.log(`Received message from ${connectionId}:`, message);

    // Pass to connection service for processing
    await this.connectionService.handleMessage(connectionId, message, binaryData);
  }

  getWebSocketServer(): WebSocketServer {
    return this.wss;
  }

  close(): void {
    this.wss.close();
  }
} 