import { ConnectionService, MessageHandlerContext, Connection } from '../../connection-manager';
import { AudioService } from '../services/AudioService';
import { OpenAIRealtimeService } from '../services/OpenAIRealtimeService';

export class MessageHandler {
  private openAIService: OpenAIRealtimeService;
  private activeConnections = new Map<string, { openAIConnected: boolean }>();

  constructor(
    private connectionService: ConnectionService,
    private audioService: AudioService,
    openAIApiKey: string
  ) {
    this.openAIService = new OpenAIRealtimeService(openAIApiKey);
    this.setupOpenAIEventHandlers();
  }

  private setupOpenAIEventHandlers(): void {
    // Handle OpenAI connection events
    this.openAIService.on('connected', () => {
      console.log('OpenAI Realtime API connected');
    });

    this.openAIService.on('error', (error) => {
      console.error('OpenAI Realtime API error:', error);
    });

    // Handle audio responses from OpenAI
    this.openAIService.on('audio.delta', async (audioBase64: string) => {
      console.log('Received audio delta from OpenAI');
      
      // Convert base64 to ArrayBuffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const arrayBuffer = audioBuffer.buffer.slice(
        audioBuffer.byteOffset,
        audioBuffer.byteOffset + audioBuffer.byteLength
      );

      // Send audio to all active connections
      for (const [connectionId, connectionState] of this.activeConnections) {
        if (connectionState.openAIConnected) {
          try {
            await this.connectionService.sendBinaryData(connectionId, arrayBuffer, {
              dataType: 'audio'
            });
          } catch (error) {
            console.error(`Failed to send audio to connection ${connectionId}:`, error);
          }
        }
      }
    });

    // Handle text responses from OpenAI
    this.openAIService.on('text.delta', async (textDelta: string) => {
      console.log('OpenAI text response:', textDelta);
      
      // Send text response to all active connections
      for (const [connectionId, connectionState] of this.activeConnections) {
        if (connectionState.openAIConnected) {
          try {
            await this.connectionService.sendMessage(connectionId, {
              type: 'ai_text_response',
              data: textDelta
            });
          } catch (error) {
            console.error(`Failed to send text to connection ${connectionId}:`, error);
          }
        }
      }
    });

    // Handle speech detection
    this.openAIService.on('speech.started', async () => {
      console.log('Speech started detected by OpenAI');
      // Notify clients that speech was detected
      for (const [connectionId, connectionState] of this.activeConnections) {
        if (connectionState.openAIConnected) {
          await this.connectionService.sendMessage(connectionId, {
            type: 'speech_detected',
            data: { status: 'started' }
          });
        }
      }
    });

    this.openAIService.on('speech.stopped', async () => {
      console.log('Speech stopped detected by OpenAI');
      // Notify clients that speech stopped
      for (const [connectionId, connectionState] of this.activeConnections) {
        if (connectionState.openAIConnected) {
          await this.connectionService.sendMessage(connectionId, {
            type: 'speech_detected',
            data: { status: 'stopped' }
          });
        }
      }
    });

    // Handle complete responses
    this.openAIService.on('response.done', (response) => {
      console.log('OpenAI response completed:', {
        id: response.response?.id,
        status: response.response?.status,
        usage: response.response?.usage
      });
    });

    // Handle session closing initiated by OpenAI
    this.openAIService.on('session.closing', async (event) => {
      console.log('OpenAI session closing, notifying all active clients', event);
      for (const [connectionId, connectionState] of this.activeConnections) {
        if (connectionState.openAIConnected) {
          // Send a specific closing event to the client
          await this.connectionService.sendMessage(connectionId, {
            type: 'ai_session_closing',
            data: { reason: 'Tool call `close_session` initiated.' }
          });
          
          // The client is now expected to close the connection after receiving this.
          // We will still stop the session on the backend.
          await this.handleStopAISession(connectionId);
        }
      }
    });
  }

  async handleMessage(context: MessageHandlerContext): Promise<void> {
    const { connectionId, message } = context;
    
    console.log(`Processing message from ${connectionId}:`, message);
    
    try {
      switch (message.type) {
        case 'start_ai_session':
          await this.handleStartAISession(connectionId);
          break;
        case 'stop_ai_session':
          await this.handleStopAISession(connectionId);
          break;
        case 'audio_data':
          await this.handleAudioData(connectionId, message.data);
          break;
        case 'audio_data_metadata':
          // This indicates that the next binary message should be treated as audio data
          console.log(`Expecting audio data from ${connectionId}: ${message.size} bytes`);
          break;
        case 'binary':
          // Handle binary data as audio if AI session is active
          const connectionState = this.activeConnections.get(connectionId);
          if (connectionState?.openAIConnected && context.binaryData) {
            console.log(`Received binary audio data from ${connectionId}: ${context.binaryData.byteLength} bytes`);
            await this.handleAudioData(connectionId, context.binaryData);
          }
          break;
        case 'request_test_audio':
          await this.handleTestAudioRequest(connectionId);
          break;
        case 'text':
          if (message.data) {
            await this.handleTextMessage(connectionId, message.data);
          }
          break;
        default:
          await this.handleEcho(connectionId, message);
      }
    } catch (error) {
      console.error(`Error processing message from ${connectionId}:`, error);
      await this.sendErrorResponse(connectionId, 'Failed to process message');
    }
  }

  async handleConnection(connection: Connection): Promise<void> {
    console.log(`New connection established: ${connection.id}`);
    this.activeConnections.set(connection.id, { openAIConnected: false });
  }

  async handleDisconnection(connection: Connection): Promise<void> {
    console.log(`Connection disconnected: ${connection.id}`);
    this.activeConnections.delete(connection.id);
    
    // If no more active connections, disconnect from OpenAI
    if (this.activeConnections.size === 0 && this.openAIService.connected) {
      console.log('No active connections remaining, disconnecting from OpenAI');
      this.openAIService.disconnect();
    }
  }

  private async handleStartAISession(connectionId: string): Promise<void> {
    console.log(`Starting AI session for ${connectionId}`);
    
    try {
      // Connect to OpenAI if not already connected
      if (!this.openAIService.connected) {
        await this.openAIService.connect();
      }
      
      // Mark this connection as using OpenAI
      const connectionState = this.activeConnections.get(connectionId);
      if (connectionState) {
        connectionState.openAIConnected = true;
      }
      
      await this.connectionService.sendMessage(connectionId, {
        type: 'ai_session_started',
        data: { status: 'connected' }
      });
      
    } catch (error) {
      console.error(`Failed to start AI session for ${connectionId}:`, error);
      await this.sendErrorResponse(connectionId, 'Failed to start AI session');
    }
  }

  private async handleStopAISession(connectionId: string): Promise<void> {
    console.log(`Stopping AI session for ${connectionId}`);
    
    const connectionState = this.activeConnections.get(connectionId);
    if (connectionState) {
      connectionState.openAIConnected = false;
    }
    
    await this.connectionService.sendMessage(connectionId, {
      type: 'ai_session_stopped',
      data: { status: 'disconnected' }
    });
  }

  private async handleAudioData(connectionId: string, audioData: any): Promise<void> {
    const connectionState = this.activeConnections.get(connectionId);
    if (!connectionState?.openAIConnected) {
      console.log(`Audio data received from ${connectionId} but AI session not active`);
      return;
    }

    if (!this.openAIService.connected) {
      console.error('OpenAI service not connected');
      return;
    }

    try {
      // Convert audio data to ArrayBuffer if needed
      let audioBuffer: ArrayBuffer;
      
      if (audioData instanceof ArrayBuffer) {
        audioBuffer = audioData;
      } else if (Buffer.isBuffer(audioData)) {
        audioBuffer = audioData.buffer.slice(
          audioData.byteOffset,
          audioData.byteOffset + audioData.byteLength
        );
      } else if (typeof audioData === 'string') {
        // Assume base64 encoded audio
        const buffer = Buffer.from(audioData, 'base64');
        audioBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        );
      } else {
        console.error('Unsupported audio data format');
        return;
      }

      console.log(`Sending audio data to OpenAI: ${audioBuffer.byteLength} bytes`);
      
      // Send audio to OpenAI
      this.openAIService.sendAudioData(audioBuffer);
      
    } catch (error) {
      console.error(`Error processing audio data from ${connectionId}:`, error);
    }
  }

  private async handleTestAudioRequest(connectionId: string): Promise<void> {
    console.log(`Processing test audio request for ${connectionId}`);
    
    const audioData = await this.audioService.getTestAudio();
    
    await this.connectionService.sendBinaryData(connectionId, audioData, {
      dataType: 'audio'
    });
  }

  private async handleTextMessage(connectionId: string, data: any): Promise<void> {
    console.log(`Processing text message from ${connectionId}:`, data);
    
    // TODO: Integrate with AI service
    const response = `Echo: ${JSON.stringify(data)}`;
    
    await this.connectionService.sendMessage(connectionId, {
      type: 'text',
      data: response
    });
  }

  private async handleEcho(connectionId: string, message: any): Promise<void> {
    await this.connectionService.sendMessage(connectionId, {
      type: 'echo',
      data: message
    });
  }

  private async sendErrorResponse(connectionId: string, errorMessage: string): Promise<void> {
    await this.connectionService.sendMessage(connectionId, {
      type: 'error',
      data: errorMessage
    });
  }
} 