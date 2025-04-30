import React from "react";
import "./TextSelectionToolbar.css";

const TextPreviewModal = ({
  isOpen,
  onClose,
  content,
  onAccept,
  onReject,
  loading,
  title,
}) => {
  console.log("TextPreviewModal render:", {
    isOpen,
    contentLength: content?.length,
  });

  if (!isOpen) return null;

  return (
    <>
      <div className="text-preview-backdrop" onClick={onClose} />
      <div className="text-preview-container">
        <div className="text-preview-header">
          <div className="text-preview-title">{title || "Preview"}</div>
          <button className="ai-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-preview-loading">
            <div className="text-preview-dot"></div>
            <div className="text-preview-dot"></div>
            <div className="text-preview-dot"></div>
            <div style={{ marginLeft: 10 }}>
              Generating {title || "Preview"}...
            </div>
          </div>
        ) : (
          <div className="text-preview-content">
            {content || "No content generated."}
          </div>
        )}

        <div className="text-preview-actions">
          <button
            className="text-preview-reject"
            onClick={onReject}
            disabled={loading}
          >
            Reject
          </button>
          <button
            className="text-preview-accept"
            onClick={onAccept}
            disabled={loading}
          >
            Accept
          </button>
        </div>
      </div>
    </>
  );
};

export default TextPreviewModal;
