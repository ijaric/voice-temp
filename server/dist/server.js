"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const fs_1 = require("fs");
const path_1 = require("path");
const connection_manager_1 = require("./lib/connection-manager");
const ai_agent_1 = require("./lib/ai-agent");
const app = (0, express_1.default)();
const port = 3002;
app.use(express_1.default.json());
// Enable CORS for all origins (for development)
app.use((0, cors_1.default)());
// Create HTTP server
const server = (0, http_1.createServer)(app);
// Initialize connection manager components
const connectionRepository = new connection_manager_1.ConnectionRepository();
const connectionService = new connection_manager_1.ConnectionService(connectionRepository);
// Initialize message handler
const messageHandler = new ai_agent_1.MessageHandler(connectionService);
// Set up message handlers
connectionService.onMessage(messageHandler.handleMessage.bind(messageHandler));
// Set up connection event handlers
connectionService.onConnection(messageHandler.handleConnection.bind(messageHandler));
connectionService.onDisconnection(messageHandler.handleDisconnection.bind(messageHandler));
// Initialize WebSocket handler
const webSocketHandler = new connection_manager_1.WebSocketHandler({ server, path: '/api/voice' }, connectionService);
// Read test audio file and extract PCM data
function getTestAudioFromFile() {
    try {
        // Read the WAV file from the root directory
        const wavFilePath = (0, path_1.join)(__dirname, '../../pcm16_24khz_mono_test_tone.wav');
        console.log(`Attempting to read WAV file from: ${wavFilePath}`);
        const wavBuffer = (0, fs_1.readFileSync)(wavFilePath);
        console.log(`WAV file loaded: ${wavBuffer.length} total bytes`);
        // Parse WAV header to find data chunk
        let dataChunkOffset = 44; // Default assumption
        let dataChunkSize = 0;
        // Check if it's a valid WAV file
        const riffHeader = wavBuffer.toString('ascii', 0, 4);
        const waveHeader = wavBuffer.toString('ascii', 8, 12);
        if (riffHeader !== 'RIFF' || waveHeader !== 'WAVE') {
            console.error('Not a valid WAV file');
            throw new Error('Invalid WAV file format');
        }
        // Find the data chunk
        let offset = 12; // Start after RIFF header
        while (offset < wavBuffer.length - 8) {
            const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
            const chunkSize = wavBuffer.readUInt32LE(offset + 4);
            console.log(`Found chunk: ${chunkId}, size: ${chunkSize}`);
            if (chunkId === 'data') {
                dataChunkOffset = offset + 8;
                dataChunkSize = chunkSize;
                break;
            }
            offset += 8 + chunkSize;
            // Align to even byte boundary
            if (chunkSize % 2 === 1)
                offset++;
        }
        if (dataChunkSize === 0) {
            console.error('Data chunk not found in WAV file');
            throw new Error('Data chunk not found');
        }
        console.log(`Data chunk found: offset=${dataChunkOffset}, size=${dataChunkSize}`);
        // Extract PCM data
        const pcmData = wavBuffer.slice(dataChunkOffset, dataChunkOffset + dataChunkSize);
        // Convert Buffer to ArrayBuffer
        const arrayBuffer = new ArrayBuffer(pcmData.length);
        const view = new Uint8Array(arrayBuffer);
        view.set(pcmData);
        console.log(`Extracted PCM data: ${pcmData.length} bytes`);
        // Log first few samples for debugging
        const sampleView = new Int16Array(arrayBuffer, 0, Math.min(10, pcmData.length / 2));
        console.log(`First 10 PCM samples:`, Array.from(sampleView));
        return arrayBuffer;
    }
    catch (error) {
        console.error('Error reading test audio file:', error);
        console.log('Falling back to generated audio');
        // Fallback to generated audio if file can't be read
        return generateTestAudio(440, 2000);
    }
}
// Generate test PCM16 24kHz mono audio (sine wave)
function generateTestAudio(frequency = 440, durationMs = 1000) {
    const sampleRate = 24000;
    const samples = Math.floor(sampleRate * durationMs / 1000);
    const buffer = new ArrayBuffer(samples * 2); // 2 bytes per sample for PCM16
    const view = new DataView(buffer);
    for (let i = 0; i < samples; i++) {
        // Generate sine wave
        const t = i / sampleRate;
        const sample = Math.sin(2 * Math.PI * frequency * t);
        // Convert to 16-bit signed integer
        const pcm16Sample = Math.round(sample * 0x7FFF);
        // Write as little-endian 16-bit signed integer
        view.setInt16(i * 2, pcm16Sample, true);
    }
    return buffer;
}
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
    });
});
server.listen(port, () => {
    console.log(`API running at http://localhost:${port}`);
    console.log(`WebSocket server listening on ws://localhost:${port}/api/voice`);
});
//# sourceMappingURL=server.js.map