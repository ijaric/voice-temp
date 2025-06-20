# Talio Server

WebSocket voice server for the Talio application. Handles real-time audio communication between clients.

## Features

- WebSocket server for real-time voice communication
- Express.js REST API endpoints
- Test audio generation for development
- Connection management and tracking

## Development

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/connections` - List active WebSocket connections
- `POST /api/send-test-audio/:connectionId` - Send test audio to specific connection

## WebSocket

Connect to `ws://localhost:3002/api/voice` for voice communication.

### Message Types

- `connected` - Server welcome message with connection ID
- `request_test_audio` - Request test audio from server
- `echo` - Server echo response
- `binary_metadata` - Metadata before binary audio data

## Environment

- Port: 3002
- WebSocket path: `/api/voice` 