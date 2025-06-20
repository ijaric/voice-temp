import { readFileSync } from 'fs';
import { join } from 'path';

export class AudioService {
  
  async getTestAudio(): Promise<ArrayBuffer> {
    console.log('Generating test audio data');
    const audioData = this.getTestAudioFromFile();
    console.log(`Test audio data size: ${audioData.byteLength} bytes`);
    return audioData;
  }

  // Read test audio file and extract PCM data
  private getTestAudioFromFile(): ArrayBuffer {
    try {
      // Read the WAV file from the root directory
      const wavFilePath = join(__dirname, '../../../../pcm16_24khz_mono_test_tone.wav');
      console.log(`Attempting to read WAV file from: ${wavFilePath}`);
      
      const wavBuffer = readFileSync(wavFilePath);
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
        if (chunkSize % 2 === 1) offset++;
      }
      
      if (dataChunkSize === 0) {
        console.error('Data chunk not found in WAV file');
        throw new Error('Data chunk not found');
      }
      
      console.log(`Data chunk found: offset=${dataChunkOffset}, size=${dataChunkSize}`);
      
      // Extract PCM data
      const pcmData = wavBuffer.subarray(dataChunkOffset, dataChunkOffset + dataChunkSize);
      
      // Convert Buffer to ArrayBuffer
      const arrayBuffer = new ArrayBuffer(pcmData.length);
      const view = new Uint8Array(arrayBuffer);
      view.set(pcmData);
      
      console.log(`Extracted PCM data: ${pcmData.length} bytes`);
      
      // Log first few samples for debugging
      const sampleView = new Int16Array(arrayBuffer, 0, Math.min(10, pcmData.length / 2));
      console.log(`First 10 PCM samples:`, Array.from(sampleView));
      
      return arrayBuffer;
    } catch (error) {
      console.error('Error reading test audio file:', error);
      console.log('Falling back to generated audio');
      // Fallback to generated audio if file can't be read
      return this.generateTestAudio(440, 2000);
    }
  }

  // Generate test PCM16 24kHz mono audio (sine wave)
  private generateTestAudio(frequency: number = 440, durationMs: number = 1000): ArrayBuffer {
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
} 