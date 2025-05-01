import React, { useState, useEffect, useRef } from "react";
import EditorHeader from "./EditorHeader";
import { useSidebar } from "./SidebarContext";
import AIAssistant from "../AIAssistant";
import AIModal from "../AIModal";
import AskAIModal from "../AskAIModal";
import TextSelectionToolbar from "../TextSelectionToolbar";
import TextPreviewModal from "../TextPreviewModal";
import { generateContent, transformText } from "../../services/geminiService";
import FlashcardModal from "../FlashcardModal";
import "./notes.css";

const NoteEditor = ({ note, onUpdate, onCreate }) => {
  const [content, setContent] = useState(note?.content || "");
  const [title, setTitle] = useState(note?.title || "");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiResponse, setAIResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Text selection and transformation states
  const [selectionPosition, setSelectionPosition] = useState(null);
  const [selectedText, setSelectedText] = useState("");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [transformedText, setTransformedText] = useState("");
  const [isTransformLoading, setIsTransformLoading] = useState(false);
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  const [transformType, setTransformType] = useState("");
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);

  //ask ai states
  const [isAskAIModalOpen, setIsAskAIModalOpen] = useState(false);
  const [askAIResponse, setAskAIResponse] = useState("");
  const [isAskAILoading, setIsAskAILoading] = useState(false);

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

  // Content change handler
  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Auto-title generation logic
    if (title === "Untitled Note" || title === "") {
      const sentenceEnd = Math.min(
        ...[
          newContent.indexOf(". "),
          newContent.indexOf("? "),
          newContent.indexOf("! "),
        ].filter((pos) => pos !== -1)
      );

      let firstSentence;
      if (sentenceEnd === Infinity) {
        firstSentence = newContent;
      } else {
        firstSentence = newContent.slice(0, sentenceEnd + 1);
      }

      if (firstSentence.trim()) {
        clearTimeout(titleUpdateTimer.current);
        titleUpdateTimer.current = setTimeout(() => {
          setTitle(firstSentence.trim());
        }, 5000);
      }
    }
  };

  // AI Assistant keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
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

  // Handle AI prompt submission
  const handleAISubmit = async (prompt) => {
    setIsLoading(true);
    try {
      const response = await generateContent(prompt);
      setAIResponse(response);

      if (contentRef.current) {
        const cursorPosition = contentRef.current.selectionStart;
        const newContent =
          content.substring(0, cursorPosition) +
          response +
          content.substring(cursorPosition);

        setContent(newContent);

        setTimeout(() => {
          if (contentRef.current) {
            const newPosition = cursorPosition + response.length;
            contentRef.current.selectionStart = newPosition;
            contentRef.current.selectionEnd = newPosition;
            contentRef.current.focus();
          }
        }, 0);
      }

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

  // Text selection handler
  const handleTextSelection = () => {
    if (!contentRef.current) return;

    const start = contentRef.current.selectionStart;
    const end = contentRef.current.selectionEnd;

    // Clear selection toolbar if no text is selected
    if (start === end) {
      setSelectionPosition(null);
      return;
    }

    const text = content.substring(start, end);

    // Clear selection toolbar if selected text is empty
    if (!text.trim()) {
      setSelectionPosition(null);
      return;
    }

    // Get position for the toolbar
    const textarea = contentRef.current;
    const rect = textarea.getBoundingClientRect();

    // Calculate approximate position of cursor
    // This is a best-effort since textareas don't provide exact cursor positions
    setSelectionPosition({
      x: rect.left + rect.width / 2, // Center horizontally
      y: rect.top - 10, // Position above textarea
    });

    // Save selected text and range
    setSelectedText(text);
    setSelectionRange({ start, end });
  };

  // Modify your handleTransformOption function to handle the new option
  const handleTransformOption = async (option) => {
    console.log(
      `%c[NoteEditor DEBUG] Transform option selected: ${option}`,
      "color: blue;"
    );

    if (option === "askAI") {
      // Open the Ask AI modal
      setIsAskAIModalOpen(true);
      return;
    }

    // Existing code for other options
    console.log(
      `%c[DEBUG] handleTransformOption START - Option: ${option}`,
      "color: blue; font-weight: bold;"
    );
    console.log(
      `[DEBUG] Current isPreviewModalOpen state: ${isPreviewModalOpen}`
    );

    // Hide the selection toolbar
    setSelectionPosition(null);

    setTransformType(option);
    setIsTransformLoading(true);

    setIsPreviewModalOpen(true);
    console.log(
      `%c[DEBUG] setIsPreviewModalOpen(true) CALLED!`,
      "color: green; font-weight: bold;"
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    console.log(
      `[DEBUG] State after 50ms delay - isPreviewModalOpen: ${isPreviewModalOpen}`
    );

    try {
      console.log("[DEBUG] Calling transformText API...");
      const transformedContent = await transformText(selectedText, option);
      console.log("[DEBUG] transformText API returned.");
      setTransformedText(transformedContent);
    } catch (error) {
      console.error("[DEBUG] Error transforming text:", error);
      setTransformedText("Error transforming text. Please try again.");
      setIsPreviewModalOpen(true);
    } finally {
      setIsTransformLoading(false);
      console.log("[DEBUG] handleTransformOption FINALLY block.");
      console.log(
        `[DEBUG] Final state check - isPreviewModalOpen: ${isPreviewModalOpen}`
      );
    }
  };

  //  new handler for the Ask AI feature
  const handleAskAISubmit = async (question, context) => {
    if (!question.trim() || !context.trim()) return;

    setIsAskAILoading(true);
    setAskAIResponse("");

    try {
      // Use your existing geminiService but with a different prompt format
      const prompt = `I have the following text:
"${context}"

My question about this text is: ${question}

Please provide a clear, helpful answer based only on the information in the text.`;

      const response = await generateContent(prompt);
      setAskAIResponse(response);
    } catch (error) {
      console.error("Error in Ask AI:", error);
      setAskAIResponse("Sorry, there was an error processing your question.");
    } finally {
      setIsAskAILoading(false);
    }
  };

  // Accept the transformed text
  const handleAcceptTransform = () => {
    // Replace the selected text with the transformed text
    const newContent =
      content.substring(0, selectionRange.start) +
      transformedText +
      content.substring(selectionRange.end);

    setContent(newContent);
    setIsPreviewModalOpen(false);

    // Reset cursor position
    setTimeout(() => {
      if (contentRef.current) {
        const newPosition = selectionRange.start + transformedText.length;
        contentRef.current.selectionStart = newPosition;
        contentRef.current.selectionEnd = newPosition;
        contentRef.current.focus();
      }
    }, 0);
  };

  // Reject the transformed text
  const handleRejectTransform = () => {
    setIsPreviewModalOpen(false);
  };

  // Close the selection toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        selectionPosition &&
        contentRef.current &&
        !contentRef.current.contains(e.target)
      ) {
        setSelectionPosition(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectionPosition]);

  // Get the title for the transformation preview
  const getTransformTitle = () => {
    switch (transformType) {
      case "summarize":
        return "Summarized Text";
      case "explain":
        return "Explanation";
      case "shorten":
        return "Shortened Text";
      case "expand":
        return "Expanded Text";
      default:
        return "Preview";
    }
  };

  // AI Assistant handlers
  const handleActivateText = () => {
    setIsAIModalOpen(true);
  };

  const handleActivateRevision = () => {
    setIsFlashcardModalOpen(true);
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
          onChange={handleContentChange}
          onSelect={handleTextSelection}
          className="editor-content"
          placeholder="Start typing your note..."
        />
      </div>

      {/* AI Assistant */}
      <AIAssistant
        onActivateText={handleActivateText}
        onActivateRevision={handleActivateRevision}
      />
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

      {/* Flashcard Modal */}
      <FlashcardModal
        isOpen={isFlashcardModalOpen}
        onClose={() => setIsFlashcardModalOpen(false)}
        noteContent={content}
      />

      {/* Text selection toolbar */}
      <TextSelectionToolbar
        position={selectionPosition}
        onOption={handleTransformOption}
      />

      {/* Text preview modal */}
      <TextPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={handleRejectTransform}
        content={transformedText}
        onAccept={handleAcceptTransform}
        onReject={handleRejectTransform}
        loading={isTransformLoading}
        title={getTransformTitle()}
      />

      {/* Ask AI modal */}
      <AskAIModal
        isOpen={isAskAIModalOpen}
        onClose={() => {
          setIsAskAIModalOpen(false);
          setAskAIResponse("");
        }}
        selectedText={selectedText}
        onSubmit={handleAskAISubmit}
        loading={isAskAILoading}
        response={askAIResponse}
      />
    </div>
  );
};

export default NoteEditor;
