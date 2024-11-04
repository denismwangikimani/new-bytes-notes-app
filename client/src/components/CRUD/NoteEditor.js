import React, { useState, useEffect } from "react";
import "./notes.css";

const NoteEditor = ({ note, onUpdate }) => {
  const [content, setContent] = useState(note?.content || "");
  const [title, setTitle] = useState(note?.title || "");

  useEffect(() => {
    setContent(note?.content || "");
    setTitle(note?.title || "");
  }, [note]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (note?._id && (content !== note.content || title !== note.title)) {
        onUpdate(note._id, { title, content });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [content, title, note, onUpdate]);

  return (
    <div className="editor-container">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="editor-title"
        placeholder="Note title..."
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="editor-content"
        placeholder="Start typing your note..."
      />
    </div>
  );
};

export default NoteEditor;