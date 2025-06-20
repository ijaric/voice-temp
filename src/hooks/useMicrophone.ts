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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Create audio context with modern API
      audioContextRef.current = new AudioContext({
        sampleRate: sampleRate
      });
      
      const audioContext = audioContextRef.current;
      
      // Create source from media stream
      sourceRef.current = audioContext.createMediaStreamSource(stream);
      
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
                if (input.length > 0) {
                  const inputData = input[0]; // Get mono channel
                  
                  // Add to buffer
                  this.audioBuffer.push(new Float32Array(inputData));
                  this.totalSamples += inputData.length;
                  
                  // Send chunk when we have enough samples
                  if (this.totalSamples >= this.chunkSize) {
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
        // workletNodeRef.current.connect(audioContext.destination); // Removed to prevent feedback
        
      } catch (workletError) {
        console.warn('AudioWorklet not supported, falling back to ScriptProcessorNode:', workletError);
        
        // Fallback to ScriptProcessorNode for older browsers
        const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
        
        let audioBuffer: Float32Array[] = [];
        let totalSamples = 0;
        
        processorNode.onaudioprocess = (event) => {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0); // Get mono channel
          
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
        
        // Connect nodes
        sourceRef.current.connect(processorNode);
        processorNode.connect(audioContext.destination);
        
        // Store reference for cleanup
        workletNodeRef.current = processorNode as any;
      }
      
      onMessage('Microphone streaming audio...');
      
    } catch (err) {
      console.error('Microphone error:', err);
      onMessage('Microphone access denied');
    }
  };

  const stopMic = () => {
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
    
    onMessage('Microphone stopped.');
  };

  const toggleMic = async () => {
    if (micActive) {
      stopMic();
      setMicActive(false);
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