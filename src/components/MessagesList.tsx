import React from "react";

interface MessagesListProps {
  messages: string[];
}

const MessagesList: React.FC<MessagesListProps> = ({ messages }) => {
  if (messages.length === 0) return null;

  return (
    <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center mb-4">
        <h3 className="text-sm font-medium text-slate-900">Activity</h3>
        <div className="ml-auto text-xs text-slate-500">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {messages.slice(-10).map((message, index) => (
          <div key={index} className="flex items-start space-x-3">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0"></div>
            <div className="text-sm text-slate-600 leading-relaxed break-words">
              {message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessagesList; 