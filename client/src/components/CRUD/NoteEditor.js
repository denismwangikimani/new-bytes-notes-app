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
    }, 500);

    return () => clearTimeout(timer);
  }, [content, title, note, onUpdate]);

  const handleContentChange = (newContent) => {
    setContent(newContent);

    // Dynamically set title based on first sentence if title is still "Untitled Note"
    if (title === "Untitled Note" || title === "") {
      const firstSentence = newContent.split(".")[0];
      setTitle(firstSentence || "Untitled Note");
    }
  };

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
        onChange={(e) => handleContentChange(e.target.value)}
        className="editor-content"
        placeholder="Start typing your note..."
      />
    </div>
  );
};

export default NoteEditor;
