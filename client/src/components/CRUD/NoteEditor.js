import React, { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
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
import FileSidebar from "./FileSidebar";
import MediaContextMenu from "../MediaContextMenu";
import MediaDialog from "../MediaDialog";
import "./notes.css";

const NoteEditor = ({ note, onUpdate, onCreate }) => {
  // Existing state variables
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const contentRef = useRef(null);
  const lastCursorPosition = useRef(0);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiResponse, setAIResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Text selection and transformation states
  const [selectionPosition, setSelectionPosition] = useState(null);
  const [selectedText, setSelectedText] = useState("");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [transformedText, setTransformedText] = useState("");
  const [isTransformLoading, setIsTransformLoading] = useState(false);
  //const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  const [transformType, setTransformType] = useState("");
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);

  // Ask AI states
  const [isAskAIModalOpen, setIsAskAIModalOpen] = useState(false);
  const [askAIResponse, setAskAIResponse] = useState("");
  const [isAskAILoading, setIsAskAILoading] = useState(false);

  // Rich text editing state - ALWAYS use rich text
  // Remove isRichText toggle and always use rich text and rack the cursor
  const [richContent, setRichContent] = useState(note?.content || "");
  const [previousBlockCount, setPreviousBlockCount] = useState(0);
  const [editorState, setEditorState] = useState({
    container: null,
    cursorPosition: null,
    selectionStart: null,
    selectionEnd: null,
    path: [],
    isNewLine: false,
  });

  //const titleUpdateTimer = useRef(null);
  const richEditorRef = useRef(null);
  const { isSidebarOpen } = useSidebar();

  //file sidebar states
  const [fileSidebar, setFileSidebar] = useState({
    isOpen: false,
    fileUrl: "",
    fileName: "",
  });

  //media dialog states
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
    mediaType: null,
    mediaElement: null,
    fileId: null,
  });

  //state vars for media replacement
  const [mediaType, setMediaType] = useState(null);
  const [mediaElement, setMediaElement] = useState(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);

  //purifyConfig states
  const purifyConfig = {
    ADD_ATTR: [
      "target",
      "contenteditable",
      "data-file-url",
      "data-filename",
      "data-file-id",
    ],
    ADD_TAGS: ["iframe"],
  };

  const API_BASE_URL = "https://new-bytes-notes-backend.onrender.com";

  useEffect(() => {
    if (note) {
      setTitle(note.title || "");
      // Sanitize content before setting it
      setRichContent(note?.content ? DOMPurify.sanitize(note.content) : "");
    }
  }, [note]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (note?._id) {
        if (richContent !== note.content || title !== note.title) {
          onUpdate(note._id, { title, content: richContent });
        }
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [richContent, title, note, onUpdate]);

  // Add the new handleRichTextInput function
  const handleRichTextInput = (e) => {
    // Get the current content from the event
    const newContent = e.currentTarget.innerHTML;

    // Save current selection information before updating state
    const selection = document.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      // Check if this is a new line event by examining if a new block element
      // has been created (paragraphs, divs, etc.)
      const isNewLineEvent = () => {
        if (!richEditorRef.current) return false;

        // Check the content for new paragraphs or line breaks
        const currentBlockCount =
          richEditorRef.current.querySelectorAll("p, div, br").length;
        const hasMoreBlocksThanBefore = currentBlockCount > previousBlockCount;

        if (hasMoreBlocksThanBefore) {
          // Update the block count using the state setter
          setPreviousBlockCount(currentBlockCount);
          return true;
        }

        return false;
      };

      // Special handling for new line events
      if (isNewLineEvent()) {
        // For a new line, we want to set the cursor to the new node that was created
        // We'll search for it in the effect after the render
        setEditorState({
          container: null, // We'll find this in the effect
          cursorPosition: 0, // Position at the start of the new line
          selectionStart: 0,
          selectionEnd: 0,
          path: [], // We'll set this to the last element's path
          isNewLine: true, // Flag to indicate this is after pressing Enter
        });
      } else {
        // Normal case - save the current position information
        setEditorState({
          container: range.endContainer,
          cursorPosition: range.endOffset,
          selectionStart: range.startOffset,
          selectionEnd: range.endOffset,
          path: getNodePath(range.endContainer, richEditorRef.current),
          isNewLine: false,
        });
      }
    }

    // Update the content state
    setRichContent(newContent);
  };

  // Add this helper function to track the path to a node
  const getNodePath = (node, rootNode) => {
    if (!node || !rootNode) return [];

    // If the node is the root, return empty path
    if (node === rootNode) return [];

    const path = [];
    let currentNode = node;

    // Traverse up the DOM tree until we reach the root
    while (currentNode && currentNode !== rootNode) {
      const parent = currentNode.parentNode;
      if (!parent) break;

      // Find the index of the current node among its siblings
      const children = Array.from(parent.childNodes);
      const index = children.indexOf(currentNode);

      path.unshift(index);
      currentNode = parent;
    }

    return path;
  };

  // Add missing useEffect to initialize block count
  useEffect(() => {
    if (richEditorRef.current) {
      const initialBlockCount =
        richEditorRef.current.querySelectorAll("p, div, br").length;
      setPreviousBlockCount(initialBlockCount);
    }
  }, []);

  // Find a node using the saved path
  const findNodeByPath = (rootNode, path) => {
    if (!rootNode || !path.length) return rootNode;

    let currentNode = rootNode;

    for (const index of path) {
      if (currentNode.childNodes && index < currentNode.childNodes.length) {
        currentNode = currentNode.childNodes[index];
      } else {
        // Path is invalid, return the last valid node
        return currentNode;
      }
    }

    return currentNode;
  };

  // Now replace the cursor restoration effect with this improved version
  useEffect(() => {
    if (!richEditorRef.current || editorState.cursorPosition === null) return;

    // Wait for the DOM to update
    setTimeout(() => {
      const selection = document.getSelection();
      selection.removeAllRanges();

      try {
        // Create a new range
        const range = document.createRange();

        // Special handling for a new line event
        if (editorState.isNewLine) {
          // Find the last block element in the editor
          const blocks = richEditorRef.current.querySelectorAll("p, div");
          if (blocks.length > 0) {
            const lastBlock = blocks[blocks.length - 1];

            // Position cursor at the beginning of the last block element
            if (lastBlock.firstChild) {
              // If the block has content, place at beginning of content
              range.setStart(lastBlock.firstChild, 0);
              range.setEnd(lastBlock.firstChild, 0);
            } else {
              // If the block is empty, place inside it
              range.setStart(lastBlock, 0);
              range.setEnd(lastBlock, 0);
            }

            selection.addRange(range);
            richEditorRef.current.focus();
            return;
          }
        }

        // Regular case - use the saved path
        let targetNode;
        if (editorState.path && editorState.path.length) {
          targetNode = findNodeByPath(richEditorRef.current, editorState.path);
        }

        // If we can't find the node by path, find the last text node
        if (!targetNode || targetNode.nodeType !== 3) {
          const findLastTextNode = (node) => {
            if (!node) return null;

            // If this is already a text node with content, return it
            if (node.nodeType === 3) {
              return node;
            }

            // Check children in reverse order (to find the last one)
            if (node.childNodes && node.childNodes.length) {
              for (let i = node.childNodes.length - 1; i >= 0; i--) {
                const lastNode = findLastTextNode(node.childNodes[i]);
                if (lastNode) return lastNode;
              }
            }

            return null;
          };

          targetNode = findLastTextNode(richEditorRef.current);
        }

        // If we found a valid node, position the cursor
        if (targetNode) {
          // For text nodes, use normal positioning
          if (targetNode.nodeType === 3) {
            let position = Math.min(
              editorState.cursorPosition,
              targetNode.length
            );
            range.setStart(targetNode, position);
            range.setEnd(targetNode, position);
          }
          // For element nodes, position inside the element
          else {
            range.selectNodeContents(targetNode);
            range.collapse(false); // Move to end
          }

          selection.addRange(range);
        }
        // Fallback - just place at the end of the editor
        else {
          const lastChild = richEditorRef.current.lastChild;
          if (lastChild) {
            range.selectNodeContents(lastChild);
            range.collapse(false); // Move to end
            selection.addRange(range);
          }
        }

        // Maintain focus on editor
        richEditorRef.current.focus();
      } catch (error) {
        console.log("Error restoring cursor:", error);
      }
    }, 0);
  }, [richContent, editorState]);

  // Handle rich text formatting
  const handleFormatText = (formatType, value = null) => {
    // Save the current selection
    const selection = document.getSelection();

    // Focus the editor before applying commands
    richEditorRef.current.focus();

    // Handle media insertions
    if (["image", "video", "file", "link"].includes(formatType)) {
      handleMediaInsertion(formatType, value);
      return;
    }

    if (!selection.rangeCount) {
      // No selection, exit early
      return;
    }

    // Focus the editor before applying commands
    richEditorRef.current.focus();

    // Get the current range
    const range = selection.getRangeAt(0);

    // Apply styling with CSS to ensure proper styling
    document.execCommand("styleWithCSS", false, true);

    // Helper to determine if selection is an entire paragraph
    const isEntireParagraph = () => {
      // eslint-disable-next-line no-unused-vars
      const parentElement =
        range.commonAncestorContainer.nodeType === 1
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;

      // If selection starts at beginning and ends at end of element
      return (
        range.startOffset === 0 &&
        range.endOffset ===
          (range.endContainer.nodeType === 3
            ? range.endContainer.length
            : range.endContainer.childNodes.length)
      );
    };

    // For lists and alignment, we need special handling to ensure we only affect the selected text
    if (
      ["bulletList", "numberedList", "align"].includes(formatType.split(".")[0])
    ) {
      // Store the selected content
      const fragment = range.cloneContents();
      const tempDiv = document.createElement("div");
      tempDiv.appendChild(fragment);
      const selectedHtml = tempDiv.innerHTML;

      // For alignment specifically
      if (formatType === "align") {
        // If it's whole paragraphs or block elements, apply directly
        if (isEntireParagraph()) {
          document.execCommand(
            "justify" + value.charAt(0).toUpperCase() + value.slice(1),
            false,
            null
          );
        } else {
          // For partial selections, wrap in a div with the alignment
          const alignmentDiv = `<div style="text-align: ${value}">${selectedHtml}</div>`;
          document.execCommand("insertHTML", false, alignmentDiv);
        }
      }
      // For lists, handle specially
      else if (formatType === "bulletList") {
        if (isEntireParagraph()) {
          document.execCommand("insertUnorderedList", false, null);
        } else {
          // For partial selections, create a list explicitly
          const listHtml = `<ul><li>${selectedHtml}</li></ul>`;
          document.execCommand("insertHTML", false, listHtml);
        }
      } else if (formatType === "numberedList") {
        if (isEntireParagraph()) {
          document.execCommand("insertOrderedList", false, null);
        } else {
          // For partial selections, create a list explicitly
          const listHtml = `<ol><li>${selectedHtml}</li></ol>`;
          document.execCommand("insertHTML", false, listHtml);
        }
      }
    }
    // Handle all other formatting cases
    else {
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
        case "heading":
          // For headings, we need to make sure it's only applied to selected content
          if (isEntireParagraph()) {
            document.execCommand("formatBlock", false, value);
          } else {
            // Wrap the selected content in the appropriate heading tag
            const headingHtml = `<${value}>${selection.toString()}</${value}>`;
            document.execCommand("insertHTML", false, headingHtml);
          }
          break;
        case "blockquote":
          if (isEntireParagraph()) {
            document.execCommand("formatBlock", false, "blockquote");
          } else {
            const quoteHtml = `<blockquote>${selection.toString()}</blockquote>`;
            document.execCommand("insertHTML", false, quoteHtml);
          }
          break;
        case "code":
          // Wrap selection in <code> tags
          const codeHtml = `<code style="background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: monospace;">${selection.toString()}</code>`;
          document.execCommand("insertHTML", false, codeHtml);
          break;
        default:
          console.log("Formatting not implemented: ", formatType);
      }
    }

    // Update rich content after applying formatting
    if (richEditorRef.current) {
      setRichContent(richEditorRef.current.innerHTML);
    }

    // Restore focus to the editor
    richEditorRef.current.focus();
  };

  // Add new function to handle media insertion
  const handleMediaInsertion = (type, data) => {
    if (!richEditorRef.current) return;

    // For links, insert at cursor position (keep this behavior)
    if (type === "link") {
      const linkText = window.getSelection().toString() || data.url;
      const linkHtml = `<a href="${data.url}" target="_blank">${linkText}</a>`;
      document.execCommand("insertHTML", false, linkHtml);
    }
    // Handling a replacement
    else if (isReplacing && mediaElement) {
      // Extract fileId from the URL
      const fileId = data.url.split("/").pop();

      // Create new HTML based on media type
      let newHtml = "";
      switch (type) {
        case "image":
          newHtml = `<div class="media-container image-container" contenteditable="false" data-file-id="${fileId}"><img src="${data.url}" alt="User uploaded image" style="max-width: 100%;" /></div>`;
          break;
        case "video":
          newHtml = `<div class="media-container video-container" contenteditable="false" data-file-id="${fileId}"><video controls src="${data.url}" style="max-width: 100%;"></video></div>`;
          break;
        case "file":
          newHtml = `
          <div class="media-container file-container" contenteditable="false" data-file-url="${
            data.url
          }" data-filename="${data.filename}" data-file-id="${fileId}">
            <div class="file-preview">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div class="file-info">
                <span class="file-name" data-file-url="${data.url}">${
            data.filename
          }</span>
                <span class="file-size">${formatFileSize(data.size)}</span>
                <button class="view-file-button" data-file-url="${
                  data.url
                }" data-filename="${data.filename}" type="button">View</button>
              </div>
            </div>
          </div>`;
          break;
        default:
          break;
      }

      // Replace the old element with the new one
      if (newHtml) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = newHtml;
        const newElement = tempDiv.firstChild;
        mediaElement.parentNode.replaceChild(newElement, mediaElement);

        // Update rich content
        setRichContent(richEditorRef.current.innerHTML);
      }

      // Reset replacement state
      setIsReplacing(false);
      setMediaElement(null);
    }
    // For other media types, ensure they're on their own line with proper spacing
    else {
      // Get selection and range
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // Extract fileId from the URL
        const fileId = data.url.split("/").pop();

        // Create appropriate HTML based on media type
        let mediaHtml = "";

        switch (type) {
          case "image":
            mediaHtml = `<div class="media-container image-container" contenteditable="false" data-file-id="${fileId}"><img src="${data.url}" alt="User uploaded image" style="max-width: 100%;" /></div><p><br></p>`;
            break;
          case "video":
            mediaHtml = `<div class="media-container video-container" contenteditable="false" data-file-id="${fileId}"><video controls src="${data.url}" style="max-width: 100%;"></video></div><p><br></p>`;
            break;
          case "file":
            mediaHtml = `
            <div class="media-container file-container" contenteditable="false" data-file-url="${
              data.url
            }" data-filename="${data.filename}" data-file-id="${fileId}">
              <div class="file-preview">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="file-info">
                  <span class="file-name" data-file-url="${data.url}">${
              data.filename
            }</span>
                  <span class="file-size">${formatFileSize(data.size)}</span>
                  <button class="view-file-button" data-file-url="${
                    data.url
                  }" data-filename="${
              data.filename
            }" type="button">View</button>
                </div>
              </div>
            </div><p><br></p>`;
            break;
          default:
            return;
        }

        // Ensure we're at a block boundary (beginning or end of paragraph)
        const currentNode = range.startContainer;
        const isAtBlockStart = range.startOffset === 0;

        // Check if we need to insert a line break before the media
        let needsLineBreakBefore = false;

        // If we're in a text node, check if we're not at the beginning of a block element
        if (currentNode.nodeType === Node.TEXT_NODE && !isAtBlockStart) {
          needsLineBreakBefore = true;
        }

        // Create the full HTML to insert with appropriate spacing
        let fullHtml = "";

        if (needsLineBreakBefore) {
          fullHtml = `<p><br></p>${mediaHtml}`;
        } else {
          fullHtml = mediaHtml;
        }

        // Insert the HTML
        document.execCommand("insertHTML", false, fullHtml);

        // Update content state
        setRichContent(richEditorRef.current.innerHTML);

        // Set focus to the paragraph after the media element
        setTimeout(() => {
          const paragraphs = richEditorRef.current.querySelectorAll("p");
          if (paragraphs.length > 0) {
            const lastP = paragraphs[paragraphs.length - 1];
            const range = document.createRange();
            const sel = window.getSelection();

            range.setStart(lastP, 0);
            range.collapse(true);

            sel.removeAllRanges();
            sel.addRange(range);
            richEditorRef.current.focus();
          }
        }, 0);
      }
    }
  };

  // // Helper to check if cursor is at the end of a block
  // const isAtEndOfBlock = (node) => {
  //   if (node.nodeType === Node.TEXT_NODE) {
  //     // If we're in a text node
  //     if (node.nextSibling) return false; // Not at the end if there's a next sibling
  //     return isAtEndOfBlock(node.parentNode); // Check parent instead
  //   }

  //   if (node.nodeType === Node.ELEMENT_NODE) {
  //     const isBlock = getComputedStyle(node).display === "block";
  //     if (isBlock) {
  //       return true; // We're at a block element, so we'll consider it the end
  //     }

  //     // If not a block, check if parent is at end of its block
  //     if (node.parentNode) {
  //       return isAtEndOfBlock(node.parentNode);
  //     }
  //   }

  //   return true; // Default to true if we can't determine
  // };

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " bytes";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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

      if (richEditorRef.current) {
        document.execCommand("insertText", false, response);
        setRichContent(richEditorRef.current.innerHTML);
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
      // Replace selection with transformed text
      document.execCommand("insertText", false, transformedText);

      // Update rich content
      setRichContent(richEditorRef.current.innerHTML);
      setIsPreviewModalOpen(false);

      // Focus editor
      richEditorRef.current.focus();
    }
  };

  // Handle transformation options
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

  // Accept the transformed text
  const handleAcceptTransform = () => {
    handleAcceptTransformRich();
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

  // Handle clicking on media elements in the editor
  const handleEditorClick = (e) => {
    // Handle clicking on media elements
    if (e.target.closest(".media-container")) {
      // If it's a media container, prevent default text editing behavior
      const container = e.target.closest(".media-container");

      // If it's specifically a file container, maybe we want to handle click differently
      if (container.classList.contains("file-container")) {
        // Only handle if the click wasn't on the view button (that's handled separately)
        if (
          !e.target.classList.contains("view-file-button") &&
          !e.target.classList.contains("file-name")
        ) {
          e.stopPropagation();
        }
      }
    }
  };

  // Store cursor position before update
  const handleContentChange = (e) => {
    const cursorPos = e.target.selectionStart;
    lastCursorPosition.current = cursorPos;
    setContent(e.target.value);
  };

  // Restore cursor position after content update
  useEffect(() => {
    if (contentRef.current) {
      const scrollHeight = contentRef.current.scrollHeight;
      const clientHeight = contentRef.current.clientHeight;

      // If user was near the bottom before update, keep them at the bottom
      const isNearBottom =
        contentRef.current.scrollTop + clientHeight > scrollHeight - 50;

      if (isNearBottom) {
        // Wait for content to update
        setTimeout(() => {
          contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }, 0);
      } else {
        // Otherwise, restore cursor position
        contentRef.current.setSelectionRange(
          lastCursorPosition.current,
          lastCursorPosition.current
        );
      }
    }
  }, [content]);

  // Add this function to handle file viewing
  const handleViewFile = (fileUrl, fileName) => {
    setFileSidebar({
      isOpen: true,
      fileUrl,
      fileName,
    });
  };

  // Add event handler setup for file viewer buttons
  useEffect(() => {
    const handleFileButtonClick = (e) => {
      // Check if the click was on a view file button
      if (
        e.target.classList.contains("view-file-button") ||
        e.target.classList.contains("file-name")
      ) {
        e.preventDefault();
        e.stopPropagation();

        const fileUrl = e.target.getAttribute("data-file-url");
        const fileName = e.target.getAttribute("data-filename") || "File";

        if (fileUrl) {
          handleViewFile(fileUrl, fileName);
        }
      }
    };

    // Store the current ref value
    const currentEditorRef = richEditorRef.current;

    // Add event listener to the editor
    if (currentEditorRef) {
      currentEditorRef.addEventListener("click", handleFileButtonClick);
    }

    return () => {
      // Use the stored ref in cleanup
      if (currentEditorRef) {
        currentEditorRef.removeEventListener("click", handleFileButtonClick);
      }
    };
  }, []); // Only re-run if the editor reference changes

  // Add this function to handle right-clicks on media elements
  const handleMediaContextMenu = (e) => {
    e.preventDefault();

    // Find the closest media container
    const mediaContainer = e.target.closest(".media-container");
    if (!mediaContainer) return;

    // Determine media type
    let mediaType = "unknown";
    if (mediaContainer.classList.contains("image-container"))
      mediaType = "image";
    if (mediaContainer.classList.contains("video-container"))
      mediaType = "video";
    if (mediaContainer.classList.contains("file-container")) mediaType = "file";

    // Get file ID from data-file-id attribute (we'll add this attribute to media HTML)
    const fileId = mediaContainer.getAttribute("data-file-id");

    // Show context menu
    setContextMenu({
      show: true,
      x: e.pageX,
      y: e.pageY,
      mediaType,
      mediaElement: mediaContainer,
      fileId,
    });
  };

  // Add function to delete media
  const handleDeleteMedia = async () => {
    if (!contextMenu.mediaElement || !contextMenu.fileId) return;

    try {
      // Remove from DOM
      contextMenu.mediaElement.remove();

      // Update rich content
      setRichContent(richEditorRef.current.innerHTML);

      // Delete from backend (only if we have fileId)
      if (contextMenu.fileId) {
        const token = localStorage.getItem("token");
        await fetch(`${API_BASE_URL}/api/files/${contextMenu.fileId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error("Error deleting media:", error);
    } finally {
      // Close context menu
      setContextMenu({
        show: false,
        x: 0,
        y: 0,
        mediaType: null,
        mediaElement: null,
        fileId: null,
      });
    }
  };

  // Add function to replace media
  const handleReplaceMedia = () => {
    if (!contextMenu.mediaElement) return;

    // Open Media Dialog with current media type
    setMediaType(contextMenu.mediaType);
    setMediaElement(contextMenu.mediaElement);
    setIsReplacing(true);
    setShowMediaDialog(true);

    // Close context menu
    setContextMenu({
      show: false,
      x: 0,
      y: 0,
      mediaType: null,
      mediaElement: null,
      fileId: null,
    });
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenu.show && !e.target.closest(".media-context-menu")) {
        setContextMenu({
          show: false,
          x: 0,
          y: 0,
          mediaType: null,
          mediaElement: null,
          fileId: null,
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu.show]);

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

        {/* Modified rich text editor with scrolling fix */}
        <div
          ref={richEditorRef}
          className="editor-content rich-editor"
          contentEditable
          onInput={(e) => {
            // Get current scroll position
            const scrollTop = e.currentTarget.scrollTop;
            const scrollHeight = e.currentTarget.scrollHeight;
            const clientHeight = e.currentTarget.clientHeight;
            const isNearBottom = scrollTop + clientHeight > scrollHeight - 50;

            // Normal rich text input handling
            handleRichTextInput(e);

            // Restore scroll position after component updates
            if (isNearBottom) {
              setTimeout(() => {
                if (richEditorRef.current) {
                  richEditorRef.current.scrollTop =
                    richEditorRef.current.scrollHeight;
                }
              }, 0);
            }
          }}
          onSelect={handleRichTextSelection}
          onClick={handleEditorClick}
          onContextMenu={handleMediaContextMenu}
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(richContent, purifyConfig),
          }}
          placeholder="Start typing your note..."
        ></div>

        {/* Editor toolbar is always shown */}
        <EditorToolbar onFormatText={handleFormatText} />
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
        noteContent={richContent}
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

      {/* Right filebar side */}
      <FileSidebar
        isOpen={fileSidebar.isOpen}
        onClose={() => setFileSidebar({ ...fileSidebar, isOpen: false })}
        fileUrl={fileSidebar.fileUrl}
        fileName={fileSidebar.fileName}
      />

      {/* Media context menu - NEW */}
      {contextMenu.show && (
        <MediaContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onDelete={handleDeleteMedia}
          onReplace={handleReplaceMedia}
          onClose={() =>
            setContextMenu({
              show: false,
              x: 0,
              y: 0,
              mediaType: null,
              mediaElement: null,
              fileId: null,
            })
          }
        />
      )}

      {/* Media Dialog for replacements - NEW */}
      {showMediaDialog && (
        <MediaDialog
          type={mediaType}
          isOpen={showMediaDialog}
          onClose={() => {
            setShowMediaDialog(false);
            setIsReplacing(false);
            setMediaElement(null);
          }}
          onInsert={(type, data) => {
            handleMediaInsertion(type, data);
            setShowMediaDialog(false);
          }}
        />
      )}
    </div>
  );
};

export default NoteEditor;
