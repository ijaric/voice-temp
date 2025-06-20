"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.demonstrateAIAgent = demonstrateAIAgent;
const WebSocketClient_1 = require("../clients/WebSocketClient");
// Example demonstrating AI Agent integration
async function demonstrateAIAgent() {
    const client = new WebSocketClient_1.WebSocketClient({ url: 'ws://localhost:3002/api/voice' }, {
        onOpen: () => {
            console.log('Connected to server');
            // Send AI requests
            setTimeout(() => {
                client.sendMessage({
                    type: 'text',
                    data: 'Hello, AI assistant!'
                });
            }, 1000);
            setTimeout(() => {
                client.sendMessage({
                    type: 'text',
                    data: 'Can you help me with something?'
                });
            }, 3000);
            setTimeout(() => {
                client.sendMessage({
                    type: 'text',
                    data: 'This is a test message'
                });
            }, 5000);
        },
        onMessage: (message) => {
            console.log('Received message:', message);
        },
        onError: (error) => {
            console.error('WebSocket error:', error);
        },
        onClose: (code, reason) => {
            console.log(`Connection closed: ${code} - ${reason}`);
        }
    });
    try {
        await client.connect();
        console.log('AI Agent demo started. Check the console for AI responses.');
        // Keep the demo running for 30 seconds
        setTimeout(() => {
            console.log('Demo complete. Disconnecting...');
            client.disconnect();
        }, 30000);
    }
    catch (error) {
        console.error('Failed to connect:', error);
    }
}
// Run the demo if this file is executed directly
if (require.main === module) {
    demonstrateAIAgent().catch(console.error);
}
//# sourceMappingURL=ai-agent-example.js.map