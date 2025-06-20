export interface BaseMessage {
  type: string;
  connectionId?: string;
  timestamp?: Date;
}

export interface TextMessage extends BaseMessage {
  type: 'text' | 'echo' | 'error' | 'connected' | 'binary' | 'ai_text_response' | 'speech_detected' | 'ai_session_started' | 'ai_session_stopped';
  data?: any;
  message?: string;
}

export interface BinaryMessage extends BaseMessage {
  type: 'binary_metadata';
  dataType: string;
  size: number;
  toConnectionId?: string;
  fromConnectionId?: string;
}

export interface AudioMessage extends BaseMessage {
  type: 'request_test_audio' | 'audio_data' | 'start_ai_session' | 'stop_ai_session';
  format?: string;
  sampleRate?: number;
  data?: any;
}

export type Message = TextMessage | BinaryMessage | AudioMessage;

export interface MessageHandlerContext {
  connectionId: string;
  message: Message;
  binaryData?: ArrayBuffer;
} 