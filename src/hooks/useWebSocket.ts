import { useState, useRef, useEffect, useCallback } from "react";

// Audio player class for handling PCM16 24kHz mono audio
class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private audioQueue: ArrayBuffer[] = [];
  private sourceNodes: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;
  
  async initialize() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        sampleRate: 24000 // Match the PCM16 24kHz format
      });
    }
    
    // Resume audio context if suspended (required by browser policies)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
  
  // Convert PCM16 to Float32Array for Web Audio API
  private pcm16ToFloat32(pcm16Buffer: ArrayBuffer): Float32Array {
    const int16Array = new Int16Array(pcm16Buffer);
    const float32Array = new Float32Array(int16Array.length);
    
    for (let i = 0; i < int16Array.length; i++) {
      // Convert from 16-bit signed integer to float [-1, 1]
      float32Array[i] = int16Array[i] / 0x7FFF;
    }
    
    return float32Array;
  }
  
  async playAudioChunk(pcm16Data: ArrayBuffer) {
    if (!this.audioContext) {
      await this.initialize();
    }
    
    if (!this.audioContext) return;
    
    try {
      // Convert PCM16 to Float32
      const audioData = this.pcm16ToFloat32(pcm16Data);
      
      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(
        1, // mono
        audioData.length,
        24000 // 24kHz sample rate
      );
      
      // Copy data to audio buffer
      audioBuffer.copyToChannel(audioData, 0);
      
      // Create source node
      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.audioContext.destination);
      
      // Schedule playback to maintain continuous audio
      const currentTime = this.audioContext.currentTime;
      const playTime = Math.max(currentTime, this.nextPlayTime);
      
      sourceNode.start(playTime);
      this.nextPlayTime = playTime + audioBuffer.duration;
      
      // Clean up completed source nodes
      sourceNode.onended = () => {
        const index = this.sourceNodes.indexOf(sourceNode);
        if (index > -1) {
          this.sourceNodes.splice(index, 1);
        }
      };
      
      this.sourceNodes.push(sourceNode);
      
    } catch (error) {
      console.error('Error playing audio chunk:', error);
    }
  }
  
  stop() {
    // Stop all active source nodes
    this.sourceNodes.forEach(node => {
      try {
        node.stop();
      } catch (e) {
        // Node might already be stopped
      }
    });
    this.sourceNodes = [];
    this.nextPlayTime = 0;
    this.isPlaying = false;
  }
  
  async close() {
    this.stop();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const useWebSocket = (url: string, onMessage: (message: string) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [isAISessionActive, setIsAISessionActive] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const pendingBinaryDataRef = useRef<{
    expectedSize: number;
    dataType: string;
    receivedSize: number;
    chunks: ArrayBuffer[];
  } | null>(null);

  // Initialize audio player
  const initializeAudioPlayer = useCallback(async () => {
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new AudioPlayer();
      await audioPlayerRef.current.initialize();
    }
  }, []);

  // Handle binary data reception
  const handleBinaryData = useCallback(async (data: ArrayBuffer) => {
    const pending = pendingBinaryDataRef.current;
    if (!pending) {
      console.warn('Received binary data without metadata');
      return;
    }

    // Add chunk to pending data
    pending.chunks.push(data);
    pending.receivedSize += data.byteLength;

    // Check if we have received all data
    if (pending.receivedSize >= pending.expectedSize) {
      // Combine all chunks into single buffer
      const combinedBuffer = new ArrayBuffer(pending.expectedSize);
      const combinedView = new Uint8Array(combinedBuffer);
      let offset = 0;

      for (const chunk of pending.chunks) {
        const chunkView = new Uint8Array(chunk);
        combinedView.set(chunkView, offset);
        offset += chunk.byteLength;
      }

      // Process the complete binary data based on type
      if (pending.dataType === 'audio') {
        await initializeAudioPlayer();
        if (audioPlayerRef.current) {
          await audioPlayerRef.current.playAudioChunk(combinedBuffer);
          onMessage(`Playing audio chunk: ${combinedBuffer.byteLength} bytes`);
        }
      }

      // Clear pending data
      pendingBinaryDataRef.current = null;
      setIsReceivingAudio(false);
    }
  }, [initializeAudioPlayer, onMessage]);

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    setConnectionStatus('Connecting...');
    const ws = new WebSocket(url);
    wsRef.current = ws;
    
    // Set binary type to arraybuffer to handle binary data properly
    ws.binaryType = 'arraybuffer';
    
    ws.onopen = () => {
      setIsConnected(true);
      setConnectionStatus('Connected');
      onMessage('Connected to WebSocket');
    };
    
    ws.onmessage = async (event) => {
      // Handle binary data
      if (event.data instanceof ArrayBuffer) {
        await handleBinaryData(event.data);
        return;
      }

      // Handle text messages
      try {
        const data = JSON.parse(event.data);
        
        // Handle connection ID assignment
        if (data.type === 'connected' && data.connectionId) {
          setConnectionId(data.connectionId);
          onMessage(`Connected with ID: ${data.connectionId}`);
          return;
        }

        // Handle AI session status
        if (data.type === 'ai_session_started') {
          setIsAISessionActive(true);
          onMessage('AI session started successfully');
          return;
        }

        if (data.type === 'ai_session_stopped') {
          setIsAISessionActive(false);
          onMessage('AI session stopped');
          return;
        }

        if (data.type === 'ai_session_closing') {
          setIsAISessionActive(false);
          onMessage('AI session closing');
          return;
        }

        // Handle speech detection from OpenAI
        if (data.type === 'speech_detected') {
          const status = data.data?.status;
          onMessage(`Speech ${status} detected by AI`);
          return;
        }

        // Handle AI text responses
        if (data.type === 'ai_text_response') {
          onMessage(`AI: ${data.data}`);
          return;
        }

        // Handle binary data metadata
        if (data.type === 'binary_metadata') {
          pendingBinaryDataRef.current = {
            expectedSize: data.size,
            dataType: data.dataType,
            receivedSize: 0,
            chunks: []
          };
          
          if (data.dataType === 'audio') {
            setIsReceivingAudio(true);
            onMessage(`Expecting ${data.dataType} data: ${data.size} bytes`);
          }
          return;
        }
        
        onMessage(`Received: ${JSON.stringify(data)}`);
      } catch (error) {
        onMessage(`Received: ${event.data}`);
      }
    };
    
    ws.onclose = () => {
      setIsConnected(false);
      setConnectionStatus('Disconnected');
      setConnectionId(null);
      setIsReceivingAudio(false);
      setIsAISessionActive(false);
      pendingBinaryDataRef.current = null;
      onMessage('Disconnected from WebSocket');
      
      // Stop audio player
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop();
      }
    };
    
    ws.onerror = () => {
      setConnectionStatus('Error');
      onMessage('WebSocket error occurred');
    };
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Include connection ID in outgoing messages
      const messageWithId = {
        ...message,
        fromConnectionId: connectionId
      };
      wsRef.current.send(JSON.stringify(messageWithId));
      onMessage(`Sent: ${JSON.stringify(messageWithId)}`);
    }
  };

  const sendBinaryData = (data: ArrayBuffer, type: string = 'audio') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (isAISessionActive && type === 'audio') {
        // For AI sessions, send binary audio data directly
        // First send metadata to identify this as audio data
        sendMessage({
          type: 'audio_data_metadata',
          size: data.byteLength,
          dataType: 'audio'
        });
        
        // Then send the actual binary audio data
        wsRef.current.send(data);
        onMessage(`Sent AI audio data: ${data.byteLength} bytes`);
      } else {
        // Send metadata first for regular binary data
        wsRef.current.send(JSON.stringify({
          type: 'binary_metadata',
          dataType: type,
          size: data.byteLength,
          fromConnectionId: connectionId
        }));
        
        // Then send binary data
        wsRef.current.send(data);
        onMessage(`Sent ${type} chunk: ${data.byteLength} bytes`);
      }
    }
  };

  // Start AI session
  const startAISession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendMessage({ type: 'start_ai_session' });
      onMessage('Starting AI session...');
    }
  }, [sendMessage, onMessage]);

  // Stop AI session
  const stopAISession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendMessage({ type: 'stop_ai_session' });
      onMessage('Stopping AI session...');
    }
  }, [sendMessage, onMessage]);

  // Stop audio playback
  const stopAudioPlayback = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      setIsReceivingAudio(false);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
      // Cleanup audio player
      if (audioPlayerRef.current) {
        audioPlayerRef.current.close();
      }
    };
    // eslint-disable-next-line
  }, []);

  return {
    isConnected,
    connectionStatus,
    connectionId,
    isReceivingAudio,
    isAISessionActive,
    connectWebSocket,
    disconnectWebSocket,
    sendMessage,
    sendBinaryData,
    startAISession,
    stopAISession,
    stopAudioPlayback
  };
}; 