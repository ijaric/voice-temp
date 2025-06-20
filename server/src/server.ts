import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from root .env file
config({ path: join(__dirname, '../../.env') });

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { 
  ConnectionRepository, 
  ConnectionService, 
  WebSocketHandler,
  MessageHandlerContext 
} from './lib/connection-manager';
import { MessageHandler, AudioService } from './lib/ai-agent';

const app = express();
const port = 3002;

app.use(express.json());

// Enable CORS for all origins (for development)
app.use(cors());

// Create HTTP server
const server = createServer(app);

// Get OpenAI API key from environment
const openAIApiKey = process.env.VITE_OPENAI_API_KEY;
if (!openAIApiKey) {
  console.warn('Warning: VITE_OPENAI_API_KEY environment variable not set. AI features will be disabled.');
}

// Initialize connection manager components
const connectionRepository = new ConnectionRepository();
const connectionService = new ConnectionService(connectionRepository);

// Initialize services
const audioService = new AudioService();

// Initialize message handler with dependencies
const messageHandler = new MessageHandler(
  connectionService, 
  audioService, 
  openAIApiKey || 'dummy-key'
);

// Set up message handlers
connectionService.onMessage(messageHandler.handleMessage.bind(messageHandler));

// Set up connection event handlers
connectionService.onConnection(messageHandler.handleConnection.bind(messageHandler));
connectionService.onDisconnection(messageHandler.handleDisconnection.bind(messageHandler));

// Initialize WebSocket handler
const webSocketHandler = new WebSocketHandler(
  { server, path: '/api/voice' },
  connectionService
);

// Endpoint to get active connections
app.get('/api/connections', (req, res) => {
  const stats = connectionService.getStats();
  res.json({
    activeConnections: stats.activeConnections,
    connectionIds: stats.connectionIds
  });
});

// Endpoint to validate if a company is in the food industry
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    features: {
      openai: !!openAIApiKey
    }
  });
});

server.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
  console.log(`WebSocket server listening on ws://localhost:${port}/api/voice`);
  console.log(`OpenAI integration: ${openAIApiKey ? 'Enabled' : 'Disabled (set VITE_OPENAI_API_KEY)'}`);
}); 