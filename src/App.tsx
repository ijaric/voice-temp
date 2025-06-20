import React, { useState, useRef } from "react";
import Header from "./components/Header";
import StatusIndicator from "./components/StatusIndicator";
import MicButton from "./components/MicButton";
import ActionButtons from "./components/ActionButtons";
import MessagesList from "./components/MessagesList";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMicrophone } from "./hooks/useMicrophone";

const App: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);

  const addMessage = (message: string) => {
    setMessages(prev => [...prev, message]);
  };

  const { isConnected, connectionStatus, isReceivingAudio, isAISessionActive, connectWebSocket, disconnectWebSocket, sendMessage, sendBinaryData, startAISession, stopAISession, stopAudioPlayback } = 
    useWebSocket('ws://localhost:3002/api/voice', addMessage);

  // Handler for audio chunks
  const handleAudioChunk = (chunk: ArrayBuffer) => {
    if (isConnected) {
      sendBinaryData(chunk, 'audio');
    }
  };

  const handleMicStart = () => {
    // Start AI session when mic is activated
    if (isConnected && !isAISessionActive) {
      startAISession();
    }
  };

  const handleMicStop = () => {
    // Stop AI session when mic is deactivated
    if (isConnected && isAISessionActive) {
      stopAISession();
    }
  };

  const { micActive, toggleMic, stopMic } = useMicrophone(
    addMessage, 
    handleAudioChunk,
    { 
      sampleRate: 24000, 
      chunkSize: 4800 // 200ms chunks at 24kHz
    },
    handleMicStart,
    handleMicStop
  );

  const sendTestMessage = () => {
    const testMessage = { type: 'test', message: 'Hello from frontend!' };
    sendMessage(testMessage);
  };

  const requestTestAudio = () => {
    const audioRequest = { type: 'request_test_audio' };
    sendMessage(audioRequest);
    addMessage('Requested test audio from backend');
  };

  // Store latest stopMic reference
  const stopMicRef = useRef(stopMic);
  React.useEffect(() => {
    stopMicRef.current = stopMic;
  }, [stopMic]);

  // Stop microphone when AI session ends from the server
  React.useEffect(() => {
    if (!isAISessionActive && micActive) {
      stopMicRef.current();
    }
  }, [isAISessionActive, micActive]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <StatusIndicator 
            isConnected={isConnected} 
            connectionStatus={connectionStatus}
            isReceivingAudio={isReceivingAudio}
            isAISessionActive={isAISessionActive}
          />
          
          <div className="flex justify-center">
            <MicButton 
              isActive={micActive}
              onClick={toggleMic}
              disabled={!isConnected}
            />
          </div>
          
          <ActionButtons 
            onSendTest={sendTestMessage}
            onRequestAudio={requestTestAudio}
            onConnect={connectWebSocket}
            onDisconnect={disconnectWebSocket}
            onStopAudio={stopAudioPlayback}
            isConnected={isConnected}
          />
          
          <MessagesList messages={messages} />
        </div>
      </main>
    </div>
  );
};

export default App;
