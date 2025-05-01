import React, { useState, useEffect, useRef } from "react";
import EditorHeader from "./EditorHeader";
import { useSidebar } from "./SidebarContext";
import AIAssistant from "../AIAssistant";
import AIModal from "../AIModal";
import AskAIModal from "../AskAIModal";
import TextSelectionToolbar from "../TextSelectionToolbar";
import TextPreviewModal from "../TextPreviewModal";
import EditorToolbar from "../EditorToolbar";
import { generateContent, transformText } from "../../services/geminiService";
import FlashcardModal from "../FlashcardModal";
import "./notes.css";

const NoteEditor = ({ note, onUpdate, onCreate }) => {
  // Existing state variables
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

  // Ask AI states
  const [isAskAIModalOpen, setIsAskAIModalOpen] = useState(false);
  const [askAIResponse, setAskAIResponse] = useState("");
  const [isAskAILoading, setIsAskAILoading] = useState(false);

  // Rich text editing state
  const [isRichText, setIsRichText] = useState(true);
  const [richContent, setRichContent] = useState(note?.content || "");

  const titleUpdateTimer = useRef(null);
  const contentRef = useRef(null);
  const richEditorRef = useRef(null);
  const { isSidebarOpen } = useSidebar();

  useEffect(() => {
    if (note) {
      setTitle(note.title || "");
      // Handle either rich text or plain text
      setContent(note.content || "");
      setRichContent(note.content || "");
    }
  }, [note]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (note?._id) {
        const contentToUpdate = isRichText ? richContent : content;
        if (contentToUpdate !== note.content || title !== note.title) {
          onUpdate(note._id, { title, content: contentToUpdate });
        }
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [content, richContent, title, note, onUpdate, isRichText]);

  // Content change handler for plain text
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

  // Handle rich text formatting
  const handleFormatText = (formatType, value = null) => {
    // Save the current selection
    const selection = document.getSelection();
    //const range = selection.getRangeAt(0);

    // Apply formatting based on type
    document.execCommand("styleWithCSS", false, true);

    switch (formatType) {
      case "bold":
        document.execCommand("bold", false, null);
        break;
      case "italic":
        document.execCommand("italic", false, null);
        break;
      case "underline":
        document.execCommand("underline", false, null);
        break;
      case "strikethrough":
        document.execCommand("strikeThrough", false, null);
        break;
      case "fontFamily":
        document.execCommand("fontName", false, value);
        break;
      case "fontSize":
        // Convert px to pt for execCommand
        const size = parseInt(value.replace("px", ""));
        const pt = Math.ceil(size * 0.75); // approximation of px to pt
        document.execCommand("fontSize", false, pt);
        break;
      case "textColor":
        document.execCommand("foreColor", false, value);
        break;
      case "backgroundColor":
        document.execCommand("hiliteColor", false, value);
        break;
      case "align":
        document.execCommand(
          "justify" + value.charAt(0).toUpperCase() + value.slice(1),
          false,
          null
        );
        break;
      case "bulletList":
        document.execCommand("insertUnorderedList", false, null);
        break;
      case "numberedList":
        document.execCommand("insertOrderedList", false, null);
        break;
      case "heading":
        document.execCommand("formatBlock", false, value);
        break;
      case "blockquote":
        document.execCommand("formatBlock", false, "blockquote");
        break;
      case "code":
        // Wrap selection in <code> tags
        const codeHtml = `<code style="background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: monospace;">${selection.toString()}</code>`;
        document.execCommand("insertHTML", false, codeHtml);
        break;
      default:
        console.log("Formatting not implemented: ", formatType);
    }

    // Update rich content after applying formatting
    if (richEditorRef.current) {
      setRichContent(richEditorRef.current.innerHTML);
    }

    // Restore focus to the editor
    richEditorRef.current.focus();
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

      if (isRichText && richEditorRef.current) {
        document.execCommand("insertText", false, response);
        setRichContent(richEditorRef.current.innerHTML);
      } else if (contentRef.current) {
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

  // Text selection handler for plain text
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
    setSelectionPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });

    // Save selected text and range
    setSelectedText(text);
    setSelectionRange({ start, end });
  };

  // Rich text selection handler
  const handleRichTextSelection = () => {
    const selection = document.getSelection();
    if (!selection.rangeCount) {
      setSelectionPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString();

    // Clear selection toolbar if no text is selected
    if (!text.trim()) {
      setSelectionPosition(null);
      return;
    }

    // Get position for the toolbar based on selection
    const rect = range.getBoundingClientRect();
    setSelectionPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });

    // Save selected text
    setSelectedText(text);
  };

  // Accept the transformed text for rich editor
  const handleAcceptTransformRich = () => {
    if (richEditorRef.current) {
      // Get current selection
      //const selection = document.getSelection();

      // Replace selection with transformed text
      document.execCommand("insertText", false, transformedText);

      // Update rich content
      setRichContent(richEditorRef.current.innerHTML);
      setIsPreviewModalOpen(false);

      // Focus editor
      richEditorRef.current.focus();
    }
  };

  // Other existing handlers and functions...
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

    // Hide the selection toolbar
    setSelectionPosition(null);

    setTransformType(option);
    setIsTransformLoading(true);
    setIsPreviewModalOpen(true);

    try {
      const transformedContent = await transformText(selectedText, option);
      setTransformedText(transformedContent);
    } catch (error) {
      console.error("[DEBUG] Error transforming text:", error);
      setTransformedText("Error transforming text. Please try again.");
    } finally {
      setIsTransformLoading(false);
    }
  };

  const handleAskAISubmit = async (question, context) => {
    if (!question.trim() || !context.trim()) return;

    setIsAskAILoading(true);
    setAskAIResponse("");

    try {
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

  // Accept the transformed text for plain text
  const handleAcceptTransform = () => {
    if (isRichText) {
      handleAcceptTransformRich();
      return;
    }

    // For plain text editor
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
        !contentRef.current.contains(e.target) &&
        (!richEditorRef.current || !richEditorRef.current.contains(e.target))
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

        {isRichText ? (
          <div
            ref={richEditorRef}
            className="editor-content rich-editor"
            contentEditable
            onInput={(e) => setRichContent(e.currentTarget.innerHTML)}
            onSelect={handleRichTextSelection}
            dangerouslySetInnerHTML={{ __html: richContent }}
            placeholder="Start typing your note..."
          ></div>
        ) : (
          <textarea
            ref={contentRef}
            value={content}
            onChange={handleContentChange}
            onSelect={handleTextSelection}
            className="editor-content"
            placeholder="Start typing your note..."
          />
        )}

        {/* Editor toolbar for rich text formatting */}
        {isRichText && <EditorToolbar onFormatText={handleFormatText} />}

        {/* Toggle between rich text and plain text */}
        <button
          className="toggle-editor-mode"
          onClick={() => setIsRichText(!isRichText)}
        >
          {isRichText ? "Switch to Plain Text" : "Switch to Rich Text"}
        </button>
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
        noteContent={isRichText ? richContent : content}
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
