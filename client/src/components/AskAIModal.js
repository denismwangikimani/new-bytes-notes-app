import React, { useState, useEffect, useRef } from 'react';
import './TextSelectionToolbar.css'; 

const AskAIModal = ({ isOpen, onClose, selectedText, onSubmit, loading, response }) => {
  const [question, setQuestion] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuestion(""); // Reset question when modal opens
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (question.trim() && !loading) {
      onSubmit(question, selectedText);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="text-preview-backdrop" onClick={onClose} />
      <div className="text-preview-container ask-ai-modal">
        <div className="text-preview-header">
          <div className="text-preview-title">Ask AI about selected text</div>
          <button onClick={onClose}>×</button>
        </div>

        <div className="selected-text-container">
          <div className="selected-text-label">Selected text:</div>
          <div className="selected-text-content">
            {selectedText.length > 300
              ? `${selectedText.substring(0, 300)}...`
              : selectedText}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ask-ai-input-container">
            <label htmlFor="ai-question">Your question:</label>
            <input
              id="ai-question"
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to know about this text?"
              disabled={loading}
              className="ask-ai-input"
            />
            <button 
              type="submit" 
              disabled={!question.trim() || loading}
              className="ask-ai-submit"
            >
              {loading ? "Asking..." : "Ask"}
            </button>
          </div>
        </form>

        {loading && (
          <div className="text-preview-loading">
            <div className="text-preview-dot"></div>
            <div className="text-preview-dot"></div>
            <div className="text-preview-dot"></div>
          </div>
        )}

        {response && (
          <div className="ask-ai-response">
            <div className="response-label">Answer:</div>
            <div className="response-content">{response}</div>
          </div>
        )}
      </div>
    </>
  );
};

export default AskAIModal;