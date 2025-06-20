import React from "react";

interface ActionButtonsProps {
  onSendTest: () => void;
  onRequestAudio: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onStopAudio: () => void;
  isConnected: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  onSendTest,
  onRequestAudio,
  onConnect, 
  onDisconnect,
  onStopAudio,
  isConnected
}) => {
  return (
    <div className="space-y-4 w-full">
      {!isConnected ? (
        <button
          onClick={onConnect}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-xl transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
        >
          Connect
        </button>
      ) : (
        <div className="space-y-3">
          <button
            onClick={onSendTest}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
          >
            Send Test Message
          </button>
          <button
            onClick={onRequestAudio}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
          >
            Request Test Audio
          </button>
          <button
            onClick={onStopAudio}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
          >
            Stop Audio Playback
          </button>
          <button
            onClick={onDisconnect}
            className="w-full border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 font-medium py-3 px-6 rounded-xl transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default ActionButtons; 