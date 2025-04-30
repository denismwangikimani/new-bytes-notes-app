import React, { useState, useEffect, useRef } from "react";

const AIModal = ({ isOpen, onClose, onSubmit, loading, response }) => {
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="ai-modal-backdrop" onClick={onClose} />
      <div className="ai-modal">
        <div className="ai-modal-header">
          <div className="ai-modal-title">AI Assistant</div>
          <button className="ai-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="ai-modal-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="How can I help you?"
            disabled={loading}
          />
          <div className="ai-modal-actions">
            <button
              type="submit"
              className="ai-modal-submit"
              disabled={!prompt.trim() || loading}
            >
              {loading ? "Processing..." : "Submit"}
            </button>
          </div>
        </form>

        {loading && (
          <div className="ai-loading">
            <div className="ai-loading-dot"></div>
            <div className="ai-loading-dot"></div>
            <div className="ai-loading-dot"></div>
          </div>
        )}

        {response && <div className="ai-response">{response}</div>}
      </div>
    </>
  );
};

export default AIModal;
