import React from "react";
import "./AIAssistant.css";

const AIAssistant = ({ onActivate }) => {
  return (
    <button 
      className="ai-assistant-button" 
      onClick={onActivate}
      aria-label="AI Assistant"
    >
      <span>AI</span>
    </button>
  );
};

export default AIAssistant;