import React, { useRef } from "react";

const MIC_OFF_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic-off h-16 w-16 text-red-500">
    <line x1="2" x2="22" y1="2" y2="22"></line>
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"></path>
    <path d="M5 10v2a7 7 0 0 0 12 5"></path>
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"></path>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path>
    <line x1="12" x2="12" y1="19" y2="22"></line>
  </svg>
);

const MIC_ON_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic h-16 w-16 text-green-500">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" x2="12" y1="19" y2="22"></line>
  </svg>
);

interface MicButtonProps {
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const MicButton: React.FC<MicButtonProps> = ({ isActive, onClick, disabled = false }) => {
  return (
    <button
      className={`rounded-full border-2 ${isActive ? 'border-green-500' : 'border-red-500'} bg-slate-100 shadow-md p-6 mb-8 transition-all duration-200 hover:scale-105 focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={isActive ? 'Deactivate microphone' : 'Activate microphone'}
      type="button"
    >
      {isActive ? MIC_ON_SVG : MIC_OFF_SVG}
    </button>
  );
};

export default MicButton; 