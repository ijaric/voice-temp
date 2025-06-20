import React from "react";

interface StatusIndicatorProps {
  isConnected: boolean;
  connectionStatus: string;
  isReceivingAudio?: boolean;
  isAISessionActive?: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  isConnected, 
  connectionStatus, 
  isReceivingAudio = false,
  isAISessionActive = false 
}) => {
  return (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-3">
        <div className={`w-2 h-2 rounded-full ${
          isConnected 
            ? 'bg-emerald-500' 
            : connectionStatus === 'Connecting...' 
              ? 'bg-amber-500 animate-pulse'
              : 'bg-slate-400'
        }`}></div>
        <span className="text-sm font-medium text-slate-700">
          {connectionStatus}
        </span>
        {isAISessionActive && (
          <>
            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 font-medium">
              AI Active
            </span>
          </>
        )}
        {isReceivingAudio && (
          <>
            <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-600 font-medium">
              Receiving Audio
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default StatusIndicator; 