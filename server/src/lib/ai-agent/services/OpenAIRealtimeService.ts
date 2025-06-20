import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface RealtimeSessionConfig {
  model: string;
  voice: string;
  input_audio_format: string;
  output_audio_format: string;
  instructions?: string;
  modalities?: string[];
  input_audio_transcription?: {
    model: string;
  };
  turn_detection?: {
    type: string;
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
  tools?: any[];
  tool_choice?: string;
  temperature?: number;
  max_response_output_tokens?: number | string;
}

export interface RealtimeEvent {
  type: string;
  event_id?: string;
  [key: string]: any;
}

export class OpenAIRealtimeService extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private isConnected: boolean = false;
  private sessionConfig: RealtimeSessionConfig;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.sessionConfig = {
      model: 'gpt-4o-realtime-preview-2024-10-01',
      voice: 'sage',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      modalities: ['text', 'audio'],
      instructions: 'You are receiving a call from a customer. Greet customer and collect their name, company name, and their role in the company. Once you have gathered all three pieces of information, say goodbye and call the close_session tool to end the call.',
      input_audio_transcription: {
        model: 'whisper-1'
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 200
      },
      tools: [
        {
          type: 'function',
          name: 'close_session',
          description: 'Closes the current connection and ends the session',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ],
      tool_choice: 'auto',
      temperature: 0.8,
      max_response_output_tokens: 4096
    };
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Already connected to OpenAI Realtime API');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17';
        this.ws = new WebSocket(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        this.ws.on('open', () => {
          console.log('Connected to OpenAI Realtime API');
          this.isConnected = true;
          this.updateSession();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const event: RealtimeEvent = JSON.parse(data.toString());
            this.handleEvent(event);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`WebSocket closed: ${code} - ${reason}`);
          this.isConnected = false;
          this.ws = null;
          this.emit('disconnected', { code, reason });
        });

      } catch (error) {
        console.error('Failed to connect to OpenAI Realtime API:', error);
        reject(error);
      }
    });
  }

  private updateSession(): void {
    if (!this.isConnected || !this.ws) {
      console.error('Cannot update session: not connected');
      return;
    }

    const sessionUpdateEvent: RealtimeEvent = {
      type: 'session.update',
      session: this.sessionConfig
    };

    this.sendEvent(sessionUpdateEvent);
    console.log('Session updated with configuration:', this.sessionConfig);
  }

  private handleFunctionCall(event: RealtimeEvent): void {
    console.log('Function call completed:', event);
    
    if (event.name === 'close_session') {
      console.log('Close session tool called - disconnecting...');
      this.emit('session.closing', event);
      setTimeout(() => {
        this.disconnect();
      }, 100); // Small delay to allow any final responses
    }
  }

  private handleEvent(event: RealtimeEvent): void {
    console.log(`Received event: ${event.type}`);
    
    switch (event.type) {
      case 'session.created':
        console.log('Session created:', event);
        this.emit('session.created', event);
        break;
      
      case 'session.updated':
        console.log('Session updated:', event);
        this.emit('session.updated', event);
        break;
      
      case 'input_audio_buffer.committed':
        this.emit('input_audio_buffer.committed', event);
        break;
      
      case 'input_audio_buffer.speech_started':
        this.emit('speech.started', event);
        break;
      
      case 'input_audio_buffer.speech_stopped':
        this.emit('speech.stopped', event);
        break;
      
      case 'conversation.item.created':
        this.emit('conversation.item.created', event);
        break;
      
      case 'conversation.item.input_audio_transcription.completed':
        this.emit('transcription.completed', event);
        break;
      
      case 'conversation.item.input_audio_transcription.failed':
        this.emit('transcription.failed', event);
        break;
      
      case 'response.created':
        this.emit('response.created', event);
        break;
      
      case 'response.output_item.added':
        this.emit('response.output_item.added', event);
        break;
      
      case 'response.content_part.added':
        this.emit('response.content_part.added', event);
        break;
      
      case 'response.audio.delta':
        this.emit('audio.delta', event.delta);
        break;
      
      case 'response.audio.done':
        this.emit('audio.done', event);
        break;
      
      case 'response.text.delta':
        this.emit('text.delta', event.delta);
        break;
      
      case 'response.text.done':
        this.emit('text.done', event);
        break;
      
      case 'response.done':
        this.emit('response.done', event);
        break;
      
      case 'response.function_call_arguments.done':
        this.handleFunctionCall(event);
        break;
      
      case 'error':
        console.error('OpenAI Realtime API error:', event);
        this.emit('error', event);
        break;
      
      default:
        console.log('Unhandled event type:', event.type);
        this.emit('event', event);
    }
  }

  sendEvent(event: RealtimeEvent): void {
    if (!this.isConnected || !this.ws) {
      console.error('Cannot send event: not connected');
      return;
    }

    try {
      if (!event.event_id) {
        event.event_id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      this.ws.send(JSON.stringify(event));
      console.log('Sent event:', event.type);
    } catch (error) {
      console.error('Error sending event:', error);
    }
  }

  sendAudioData(audioData: ArrayBuffer): void {
    if (!this.isConnected) {
      console.error('Cannot send audio: not connected');
      return;
    }

    const audioBase64 = Buffer.from(audioData).toString('base64');
    const event: RealtimeEvent = {
      type: 'input_audio_buffer.append',
      audio: audioBase64
    };

    this.sendEvent(event);
  }

  commitAudioBuffer(): void {
    const event: RealtimeEvent = {
      type: 'input_audio_buffer.commit'
    };
    this.sendEvent(event);
  }

  clearAudioBuffer(): void {
    const event: RealtimeEvent = {
      type: 'input_audio_buffer.clear'
    };
    this.sendEvent(event);
  }

  generateResponse(responseConfig?: { modalities?: string[] }): void {
    const event: RealtimeEvent = {
      type: 'response.create',
      response: {
        modalities: responseConfig?.modalities || ['text', 'audio']
      }
    };
    this.sendEvent(event);
  }

  cancelResponse(): void {
    const event: RealtimeEvent = {
      type: 'response.cancel'
    };
    this.sendEvent(event);
  }

  createConversationItem(item: {
    type: 'message' | 'function_call' | 'function_call_output';
    role?: 'user' | 'assistant' | 'system';
    content?: any[];
    call_id?: string;
    output?: string;
  }): void {
    const event: RealtimeEvent = {
      type: 'conversation.item.create',
      item
    };
    this.sendEvent(event);
  }

  deleteConversationItem(itemId: string): void {
    const event: RealtimeEvent = {
      type: 'conversation.item.delete',
      item_id: itemId
    };
    this.sendEvent(event);
  }

  truncateConversationItem(itemId: string, contentIndex: number, audioEndMs: number): void {
    const event: RealtimeEvent = {
      type: 'conversation.item.truncate',
      item_id: itemId,
      content_index: contentIndex,
      audio_end_ms: audioEndMs
    };
    this.sendEvent(event);
  }

  updateSessionConfig(config: Partial<RealtimeSessionConfig>): void {
    this.sessionConfig = { ...this.sessionConfig, ...config };
    if (this.isConnected) {
      this.updateSession();
    }
  }

  getSessionConfig(): RealtimeSessionConfig {
    return { ...this.sessionConfig };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  get connected(): boolean {
    return this.isConnected;
  }
} 