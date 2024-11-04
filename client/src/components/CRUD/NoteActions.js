import React from "react";
import "./notes.css";

const NoteActions = ({ isVisible, onDelete, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="note-actions">
      <button
        className="delete-button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
          onClose();
        }}
      >
        Delete
      </button>
    </div>
  );
};

export default NoteActions;