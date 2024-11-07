import React, { useState, useEffect, useRef } from "react";
import EditorHeader from "./EditorHeader";
import { useSidebar } from "./SidebarContext";
import "./notes.css";

const NoteEditor = ({ note, onUpdate, onCreate }) => {
  const [content, setContent] = useState(note?.content || "");
  const [title, setTitle] = useState(note?.title || "");
  const titleUpdateTimer = useRef(null);
  const { isSidebarOpen } = useSidebar();

  useEffect(() => {
    setContent(note?.content || "");
    setTitle(note?.title || "");
  }, [note]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (note?._id && (content !== note.content || title !== note.title)) {
        onUpdate(note._id, { title, content });
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [content, title, note, onUpdate]);

  const handleContentChange = (newContent) => {
    setContent(newContent);

    // Only update title if it's currently "Untitled Note" or empty
    if (title === "Untitled Note" || title === "") {
      // Find the first sentence by looking for period, question mark, or exclamation mark
      const sentenceEnd = Math.min(
        ...[
          newContent.indexOf(". "),
          newContent.indexOf("? "),
          newContent.indexOf("! "),
        ].filter((pos) => pos !== -1)
      );

      let firstSentence;
      if (sentenceEnd === Infinity) {
        // If no sentence ending is found, use all the content
        firstSentence = newContent;
      } else {
        // Include the punctuation mark in the sentence
        firstSentence = newContent.slice(0, sentenceEnd + 1);
      }

      // Only update title if we have actual content
      if (firstSentence.trim()) {
        // Use a timer to update the title incrementally
        clearTimeout(titleUpdateTimer.current);
        titleUpdateTimer.current = setTimeout(() => {
          setTitle(firstSentence.trim());
        }, 5000);
      }
    }
  };

  return (
    <div className={`editor-container ${!isSidebarOpen ? "full-width" : ""}`}>
      <EditorHeader onCreate={onCreate} />
      <div className="editor-content-wrapper">
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
    </div>
  );
};

export default NoteEditor;
