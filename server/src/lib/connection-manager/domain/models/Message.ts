export interface Message {
  type: 'echo' | 'test' | 'text' | 'binary' | 'connected' | 'error' | 'binary_metadata' | 
        'request_test_audio' | 'audio_data' | 'audio_data_metadata' | 'start_ai_session' | 'stop_ai_session' |
        'ai_text_response' | 'speech_detected' | 'ai_session_started' | 'ai_session_stopped' | 'ai_session_closing';
  data?: any;
  message?: string;
  connectionId?: string;
  fromConnectionId?: string;
  toConnectionId?: string;
  timestamp?: Date;
  size?: number;
  dataType?: string;
}

export interface MessageHandlerContext {
  connectionId: string;
  message: Message;
  binaryData?: ArrayBuffer;
}