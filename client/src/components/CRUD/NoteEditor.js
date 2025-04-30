import React, { useState, useEffect, useRef } from "react";
import EditorHeader from "./EditorHeader";
import { useSidebar } from "./SidebarContext";
import AIAssistant from "../AIAssistant";
import AIModal from "../AIModal";
import { generateContent } from "../../services/geminiService";
import "./notes.css";

const NoteEditor = ({ note, onUpdate, onCreate }) => {
  const [content, setContent] = useState(note?.content || "");
  const [title, setTitle] = useState(note?.title || "");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiResponse, setAIResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const titleUpdateTimer = useRef(null);
  const contentRef = useRef(null);
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

  // Handle keyboard shortcut for AI assistant
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if Ctrl+/ is pressed
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        setIsAIModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleAISubmit = async (prompt) => {
    setIsLoading(true);
    try {
      const response = await generateContent(prompt);
      setAIResponse(response);
      
      // Insert the AI-generated content at the cursor position or at the end
      if (contentRef.current) {
        const cursorPosition = contentRef.current.selectionStart;
        const currentContent = content;
        const newContent = 
          currentContent.substring(0, cursorPosition) + 
          response + 
          currentContent.substring(cursorPosition);
        
        setContent(newContent);
        
        // After state update, set cursor to end of inserted content
        setTimeout(() => {
          if (contentRef.current) {
            const newPosition = cursorPosition + response.length;
            contentRef.current.selectionStart = newPosition;
            contentRef.current.selectionEnd = newPosition;
            contentRef.current.focus();
          }
        }, 0);
      }
      
      // Close modal after a short delay
      setTimeout(() => {
        setIsAIModalOpen(false);
        setAIResponse("");
      }, 1500);
      
    } catch (error) {
      setAIResponse("Error: Failed to generate content.");
    } finally {
      setIsLoading(false);
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
          ref={contentRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="editor-content"
          placeholder="Start typing your note..."
        />
      </div>
      
      {/* AI Assistant */}
      <AIAssistant onActivate={() => setIsAIModalOpen(true)} />
      <AIModal
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          setAIResponse("");
        }}
        onSubmit={handleAISubmit}
        loading={isLoading}
        response={aiResponse}
      />
    </div>
  );
};

export default NoteEditor;