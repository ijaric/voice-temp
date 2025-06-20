import { useState, useRef, useCallback } from "react";

interface AudioStreamOptions {
  sampleRate?: number;
  chunkSize?: number;
}

export const useMicrophone = (
  onMessage: (message: string) => void,
  onAudioChunk?: (chunk: ArrayBuffer) => void,
  options: AudioStreamOptions = {},
  onMicStart?: () => void,
  onMicStop?: () => void
) => {
  const [micActive, setMicActive] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const { sampleRate = 24000, chunkSize = 4800 } = options; // 200ms chunks at 24kHz

  // Convert Float32Array to PCM16
  const float32ToPCM16 = useCallback((float32Array: Float32Array): Int16Array => {
    const pcm16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit signed integer
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16Array[i] = sample * 0x7FFF;
    }
    return pcm16Array;
  }, []);

  // Resample audio to target sample rate
  const resampleAudio = useCallback((
    inputBuffer: Float32Array, 
    inputSampleRate: number, 
    outputSampleRate: number
  ): Float32Array => {
    if (inputSampleRate === outputSampleRate) {
      return inputBuffer;
    }

    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.round(inputBuffer.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const inputIndex = i * ratio;
      const index = Math.floor(inputIndex);
      const fraction = inputIndex - index;

      if (index + 1 < inputBuffer.length) {
        // Linear interpolation
        output[i] = inputBuffer[index] * (1 - fraction) + inputBuffer[index + 1] * fraction;
      } else {
        output[i] = inputBuffer[index] || 0;
      }
    }

    return output;
  }, []);

  // Convert stereo to mono by averaging channels
  const stereoToMono = useCallback((leftChannel: Float32Array, rightChannel?: Float32Array): Float32Array => {
    if (!rightChannel) return leftChannel;
    
    const monoBuffer = new Float32Array(leftChannel.length);
    for (let i = 0; i < leftChannel.length; i++) {
      monoBuffer[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }
    return monoBuffer;
  }, []);

  const startMic = async () => {
    try {
      console.log('Starting microphone with options:', { sampleRate, chunkSize });
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      console.log('Microphone stream obtained:', stream.getAudioTracks()[0].getSettings());
      mediaStreamRef.current = stream;
      
      // Check if the audio track is active
      const audioTrack = stream.getAudioTracks()[0];
      console.log('Audio track state:', {
        enabled: audioTrack.enabled,
        readyState: audioTrack.readyState,
        muted: audioTrack.muted
      });
      
      if (audioTrack.readyState !== 'live') {
        console.error('Audio track is not live:', audioTrack.readyState);
        throw new Error('Microphone track is not live');
      }
      
      // Create audio context with modern API
      audioContextRef.current = new AudioContext({
        sampleRate: sampleRate
      });
      
      const audioContext = audioContextRef.current;
      console.log('AudioContext created:', {
        state: audioContext.state,
        sampleRate: audioContext.sampleRate
      });
      
      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        console.log('Resuming suspended AudioContext...');
        await audioContext.resume();
        console.log('AudioContext resumed, state:', audioContext.state);
      }
      
      // Test if audio context is running
      if (audioContext.state !== 'running') {
        console.error('AudioContext failed to start, state:', audioContext.state);
        throw new Error('AudioContext is not running. This may require user interaction.');
      }
      
      // Create source from media stream
      sourceRef.current = audioContext.createMediaStreamSource(stream);
      console.log('MediaStreamSource created');
      
      // Create audio worklet processor for modern audio processing
      try {
        // Load the audio worklet module
        await audioContext.audioWorklet.addModule(
          URL.createObjectURL(new Blob([`
            class AudioProcessor extends AudioWorkletProcessor {
              constructor(options) {
                super();
                this.audioBuffer = [];
                this.totalSamples = 0;
                this.chunkSize = options.processorOptions.chunkSize;

                this.port.onmessage = (event) => {
                  if (event.data.type === 'updateChunkSize') {
                    this.chunkSize = event.data.chunkSize;
                  }
                };
              }
              
              process(inputs, outputs, parameters) {
                const input = inputs[0];
                
                // Debug logging for input
                if (input.length > 0 && input[0]) {
                  const inputData = input[0]; // Get mono channel
                  
                  // Log occasionally to avoid spam
                  if (this.totalSamples % 4800 === 0) { // Log every ~200ms at 24kHz
                    console.log('AudioWorklet processing: ' + inputData.length + ' samples, total: ' + this.totalSamples);
                  }
                  
                  // Add to buffer
                  this.audioBuffer.push(new Float32Array(inputData));
                  this.totalSamples += inputData.length;
                  
                  // Send chunk when we have enough samples
                  if (this.totalSamples >= this.chunkSize) {
                    console.log('AudioWorklet: Creating chunk with ' + this.totalSamples + ' samples (target: ' + this.chunkSize + ')');
                    
                    // Combine buffered audio
                    const combinedBuffer = new Float32Array(this.totalSamples);
                    let offset = 0;
                    
                    for (const chunk of this.audioBuffer) {
                      combinedBuffer.set(chunk, offset);
                      offset += chunk.length;
                    }
                    
                    // Take only the chunk size we need
                    const chunkData = combinedBuffer.slice(0, this.chunkSize);
                    
                    // Send to main thread
                    this.port.postMessage({
                      type: 'audioChunk',
                      data: chunkData
                    });
                    
                    // Keep remaining samples for next chunk
                    const remaining = combinedBuffer.slice(this.chunkSize);
                    this.audioBuffer = remaining.length > 0 ? [remaining] : [];
                    this.totalSamples = remaining.length;
                  }
                } else {
                  // Log if no input is being received
                  if (this.totalSamples === 0) {
                    console.warn('AudioWorklet: No audio input received');
                  }
                }
                
                return true;
              }
            }
            
            registerProcessor('audio-processor', AudioProcessor);
          `], { type: 'application/javascript' }))
        );
        
        // Create worklet node
        workletNodeRef.current = new AudioWorkletNode(audioContext, 'audio-processor', {
          processorOptions: {
            chunkSize: chunkSize
          }
        });
        
        // Handle messages from worklet
        workletNodeRef.current.port.onmessage = (event) => {
          console.log('Received message from AudioWorklet:', event.data.type);
          if (event.data.type === 'audioChunk') {
            const audioData = event.data.data;
            
            // Resample if needed
            const resampledData = resampleAudio(
              audioData,
              audioContext.sampleRate,
              sampleRate
            );
            
            // Convert to PCM16
            const pcm16Data = float32ToPCM16(resampledData);
            
            // Debug logging
            console.log(`Generated audio chunk: ${pcm16Data.buffer.byteLength} bytes`);
            
            // Send as ArrayBuffer
            if (onAudioChunk) {
              onAudioChunk(pcm16Data.buffer);
            }
          }
        };
        
        // Connect nodes - DON'T connect to destination to avoid feedback
        sourceRef.current.connect(workletNodeRef.current);
        console.log('Audio nodes connected');
        // workletNodeRef.current.connect(audioContext.destination); // Removed to prevent feedback
        
        // Start processing
        console.log('AudioWorklet setup complete, waiting for audio input...');
        
      } catch (workletError) {
        console.warn('AudioWorklet not supported, falling back to ScriptProcessorNode:', workletError);
        
        // Fallback to ScriptProcessorNode for older browsers
        const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
        
        let audioBuffer: Float32Array[] = [];
        let totalSamples = 0;
        
        processorNode.onaudioprocess = (event) => {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0); // Get mono channel
          
          // Debug logging
          console.log(`ScriptProcessor: Processing ${inputData.length} samples, total: ${totalSamples}`);
          
          // Check if we have actual audio data (not just zeros)
          const hasAudio = inputData.some(sample => Math.abs(sample) > 0.001);
          if (hasAudio) {
            console.log('ScriptProcessor: Audio detected!');
          } else if (totalSamples === 0) {
            console.log('ScriptProcessor: No audio detected in input');
          }
          
          // Resample if needed
          const resampledData = resampleAudio(
            inputData, 
            inputBuffer.sampleRate, 
            sampleRate
          );
          
          // Add to buffer
          audioBuffer.push(new Float32Array(resampledData));
          totalSamples += resampledData.length;
          
          // Send chunk when we have enough samples
          if (totalSamples >= chunkSize) {
            // Combine buffered audio
            const combinedBuffer = new Float32Array(totalSamples);
            let offset = 0;
            
            for (const chunk of audioBuffer) {
              combinedBuffer.set(chunk, offset);
              offset += chunk.length;
            }
            
            // Take only the chunk size we need
            const chunkData = combinedBuffer.slice(0, chunkSize);
            
            // Convert to PCM16
            const pcm16Data = float32ToPCM16(chunkData);
            
            // Debug logging
            console.log(`Generated audio chunk (fallback): ${pcm16Data.buffer.byteLength} bytes`);
            
            // Send as ArrayBuffer
            if (onAudioChunk) {
              onAudioChunk(pcm16Data.buffer);
            }
            
            // Keep remaining samples for next chunk
            const remaining = combinedBuffer.slice(chunkSize);
            audioBuffer = remaining.length > 0 ? [remaining] : [];
            totalSamples = remaining.length;
          }
        };
        
        // Connect nodes - DON'T connect to destination to avoid feedback
        sourceRef.current.connect(processorNode);
        // processorNode.connect(audioContext.destination); // Removed to prevent feedback
        
        // Store reference for cleanup
        workletNodeRef.current = processorNode as any;
      }
      
      onMessage('Microphone streaming audio...');
      
    } catch (err) {
      console.error('Microphone error:', err);
      onMessage('Microphone access denied');
    }
  };

  const stopMic = useCallback(() => {
    if (!mediaStreamRef.current) return;

    // Disconnect audio nodes
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setMicActive(false);
    onMessage('Microphone stopped.');
  }, [onMessage]);

  const toggleMic = async () => {
    if (micActive) {
      stopMic();
      if (onMicStop) {
        onMicStop();
      }
    } else {
      await startMic();
      setMicActive(true);
      if (onMicStart) {
        onMicStart();
      }
    }
  };

  return {
    micActive,
    toggleMic,
    stopMic
  };
}; 