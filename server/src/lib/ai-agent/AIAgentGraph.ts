import { StateGraph, END, START } from '@langchain/langgraph';
import { OpenAIRealtimeService } from './services/OpenAIRealtimeService.js';
import { EventEmitter } from 'events';

interface AgentState {
  openAIService: OpenAIRealtimeService;
  connectionId: string;
  input: any;
  events: any[];
}

class AIAgentNode extends EventEmitter {
  private openAIService: OpenAIRealtimeService;

  constructor(openAIApiKey: string) {
    super();
    this.openAIService = new OpenAIRealtimeService(openAIApiKey);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.openAIService.on('connected', () => this.emit('connected'));
    this.openAIService.on('error', (error) => this.emit('error', error));
    this.openAIService.on('audio.delta', (audioBase64) => this.emit('audio.delta', audioBase64));
    this.openAIService.on('text.delta', (textDelta) => this.emit('text.delta', textDelta));
    this.openAIService.on('speech.started', () => this.emit('speech.started'));
    this.openAIService.on('speech.stopped', () => this.emit('speech.stopped'));
    this.openAIService.on('response.done', (response) => this.emit('response.done', response));
    this.openAIService.on('session.closing', (event) => this.emit('session.closing', event));
  }

  public getService(): OpenAIRealtimeService {
    return this.openAIService;
  }

  async handle(state: AgentState): Promise<Partial<AgentState>> {
    const { input } = state;

    switch (input.type) {
      case 'start_session':
        if (!this.openAIService.connected) {
          await this.openAIService.connect();
        }
        break;
      case 'stop_session':
        // The graph manages disconnection based on active connections
        break;
      case 'audio_data':
        if (this.openAIService.connected) {
          this.openAIService.sendAudioData(input.data);
        }
        break;
      case 'disconnect':
        if (this.openAIService.connected) {
            this.openAIService.disconnect();
        }
        break;
    }
    return { events: [...state.events, input] };
  }
}

export class AIAgentGraph extends EventEmitter {
  private graph: any;
  private agentNode: AIAgentNode;

  constructor(openAIApiKey: string) {
    super();
    this.agentNode = new AIAgentNode(openAIApiKey);
    this.setupAgentEventForwarding();

    const workflow = new StateGraph<AgentState>({
      channels: {
        openAIService: null,
        connectionId: null,
        input: null,
        events: {
          value: (x: any[], y: any[]) => x.concat(y),
          default: () => [],
        },
      },
    });

    workflow.addNode('agent', this.agentNode.handle.bind(this.agentNode));
    workflow.addEdge(START, 'agent');
    workflow.addEdge('agent', END);

    this.graph = workflow.compile();
  }

  private setupAgentEventForwarding(): void {
    const events = ['connected', 'error', 'audio.delta', 'text.delta', 'speech.started', 'speech.stopped', 'response.done', 'session.closing'];
    for (const event of events) {
      this.agentNode.on(event, (payload) => this.emit(event, payload));
    }
  }

  public getOpenAIService(): OpenAIRealtimeService {
    return this.agentNode.getService();
  }

  async invoke(connectionId: string, input: any): Promise<void> {
    const initialState: AgentState = {
      openAIService: this.agentNode.getService(),
      connectionId: connectionId,
      input: input,
      events: [],
    };
    await this.graph.invoke(initialState);
  }
} 