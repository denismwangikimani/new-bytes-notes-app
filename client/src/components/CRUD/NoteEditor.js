import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import DOMPurify from "dompurify";
import EditorHeader from "./EditorHeader";
import { useSidebar } from "./SidebarContext";
import AIAssistant from "../AIAssistant";
import AIModal from "../AIModal";
import AskAIModal from "../AskAIModal";
import TextSelectionToolbar from "../TextSelectionToolbar";
import TextPreviewModal from "../TextPreviewModal";
import EditorToolbar from "../EditorToolbar";
import {
  generateContent,
  transformText,
  //generateFlashcards,
} from "../../services/geminiService"; // Added generateFlashcards
import FlashcardModal from "../FlashcardModal";
import FileSidebar from "./FileSidebar";
import MediaContextMenu from "../MediaContextMenu";
import MediaDialog from "../MediaDialog";
import "./notes.css";

// Slate imports
import {
  createEditor,
  //Descendant,
  Editor,
  Transforms,
  Element as SlateElement,
  Text,
  Range,
  Node,
  //Path, // Added Path
} from "slate";
import {
  Slate,
  Editable,
  withReact,
  ReactEditor, // Added ReactEditor
  //useSlateStatic, // Added useSlateStatic for renderElement/Leaf if needed
  DefaultElement, // Added DefaultElement
} from "slate-react";
import { withHistory } from "slate-history";
import isHotkey from "is-hotkey";
import escapeHtml from "escape-html"; // Need to install: npm install escape-html
//import { jsx } from "slate-hyperscript"; // For deserialization

// --- HTML Deserialization/Serialization (Outside Component) ---

const ELEMENT_TAGS = {
  A: (el) => ({
    type: "link",
    url: el.getAttribute("href"),
    children: deserializeChildren(el),
  }),
  BLOCKQUOTE: (el) => ({
    type: "block-quote",
    children: deserializeChildren(el),
  }),
  H1: (el) => ({ type: "heading-one", children: deserializeChildren(el) }),
  H2: (el) => ({ type: "heading-two", children: deserializeChildren(el) }),
  H3: (el) => ({ type: "heading-three", children: deserializeChildren(el) }),
  // Add H4, H5, H6 if needed
  IMG: (el) => {
    const url = el.getAttribute("src");
    const fileId = el.parentElement?.getAttribute("data-file-id"); // Get fileId from parent div
    return { type: "image", url, fileId, children: [{ text: "" }] }; // isVoid is implicit for image type now
  },
  VIDEO: (el) => {
    const url = el.getAttribute("src");
    const fileId = el.parentElement?.getAttribute("data-file-id"); // Get fileId from parent div
    return { type: "video", url, fileId, children: [{ text: "" }] }; // isVoid is implicit for video type
  },
  LI: (el) => ({ type: "list-item", children: deserializeChildren(el) }),
  OL: (el) => ({ type: "numbered-list", children: deserializeChildren(el) }),
  P: (el) => ({ type: "paragraph", children: deserializeChildren(el) }),
  PRE: (el) => ({ type: "code", children: deserializeChildren(el) }), // Assuming PRE contains code text directly or within CODE
  UL: (el) => ({ type: "bulleted-list", children: deserializeChildren(el) }),
  DIV: (el) => {
    // Handle custom divs for files
    if (el.classList.contains("file-container")) {
      const url = el.getAttribute("data-file-url");
      const filename = el.getAttribute("data-filename");
      const fileId = el.getAttribute("data-file-id");
      const sizeStr = el.querySelector(".file-size")?.textContent || "0 bytes";
      // Basic parsing for size, might need refinement
      let size = 0;
      if (sizeStr.includes("KB")) size = parseFloat(sizeStr) * 1024;
      else if (sizeStr.includes("MB")) size = parseFloat(sizeStr) * 1024 * 1024;
      else size = parseInt(sizeStr);

      return {
        type: "file",
        url,
        filename,
        size,
        fileId,
        children: [{ text: "" }],
      }; // isVoid is implicit
    }
    // Handle other divs, maybe treat as paragraphs or ignore?
    return { type: "paragraph", children: deserializeChildren(el) };
  },
  // Add other block elements as needed (TABLE, TR, TD, etc.)
};

const TEXT_TAGS = {
  CODE: () => ({ code: true }),
  DEL: () => ({ strikethrough: true }),
  EM: () => ({ italic: true }),
  I: () => ({ italic: true }),
  S: () => ({ strikethrough: true }),
  STRONG: () => ({ bold: true }),
  U: () => ({ underline: true }),
  SPAN: (el) => {
    // Handle styles from spans
    const style = el.getAttribute("style") || "";
    const marks = {};
    const colorMatch = style.match(/color:\s*([^;]+);?/);
    const bgColorMatch = style.match(/background-color:\s*([^;]+);?/);
    const fontStyleMatch = style.match(/font-style:\s*italic;?/); // Handle italic via style
    const fontWeightMatch = style.match(/font-weight:\s*bold;?/); // Handle bold via style
    const textDecorationMatch = style.match(/text-decoration:\s*underline;?/); // Handle underline via style
    const textDecorationLineThroughMatch = style.match(
      /text-decoration:\s*line-through;?/
    ); // Handle strikethrough via style
    const fontFamilyMatch = style.match(/font-family:\s*([^;]+);?/);
    const fontSizeMatch = style.match(/font-size:\s*([^;]+);?/);

    if (colorMatch) marks.textColor = colorMatch[1].trim();
    if (bgColorMatch) marks.backgroundColor = bgColorMatch[1].trim();
    if (fontStyleMatch) marks.italic = true;
    if (fontWeightMatch) marks.bold = true;
    if (textDecorationMatch) marks.underline = true;
    if (textDecorationLineThroughMatch) marks.strikethrough = true;
    if (fontFamilyMatch)
      marks.fontFamily = fontFamilyMatch[1].replace(/['"]/g, "").trim(); // Remove quotes
    if (fontSizeMatch) marks.fontSize = fontSizeMatch[1].trim();

    return marks;
  },
};

const deserializeChildren = (parent) => {
  return Array.from(parent.childNodes)
    .map((node) => deserializeNode(node))
    .flat()
    .filter((node) => node !== null);
};

const deserializeNode = (el) => {
  if (el.nodeType === 3) {
    // TEXT_NODE
    const text = el.textContent;
    // If text node is just whitespace and adjacent to block elements, ignore it (or keep if needed)
    if (
      !text.trim() &&
      (el.previousSibling?.nodeType === 1 || el.nextSibling?.nodeType === 1)
    ) {
      // return null; // Option: Ignore pure whitespace between blocks
    }
    // ALWAYS return a Text node object
    return { text: text || "" }; // Ensure text property exists even if empty
  } else if (el.nodeType === 1) {
    // ELEMENT_NODE
    const { nodeName } = el;

    // Handle void elements like BR - treat as newline text? Or handle differently?
    if (nodeName === "BR") {
      // Option 1: Treat as newline character within text (might not work well across blocks)
      // return '\n';
      // Option 2: Ignore BR if Slate handles block spacing automatically (often preferred)
      return null;
    }

    // Handle elements needing specific structure (like lists wrapping LIs)
    // This basic deserializer assumes direct mapping. Complex structures might need pre-processing.

    let children = deserializeChildren(el);

    // If an element has no children or only empty/whitespace text, ensure it has at least one empty text node
    // This is important for Slate's model, especially for block elements.
    if (
      children.length === 0 ||
      children.every((c) => typeof c === "string" && !c.trim())
    ) {
      children = [{ text: "" }];
    }

    const elementFn = ELEMENT_TAGS[nodeName];
    if (elementFn) {
      const node = elementFn(el);
      // Ensure the returned node has children if it's not a void element type we define
      if (!["image", "video", "file"].includes(node.type) && !node.children) {
        node.children = children;
      }
      // Apply alignment from style attribute if present
      const textAlign = el.style.textAlign;
      if (
        textAlign &&
        ["left", "center", "right", "justify"].includes(textAlign)
      ) {
        node.align = textAlign;
      }
      return node;
    }

    const markFn = TEXT_TAGS[nodeName];
    if (markFn) {
      const marks = markFn(el);
      // Apply marks to children, merging recursively
      return children.map((child) => {
        // Ensure child is a valid Slate Node (Text or Inline Element) before merging
        if (Text.isText(child)) {
          // Merge marks: new marks overwrite existing ones if keys conflict.
          return { ...child, ...marks };
        } else if (
          SlateElement.isElement(child) /* && editor.isInline(child) */
        ) {
          // If you allow marks on inline elements, handle that here. Usually marks are on Text.
          // For simplicity, let's assume marks only apply to Text nodes.
          // If child is an inline element, return it as is or handle its children recursively?
          // The current .flat() in deserializeChildren might handle nested inlines.
          return child; // Return inline elements without applying text marks directly
        }
        // This case should ideally not be hit if children are properly deserialized
        console.warn("Unexpected child type during mark application:", child);
        return child;
      });
    }

    // Default fallback: If it's an unknown block element, treat as paragraph. If inline, just return children.
    // This requires knowing which HTML tags are block vs inline.
    // Simple approach: If it contains block children, return children. Otherwise wrap in paragraph.
    const containsBlockChild = children.some(
      (child) =>
        typeof child === "object" &&
        child !== null &&
        !Text.isText(child) &&
        Editor.isBlock({ type: "paragraph", children: [] }, child)
    ); // Use dummy editor for isBlock check
    if (containsBlockChild) {
      return children; // Pass children up if it contains blocks
    } else {
      // Treat as paragraph if it's a block-level tag we don't recognize, otherwise return children (inline)
      // This is tricky. A safer default might be to always wrap unknown tags in a paragraph.
      // Let's try wrapping unknown element nodes in paragraph for simplicity.
      console.warn(
        "Unknown HTML tag encountered during deserialization:",
        nodeName
      );
      return { type: "paragraph", children: children };
    }
  }

  return null; // Ignore other node types (comments, etc.)
};

// Initial purify config - keep for sanitizing input HTML
const purifyConfig = {
  ADD_ATTR: [
    "target",
    "contenteditable",
    "data-file-url",
    "data-filename",
    "data-file-id",
    "autocapitalize",
    "autocorrect",
    "spellcheck",
    "data-gramm",
    "style", // Allow style for alignment, colors, etc.
  ],
  ADD_TAGS: ["iframe", "div", "span", "video", "source"], // Allow div, span, video
  USE_PROFILES: { html: true }, // Use standard HTML profile
  // FORBID_TAGS: [], // Be specific about what NOT to allow if needed
  // FORBID_ATTR: [],
  ALLOW_DATA_ATTR: true, // Allow data-* attributes
  // Consider allowing specific style properties if needed, though Slate handles most formatting
};

const deserialize = (htmlString) => {
  if (!htmlString || !htmlString.trim()) {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }

  // 1. Sanitize the HTML string FIRST
  const sanitizedHtml = DOMPurify.sanitize(htmlString, purifyConfig);

  // 2. Parse the sanitized HTML
  const parsed = new DOMParser().parseFromString(sanitizedHtml, "text/html");
  const body = parsed.body;

  // If body is empty after sanitization, return default
  if (
    !body ||
    (!body.textContent?.trim() &&
      !body.querySelector("img, video, div.file-container"))
  ) {
    // Check for media too
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }

  // 3. Deserialize the DOM body into Slate nodes
  const slateNodes = deserializeChildren(body);

  // 4. Ensure the top level consists of block nodes. Wrap stray text/inline nodes.
  const ensureBlocks = (nodes) => {
    const wrappedNodes = [];
    let currentParagraph = null;
    const dummyEditor = createEditor(); // Create a temporary editor for isInline check

    for (const node of nodes) {
      if (node === null) continue; // Skip null nodes from deserialization

      const isInlineNode =
        typeof node === "string" ||
        Text.isText(node) ||
        (SlateElement.isElement(node) && dummyEditor.isInline(node));

      if (isInlineNode) {
        if (!currentParagraph) {
          currentParagraph = { type: "paragraph", children: [] };
        }
        // Ensure the pushed node is a valid Text node
        if (typeof node === "string") {
          currentParagraph.children.push({ text: node }); // Wrap string
        } else if (Text.isText(node)) {
          currentParagraph.children.push(node); // Already a Text node
        } else if (SlateElement.isElement(node) && dummyEditor.isInline(node)) {
          // Handle inline elements if necessary, though deserializeNode should handle marks
          // This might need adjustment based on how inline elements like links are handled
          currentParagraph.children.push(node);
        }
      } else {
        // It's a block node
        if (currentParagraph) {
          // Ensure paragraph has non-empty children or a single empty text node
          if (
            currentParagraph.children.length === 0 ||
            currentParagraph.children.every(
              (c) => Text.isText(c) && !c.text.trim()
            )
          ) {
            currentParagraph.children = [{ text: "" }];
          }
          wrappedNodes.push(currentParagraph);
          currentParagraph = null;
        }
        // Ensure block node has valid children structure
        if (SlateElement.isElement(node) && node.children.length === 0) {
          node.children = [{ text: "" }];
        }
        wrappedNodes.push(node);
      }
    }
    // Add any trailing paragraph
    if (currentParagraph) {
      if (
        currentParagraph.children.length === 0 ||
        currentParagraph.children.every((c) => Text.isText(c) && !c.text.trim())
      ) {
        currentParagraph.children = [{ text: "" }];
      }
      wrappedNodes.push(currentParagraph);
    }
    // Ensure the final result is not empty
    return wrappedNodes.length > 0
      ? wrappedNodes
      : [{ type: "paragraph", children: [{ text: "" }] }];
  };

  const finalNodes = ensureBlocks(slateNodes);
  // console.log("Deserialized:", JSON.stringify(finalNodes, null, 2)); // DEBUG
  return finalNodes;
};

// Serialize Slate JSON back to HTML (Example - needs refinement for styles, classes, etc.)
const serializeNode = (node) => {
  if (Text.isText(node)) {
    let string = escapeHtml(node.text);
    // Apply marks - order might matter for nesting (e.g., bold inside italic)
    if (node.code) string = `<code>${string}</code>`;
    if (node.italic) string = `<em>${string}</em>`;
    if (node.underline) string = `<u>${string}</u>`;
    if (node.strikethrough) string = `<s>${string}</s>`;
    if (node.bold) string = `<strong>${string}</strong>`;

    // Apply style marks as spans
    const styles = {};
    if (node.fontFamily) styles["font-family"] = node.fontFamily;
    if (node.fontSize) styles["font-size"] = node.fontSize;
    if (node.textColor) styles.color = node.textColor;
    if (node.backgroundColor) styles["background-color"] = node.backgroundColor;

    if (Object.keys(styles).length > 0) {
      const styleString = Object.entries(styles)
        .map(([k, v]) => `${k}: ${v};`)
        .join(" ");
      string = `<span style="${styleString}">${string}</span>`;
    }

    return string;
  }

  // It's an element node
  const children = node.children.map((n) => serializeNode(n)).join("");

  // Handle alignment style
  const style = node.align ? ` style="text-align: ${node.align};"` : "";

  switch (node.type) {
    case "paragraph":
      return `<p${style}>${children || "&nbsp;"}</p>`; // Use &nbsp; for empty paragraphs? Or let CSS handle height.
    case "heading-one":
      return `<h1${style}>${children}</h1>`;
    case "heading-two":
      return `<h2${style}>${children}</h2>`;
    case "heading-three":
      return `<h3${style}>${children}</h3>`;
    // Add H4, H5, H6 if needed
    case "list-item":
      return `<li${style}>${children}</li>`;
    case "numbered-list":
      return `<ol${style}>${children}</ol>`;
    case "bulleted-list":
      return `<ul${style}>${children}</ul>`;
    case "block-quote":
      return `<blockquote${style}>${children}</blockquote>`;
    case "code": // Code block
      return `<pre${style}><code>${children}</code></pre>`;
    case "link":
      return `<a href="${escapeHtml(
        node.url
      )}" target="_blank" rel="noopener noreferrer">${children}</a>`;
    case "image":
      // Wrap in div like the original structure for consistency and fileId
      return `<div class="media-container image-container" contenteditable="false" data-file-id="${
        node.fileId || ""
      }"><img src="${escapeHtml(
        node.url
      )}" alt="" style="max-width: 100%;" /></div>`;
    case "video":
      // Wrap in div
      return `<div class="media-container video-container" contenteditable="false" data-file-id="${
        node.fileId || ""
      }"><video controls src="${escapeHtml(
        node.url
      )}" style="max-width: 100%;"></video></div>`;
    case "file":
      // Recreate the file preview structure
      return `
        <div class="media-container file-container" contenteditable="false" data-file-url="${escapeHtml(
          node.url || ""
        )}" data-filename="${escapeHtml(node.filename || "")}" data-file-id="${
        node.fileId || ""
      }">
          <div class="file-preview">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="file-info">
              <span class="file-name" data-file-url="${escapeHtml(
                node.url || ""
              )}" data-filename="${escapeHtml(
        node.filename || ""
      )}">${escapeHtml(node.filename || "File")}</span>
              <span class="file-size">${formatFileSize(node.size || 0)}</span>
              <button class="view-file-button" data-file-url="${escapeHtml(
                node.url || ""
              )}" data-filename="${escapeHtml(
        node.filename || ""
      )}" type="button">View</button>
            </div>
          </div>
        </div>`;
    default:
      // Default to just rendering children for unknown types
      return children;
  }
};

const serialize = (value) => {
  // Ensure value is an array
  if (!Array.isArray(value)) {
    console.error("Invalid Slate value for serialization:", value);
    return "";
  }
  return value.map((n) => serializeNode(n)).join("");
};

// Helper function to format file size (keep outside or move inside if preferred)
const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + " bytes";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// --- NoteEditor Component ---

const NoteEditor = ({ note, onUpdate, onCreate }) => {
  // --- Existing state variables ---
  const [title, setTitle] = useState(note?.title || "");
  // const [content, setContent] = useState(note?.content || ""); // REMOVED - Replaced by slateValue
  // const contentRef = useRef(null); // REMOVED - Not needed for Slate's Editable
  // const lastCursorPosition = useRef(0); // REMOVED - Slate handles cursor
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiResponse, setAIResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false); // General loading? Or specific AI loading?

  // Text selection and transformation states
  const [selectionPosition, setSelectionPosition] = useState(null);
  const [selectedText, setSelectedText] = useState("");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [transformedText, setTransformedText] = useState("");
  const [isTransformLoading, setIsTransformLoading] = useState(false);
  const [transformType, setTransformType] = useState("");
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);

  // Ask AI states
  const [isAskAIModalOpen, setIsAskAIModalOpen] = useState(false);
  const [askAIResponse, setAskAIResponse] = useState("");
  const [isAskAILoading, setIsAskAILoading] = useState(false);

  // --- Slate Specific State ---
  // Use useMemo instead so a new editor is created when the note changes
  const editor = useMemo(() => {
    console.log(
      "Creating new editor instance for note:",
      note?._id || "new note"
    );
    return withHistory(withReact(createEditor()));
  }, [note?._id]); // Recreate editor when note ID changes

  // Initial value derived from note content using deserialization
  const initialValue = useMemo(() => {
    const deserialized = deserialize(note?.content);
    // Ensure deserialize ALWAYS returns a valid array, even if empty/error
    return Array.isArray(deserialized) && deserialized.length > 0
      ? deserialized
      : [{ type: "paragraph", children: [{ text: "" }] }]; // Fallback default
  }, [note?.content]); // Memoize initial value to avoid re-computing on every render

  // State to hold the current Slate value (JSON) - Correct JS syntax
  const [slateValue, setSlateValue] = useState(initialValue);

  // Update useEffect for note changes
  useEffect(() => {
    // Create an empty default state
    const emptyState = [{ type: "paragraph", children: [{ text: "" }] }];

    console.log(
      "Note changed to:",
      note?._id,
      "with content:",
      note?.content?.substring(0, 50)
    );

    if (!note) {
      // Handle undefined note case
      console.log("No note provided - setting empty state");
      setSlateValue(emptyState);
      setTitle("");
      return;
    }

    if (note._id) {
      // Existing note
      if (note.content) {
        // Note has content - deserialize it
        const newSlateValue = deserialize(note.content);
        console.log(
          "Loading existing note content:",
          newSlateValue.length,
          "nodes"
        );
        setSlateValue(newSlateValue);
      } else {
        // Note exists but has no content
        console.log("Note exists but has no content - setting empty state");
        setSlateValue(emptyState);
      }
      setTitle(note.title || "");
    } else {
      // New note - always reset to completely empty
      console.log("Creating new note - setting empty state");
      setSlateValue(emptyState);
      setTitle("");
    }
  }, [note?._id, note?.content, note?.title]);

  // --- Other State ---
  const { isSidebarOpen } = useSidebar();
  const updateTimeoutRef = useRef(null); // For debouncing updates

  // File sidebar states
  const [fileSidebar, setFileSidebar] = useState({
    isOpen: false,
    fileUrl: "",
    fileName: "",
    recentlyClosed: false,
  });

  // Media context menu states
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
    path: null, // Store Path instead of DOM element
    mediaType: null,
    fileId: null,
  });

  // State vars for media replacement
  const [mediaTypeForDialog, setMediaTypeForDialog] = useState(null); // Renamed to avoid conflict
  // const [mediaElement, setMediaElement] = useState(null); // REMOVED - Use path from contextMenu
  const [isReplacing, setIsReplacing] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);

  const API_BASE_URL = "https://new-bytes-notes-backend.onrender.com";

  // --- Effects ---

  // Debounced Auto-Save Logic using Slate value
  useEffect(() => {
    // Clear any existing timer when slateValue or title changes
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Set a new timer
    updateTimeoutRef.current = setTimeout(() => {
      if (note?._id) {
        const currentContent = serialize(slateValue); // Serialize current state
        // Check if title or content has actually changed from the original note prop
        if (currentContent !== note.content || title !== note.title) {
          console.log("Auto-saving note...");
          onUpdate(note._id, { title, content: currentContent });
        }
      }
    }, 3000); // Adjust debounce time as needed (e.g., 3 seconds)

    // Cleanup function to clear timer on unmount or before next effect run
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [slateValue, title, note, onUpdate, editor]); // Include editor if its state affects serialization indirectly

  // --- Slate Helper Functions (Inside Component) ---

  // --- File Sidebar ---
  const handleViewFile = useCallback((fileUrl, fileName) => {
    setFileSidebar({
      isOpen: true,
      fileUrl,
      fileName,
      recentlyClosed: false, // Ensure this is false when opening
    });
  }, []);

  const handleCloseFileSidebar = () => {
    setFileSidebar({
      ...fileSidebar,
      isOpen: false,
      recentlyClosed: true,
    });
    // Reset the flag after a delay
    setTimeout(() => {
      setFileSidebar((prev) => ({ ...prev, recentlyClosed: false }));
    }, 500); // Adjust delay as needed
  };

  // Custom Editor Commands (can be moved to a separate file)
  const CustomEditor = useMemo(
    () => ({
      // Wrap in useMemo if needed, though methods are stable
      isMarkActive(editor, format) {
        const marks = Editor.marks(editor);
        return marks ? marks[format] === true : false;
      },

      toggleMark(editor, format) {
        const isActive = CustomEditor.isMarkActive(editor, format);
        if (isActive) {
          Editor.removeMark(editor, format);
        } else {
          // Special handling for style marks (font, color) - remove others if applying one?
          // Simple toggle for now:
          Editor.addMark(editor, format, true);
        }
        ReactEditor.focus(editor); // Keep focus
      },

      isBlockActive(editor, format, blockType = "type") {
        const { selection } = editor;
        if (!selection) return false;
        const [match] = Editor.nodes(editor, {
          at: Editor.unhangRange(editor, selection),
          match: (n) =>
            !Editor.isEditor(n) &&
            SlateElement.isElement(n) &&
            n[blockType] === format,
        });
        return !!match;
      },

      toggleBlock(editor, format) {
        const isActive = CustomEditor.isBlockActive(editor, format);
        const isList = ["numbered-list", "bulleted-list"].includes(format);
        const isIndentable = [
          "paragraph",
          "heading-one",
          "heading-two",
          "heading-three",
          "block-quote",
          "list-item",
        ].includes(format); // Add types that can be list items

        // Unwrap lists first
        Transforms.unwrapNodes(editor, {
          match: (n) =>
            !Editor.isEditor(n) &&
            SlateElement.isElement(n) &&
            ["numbered-list", "bulleted-list"].includes(n.type),
          split: true,
        });

        let newProperties;
        // Determine the new type based on current state and desired format
        if (isActive) {
          // If it's active, turn it back into a paragraph
          newProperties = { type: "paragraph" };
        } else if (isList) {
          // If turning into a list item, set type to 'list-item'
          newProperties = { type: "list-item" };
        } else {
          // Otherwise, set type to the desired block format
          newProperties = { type: format };
        }

        // Apply the new properties only to relevant block types
        Transforms.setNodes(
          // Remove <SlateElement>
          editor,
          newProperties,
          {
            match: (n) =>
              SlateElement.isElement(n) &&
              Editor.isBlock(editor, n) &&
              isIndentable, // Apply only to block types that make sense
          }
        );

        // If the target format is a list, wrap the nodes in the list container
        if (!isActive && isList) {
          const block = { type: format, children: [] };
          Transforms.wrapNodes(editor, block, {
            match: (n) => SlateElement.isElement(n) && n.type === "list-item", // Wrap only the list items
          });
        }
        ReactEditor.focus(editor); // Keep focus
      },

      toggleAlignment(editor, alignValue) {
        // If alignValue is the same as current, maybe remove alignment? Or just apply.
        // Simple approach: always set the alignment.
        Transforms.setNodes(
          editor,
          { align: alignValue },
          {
            match: (n) =>
              SlateElement.isElement(n) && Editor.isBlock(editor, n),
          } // Apply to block elements
        );
        ReactEditor.focus(editor); // Keep focus
      },

      // Add/Remove marks for styles like font family, size, color
      setStyleMark(editor, format, value) {
        if (editor.selection) {
          // If selection is collapsed, apply to the typing marks
          if (Range.isCollapsed(editor.selection)) {
            Editor.addMark(editor, format, value);
          } else {
            // If text is selected, apply to the selection
            Transforms.setNodes(
              editor,
              { [format]: value },
              { match: Text.isText, split: true }
            );
          }
        } else {
          // Apply to typing marks if no selection
          Editor.addMark(editor, format, value);
        }
        ReactEditor.focus(editor); // Keep focus
      },
      // removeStyleMark(editor, format) { // Might not be needed if toggleMark handles it
      //     Editor.removeMark(editor, format);
      // }
    }),
    [editor]
  ); // Dependency: editor

  // --- Rendering Callbacks for Slate ---
  const renderElement = useCallback(
    ({ attributes, children, element }) => {
      const style = element.align ? { textAlign: element.align } : {};

      // Helper to get attributes for media elements
      const getMediaAttributes = (el) => ({
        ...attributes,
        contentEditable: false,
        "data-file-id": el.fileId || "",
        "data-file-url": el.url || "", // Needed for file type
        "data-filename": el.filename || "", // Needed for file type
        className: `media-container ${el.type}-container`,
        style: {
          // Add styles for void elements (prevents selection issues)
          userSelect: "none",
          // Add margin/padding if needed for spacing
          margin: "0.5em 0",
        },
      });

      switch (element.type) {
        case "heading-one":
          return (
            <h1 {...attributes} style={style}>
              {children}
            </h1>
          );
        case "heading-two":
          return (
            <h2 {...attributes} style={style}>
              {children}
            </h2>
          );
        case "heading-three":
          return (
            <h3 {...attributes} style={style}>
              {children}
            </h3>
          );
        // Add H4, H5, H6 if needed
        case "list-item":
          return (
            <li {...attributes} style={style}>
              {children}
            </li>
          );
        case "numbered-list":
          return (
            <ol {...attributes} style={style}>
              {children}
            </ol>
          );
        case "bulleted-list":
          return (
            <ul {...attributes} style={style}>
              {children}
            </ul>
          );
        case "block-quote":
          return (
            <blockquote {...attributes} style={style}>
              {children}
            </blockquote>
          );
        case "code": // Code block
          return (
            <pre {...attributes}>
              <code style={style}>{children}</code>
            </pre>
          );
        case "link":
          return (
            <a
              {...attributes}
              href={element.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        case "image":
          return (
            <div {...getMediaAttributes(element)}>
              {children} {/* Must include children for Slate void elements */}
              <img
                src={element.url}
                alt=""
                style={{ maxWidth: "100%", display: "block" }}
              />
            </div>
          );
        case "video":
          return (
            <div {...getMediaAttributes(element)}>
              {children}
              <video
                controls
                src={element.url}
                style={{ maxWidth: "100%", display: "block" }}
              />
            </div>
          );
        case "file":
          return (
            <div {...getMediaAttributes(element)}>
              {children}
              <div className="file-preview">
                {/* SVG Icon */}
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="file-info">
                  <span
                    className="file-name"
                    data-file-url={element.url}
                    data-filename={element.filename}
                  >
                    {element.filename || "File"}
                  </span>
                  <span className="file-size">
                    {formatFileSize(element.size || 0)}
                  </span>
                  <button
                    className="view-file-button"
                    data-file-url={element.url}
                    data-filename={element.filename}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault(); // Prevent Slate focus issues
                      handleViewFile(element.url, element.filename);
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          );
        case "paragraph": // Explicitly handle paragraph
          return (
            <p {...attributes} style={style}>
              {children}
            </p>
          );
        default:
          // Use DefaultElement for unrecognized block types or fallback
          return (
            <DefaultElement {...attributes} element={element} style={style}>
              {children}
            </DefaultElement>
          );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [handleViewFile]
  ); // Add handleViewFile dependency

  const renderLeaf = useCallback(({ attributes, children, leaf }) => {
    let el = <>{children}</>;

    // Apply standard marks
    if (leaf.bold) el = <strong>{el}</strong>;
    if (leaf.italic) el = <em>{el}</em>;
    if (leaf.underline) el = <u>{el}</u>;
    if (leaf.strikethrough) el = <s>{el}</s>;
    if (leaf.code) el = <code>{el}</code>;

    // Apply style marks via inline styles
    const styles = {};
    if (leaf.fontFamily) styles.fontFamily = leaf.fontFamily;
    if (leaf.fontSize) styles.fontSize = leaf.fontSize;
    if (leaf.textColor) styles.color = leaf.textColor;
    if (leaf.backgroundColor) styles.backgroundColor = leaf.backgroundColor;

    if (Object.keys(styles).length > 0) {
      el = <span style={styles}>{el}</span>;
    }

    return <span {...attributes}>{el}</span>; // Always wrap in span with attributes
  }, []);

  // --- Event Handlers ---

  // Handle Toolbar Actions
  const handleFormatText = (formatType, value = null) => {
    // Media insertion is handled by EditorToolbar opening MediaDialog
    if (["image", "video", "file", "link"].includes(formatType)) {
      // If it's a link, we might want to prompt for URL here or use a specific link button logic
      if (formatType === "link") {
        const url = window.prompt("Enter the URL of the link:");
        if (url) {
          insertLink(editor, url);
        }
      } else {
        // For other media, open the dialog
        setMediaTypeForDialog(formatType); // Use the renamed state
        setShowMediaDialog(true);
      }
      return;
    }

    // Apply formatting using CustomEditor commands
    switch (formatType) {
      // Marks
      case "bold":
      case "italic":
      case "underline":
      case "strikethrough":
      case "code": // Inline code
        CustomEditor.toggleMark(editor, formatType);
        break;

      // Blocks
      case "heading": // value should be 'h1', 'h2', etc.
        const headingMap = {
          h1: "heading-one",
          h2: "heading-two",
          h3: "heading-three",
        };
        CustomEditor.toggleBlock(editor, headingMap[value] || "paragraph");
        break;
      case "blockquote":
        CustomEditor.toggleBlock(editor, "block-quote");
        break;
      case "bulletList":
        CustomEditor.toggleBlock(editor, "bulleted-list");
        break;
      case "numberedList":
        CustomEditor.toggleBlock(editor, "numbered-list");
        break;
      // case "codeBlock": // If you add a dedicated code block button
      //   CustomEditor.toggleBlock(editor, 'code');
      //   break;

      // Styles/Properties
      case "align": // value: 'left', 'center', 'right', 'justify'
        CustomEditor.toggleAlignment(editor, value);
        break;
      case "fontFamily":
      case "fontSize":
      case "textColor":
      case "backgroundColor":
        CustomEditor.setStyleMark(editor, formatType, value);
        break;

      default:
        console.log(
          "Slate formatting not implemented in handleFormatText: ",
          formatType
        );
    }
  };

  // Handle Keyboard Shortcuts
  const handleKeyDown = useCallback(
    (event) => {
      // Handle hotkeys for marks
      for (const hotkey in HOTKEYS) {
        if (isHotkey(hotkey, event)) {
          event.preventDefault();
          const mark = HOTKEYS[hotkey];
          CustomEditor.toggleMark(editor, mark);
          return;
        }
      }

      // Handle other keys if needed (e.g., Enter in lists, code blocks)
      // switch (event.key) {
      //   case 'Enter':
      //     // Add custom Enter logic here if necessary
      //     break;
      //   case 'Tab':
      //       // Add custom Tab logic (e.g., indent list items)
      //       event.preventDefault();
      //       // Transforms.insertText(editor, '    '); // Basic tab
      //       // Or handle list indentation
      //       break;
      // }
    },
    [editor, CustomEditor]
  ); // Add dependencies

  const HOTKEYS = {
    "mod+b": "bold",
    "mod+i": "italic",
    "mod+u": "underline",
    "mod+`": "code", // Inline code
  };

  // --- Media Handling ---

  // Insert Link Helper
  const insertLink = (editor, url) => {
    if (!url) return;
    const { selection } = editor;
    const link = {
      type: "link",
      url,
      children: selection && Range.isExpanded(selection) ? [] : [{ text: url }], // Use selection or URL as text
    };

    if (selection) {
      if (Range.isExpanded(selection)) {
        Transforms.wrapNodes(editor, link, { split: true });
        Transforms.collapse(editor, { edge: "end" });
      } else {
        Transforms.insertNodes(editor, link);
      }
    } else {
      Transforms.insertNodes(editor, link); // Insert at end if no selection
    }
    ReactEditor.focus(editor);
  };

  // Insert Media (Image, Video, File) Helper
  const insertMedia = (editor, type, data) => {
    if (!data || !data.url) return;

    const fileId = data.url.split("/").pop(); // Basic way to get potential ID
    let newNode;

    switch (type) {
      case "image":
        newNode = {
          type: "image",
          url: data.url,
          fileId,
          children: [{ text: "" }], // Void elements need an empty text child
        };
        break;
      case "video":
        newNode = {
          type: "video",
          url: data.url,
          fileId,
          children: [{ text: "" }], // Void elements need an empty text child
        };
        break;
      case "file":
        newNode = {
          type: "file",
          url: data.url,
          filename: data.filename,
          size: data.size,
          fileId,
          children: [{ text: "" }], // Void elements need an empty text child
        };
        break;
      default:
        return;
    }

    // Insert the void node
    Transforms.insertNodes(editor, newNode);

    // Optionally insert a paragraph after it for better spacing/typing experience
    Transforms.insertNodes(editor, {
      type: "paragraph",
      children: [{ text: "" }],
    });

    // Ensure focus remains in the editor, potentially after the inserted element
    ReactEditor.focus(editor);
    // Position cursor in the newly added paragraph
    Transforms.select(editor, Editor.end(editor, []));
  };

  // Handle Insertion from Media Dialog
  const handleInsertFromDialog = (type, data) => {
    if (isReplacing && contextMenu.path) {
      // Replacing existing media
      const path = contextMenu.path;
      const fileId = data.url.split("/").pop();
      let newNode;
      switch (type) {
        case "image":
          newNode = {
            type: "image",
            url: data.url,
            fileId,
            children: [{ text: "" }],
          };
          break;
        case "video":
          newNode = {
            type: "video",
            url: data.url,
            fileId,
            children: [{ text: "" }],
          };
          break;
        case "file":
          newNode = {
            type: "file",
            url: data.url,
            filename: data.filename,
            size: data.size,
            fileId,
            children: [{ text: "" }],
          };
          break;
        default:
          return;
      }
      // Remove the old node and insert the new one at the same path
      Transforms.removeNodes(editor, { at: path });
      Transforms.insertNodes(editor, newNode, { at: path });

      // TODO: Delete old file from backend if necessary (using contextMenu.fileId)
    } else {
      // Inserting new media
      insertMedia(editor, type, data);
    }

    // Reset state
    setShowMediaDialog(false);
    setIsReplacing(false);
    setContextMenu({
      show: false,
      x: 0,
      y: 0,
      path: null,
      mediaType: null,
      fileId: null,
    });
    ReactEditor.focus(editor);
  };

  // Handle Right-Click on Media
  const handleMediaContextMenu = useCallback(
    (event) => {
      event.preventDefault();

      // Get the root editor element
      const editorRoot = ReactEditor.toDOMNode(editor, editor);
      if (!editorRoot) return;

      // Check if the clicked target is actually within the editor's content area
      if (!editorRoot.contains(event.target)) {
        // Click was outside the editable area, hide context menu
        setContextMenu({
          show: false,
          x: 0,
          y: 0,
          path: null,
          mediaType: null,
          fileId: null,
        });
        return;
      }

      let path;
      try {
        // Try finding the path ONLY if the target is within the editor
        path = ReactEditor.findPath(editor, event.target);
      } catch (error) {
        // findPath can throw if the target isn't recognized
        console.error(
          "Error in ReactEditor.findPath:",
          error,
          "Target:",
          event.target
        );
        setContextMenu({
          show: false,
          x: 0,
          y: 0,
          path: null,
          mediaType: null,
          fileId: null,
        });
        return;
      }

      if (!path) {
        setContextMenu({
          show: false,
          x: 0,
          y: 0,
          path: null,
          mediaType: null,
          fileId: null,
        });
        return;
      }

      try {
        const [node] = Editor.node(editor, path);

        if (
          SlateElement.isElement(node) &&
          ["image", "video", "file"].includes(node.type)
        ) {
          setContextMenu({
            show: true,
            x: event.clientX,
            y: event.clientY,
            path: path,
            mediaType: node.type,
            fileId: node.fileId,
          });
        } else {
          // Clicked somewhere else inside editor, hide context menu
          setContextMenu({
            show: false,
            x: 0,
            y: 0,
            path: null,
            mediaType: null,
            fileId: null,
          });
        }
      } catch (error) {
        console.error("Error finding node for context menu:", error);
        setContextMenu({
          show: false,
          x: 0,
          y: 0,
          path: null,
          mediaType: null,
          fileId: null,
        });
      }
    },
    [editor] // Keep editor dependency
  );

  // Handle Delete Media from Context Menu
  const handleDeleteMedia = useCallback(async () => {
    if (!contextMenu.path) return;

    const pathToDelete = contextMenu.path; // Capture path before resetting state
    const fileIdToDelete = contextMenu.fileId;

    // Close context menu immediately
    setContextMenu({
      show: false,
      x: 0,
      y: 0,
      path: null,
      mediaType: null,
      fileId: null,
    });

    try {
      // Remove node from Slate editor
      Transforms.removeNodes(editor, { at: pathToDelete });

      // Delete from backend (only if we have fileId)
      if (fileIdToDelete) {
        const token = localStorage.getItem("token");
        if (token) {
          await fetch(`${API_BASE_URL}/api/files/${fileIdToDelete}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          console.log("Deleted media from backend:", fileIdToDelete);
        } else {
          console.warn("No token found, cannot delete media from backend.");
        }
      }
    } catch (error) {
      console.error("Error deleting media:", error);
      // Optionally show an error message to the user
    } finally {
      ReactEditor.focus(editor);
    }
  }, [editor, contextMenu.path, contextMenu.fileId, API_BASE_URL]);

  // Handle Replace Media from Context Menu
  const handleReplaceMedia = useCallback(() => {
    if (!contextMenu.path || !contextMenu.mediaType) return;

    // Keep path info, open dialog
    setIsReplacing(true);
    setMediaTypeForDialog(contextMenu.mediaType); // Set the type for the dialog
    setShowMediaDialog(true);

    // Context menu state is kept until replacement happens or dialog is closed
    // No need to close context menu here, dialog closure handles reset
  }, [contextMenu.path, contextMenu.mediaType]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if the click is outside the context menu itself
      if (contextMenu.show && !event.target.closest(".media-context-menu")) {
        setContextMenu({
          show: false,
          x: 0,
          y: 0,
          path: null,
          mediaType: null,
          fileId: null,
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu.show]);

  // --- AI & Text Transformation ---

  // Update selection state for toolbar
  const handleSlateChange = (newValue) => {
    console.log("Editor content changed:", JSON.stringify(newValue).substring(0, 100));
    setSlateValue(newValue); // Update main state

    const { selection } = editor;

    if (selection && Range.isExpanded(selection)) {
      try {
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          const domRange = domSelection.getRangeAt(0);
          const rect = domRange.getBoundingClientRect();
          const editorRoot = ReactEditor.toDOMNode(editor, editor); // Get editor root DOM node
          const editorRect = editorRoot.getBoundingClientRect();

          setSelectionPosition({
            // Position relative to the editor or viewport? Viewport is easier.
            x: rect.left + window.scrollX + rect.width / 2,
            y: rect.top + window.scrollY - 10, // Offset above selection
          });
          setSelectedText(Editor.string(editor, selection));
        } else {
          setSelectionPosition(null);
        }
      } catch (e) {
        console.error("Error getting selection rect:", e);
        setSelectionPosition(null);
      }
    } else {
      setSelectionPosition(null);
      setSelectedText("");
    }
  };

  // Handle AI prompt submission (General AI Assistant)
  const handleAISubmit = async (prompt) => {
    setIsLoading(true); // Use general loading or a specific one?
    setAIResponse(""); // Clear previous response
    try {
      const response = await generateContent(prompt);
      setAIResponse(response);

      // Insert response into Slate editor at current selection/cursor
      if (response) {
        Transforms.insertText(editor, response);
      }

      // Close modal after a delay? Or immediately?
      // setTimeout(() => {
      //   setIsAIModalOpen(false);
      //   setAIResponse("");
      // }, 1500);
      setIsAIModalOpen(false); // Close immediately after insertion
    } catch (error) {
      console.error("Error generating AI content:", error);
      setAIResponse("Error: Failed to generate content.");
      // Maybe keep modal open to show error?
    } finally {
      setIsLoading(false);
    }
  };

  // Handle transformation options from selection toolbar
  const handleTransformOption = async (option) => {
    if (!selectedText) return; // Should not happen if button is visible

    console.log(`Transform option selected: ${option}`);

    if (option === "askAI") {
      setIsAskAIModalOpen(true); // Open Ask AI modal, passing selectedText via state
      setSelectionPosition(null); // Hide toolbar
      return;
    }

    // For other transformations
    setSelectionPosition(null); // Hide toolbar
    setTransformType(option);
    setIsTransformLoading(true);
    setIsPreviewModalOpen(true); // Open preview modal immediately
    setTransformedText(""); // Clear previous transformed text

    try {
      const transformedContent = await transformText(selectedText, option);
      setTransformedText(transformedContent);
    } catch (error) {
      console.error("Error transforming text:", error);
      setTransformedText("Error transforming text. Please try again.");
    } finally {
      setIsTransformLoading(false);
    }
  };

  // Handle submission from Ask AI modal
  const handleAskAISubmit = async (question, context) => {
    if (!question.trim() || !context.trim()) return;

    setIsAskAILoading(true);
    setAskAIResponse("");

    try {
      // Use the specific prompt structure for Ask AI
      const prompt = `Based *only* on the following text:\n\n"${context}"\n\nAnswer this question: ${question}`;
      const response = await generateContent(prompt);
      setAskAIResponse(response);
    } catch (error) {
      console.error("Error in Ask AI:", error);
      setAskAIResponse("Sorry, there was an error processing your question.");
    } finally {
      setIsAskAILoading(false);
    }
  };

  // Accept the transformed text from preview modal
  const handleAcceptTransform = () => {
    if (editor.selection && transformedText) {
      // Replace the original selected text with the transformed text
      Transforms.insertText(editor, transformedText, { at: editor.selection });
    }
    setIsPreviewModalOpen(false);
    ReactEditor.focus(editor);
  };

  // Reject/Close the transformed text preview modal
  const handleRejectTransform = () => {
    setIsPreviewModalOpen(false);
    ReactEditor.focus(editor); // Refocus editor
  };

  // Get title for the preview modal
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

  // AI Assistant Button Handlers
  const handleActivateText = () => {
    setIsAIModalOpen(true);
  };

  // Function to get plain text from Slate value
  const getPlainText = (nodes) => {
    if (!Array.isArray(nodes)) {
      console.error("getPlainText received non-array:", nodes);
      return "";
    }
    try {
      return nodes
        .map((n) => {
          // Add a check here: Ensure the node is valid before stringifying
          if (!n || typeof n !== "object") {
            console.warn("getPlainText encountered invalid node:", n);
            return ""; // Return empty string for invalid nodes
          }
          // Check if it's an element missing children (common cause of the error)
          if (SlateElement.isElement(n) && !Array.isArray(n.children)) {
            console.warn(
              "getPlainText encountered element node missing children:",
              n
            );
            // Attempt to stringify a default child or return empty
            return Node.string({ children: [{ text: "" }] });
          }
          return Node.string(n);
        })
        .join("\n");
    } catch (error) {
      console.error(
        "Error in getPlainText during Node.string:",
        error,
        "Nodes:",
        nodes
      );
      return ""; // Return empty string on error
    }
  };

  const handleActivateRevision = () => {
    // Generate flashcards based on current editor content
    setIsFlashcardModalOpen(true); // Open the modal
    // The FlashcardModal component will fetch the content itself via prop
  };

  // --- Cleanup Old Refs/State/Handlers ---
  // Removed: richEditorRef, richContent, editorState, handleRichTextInput, getNodePath, findNodeByPath,
  // cursor restoration useEffect, old handleFormatText, old handleMediaInsertion, old handleAISubmit,
  // old handleRichTextSelection, old handleAcceptTransformRich, handleEditorClick, handleContentChange,
  // old useEffect for file buttons, old useEffect for AI shortcut (can be added back if needed on window)

  // --- Render ---
  return (
    <div className={`editor-container ${!isSidebarOpen ? "full-width" : ""}`}>
      <EditorHeader onCreate={onCreate} />
      <div className="editor-content-wrapper">
        <EditorToolbar
          editor={editor} // Pass the editor instance
          onFormatText={handleFormatText} // Pass the unified handler
          onInsertMedia={handleInsertFromDialog}
          // Pass state needed for button active states (optional)
          // Example: isBoldActive={CustomEditor.isMarkActive(editor, 'bold')}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="editor-title"
          placeholder="Note title..."
        />

        {/* --- SLATE EDITOR --- */}
        <Slate
           key={`note-${note?._id || "new"}-${Date.now()}`}// More aggressive remounting strategy
          editor={editor}
          initialValue={slateValue} 
          value={slateValue}
          onChange={handleSlateChange}
        >
          <Editable
            className="editor-content rich-editor" // Keep existing styles
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            placeholder="Start typing your note..."
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false} // Use boolean false
            data-gramm="false"
            onKeyDown={handleKeyDown}
            onContextMenu={handleMediaContextMenu} // Attach context menu handler
            // Add onClick handler if needed for specific non-media interactions
            // onClick={handleSlateClick}
            // Add onSelect handler if specific selection logic beyond the toolbar is needed
            // onSelect={handleSlateSelect}
          />
        </Slate>
        {/* --- END SLATE EDITOR --- */}
      </div>

      {/* AI Assistant Buttons */}
      <AIAssistant
        onActivateText={handleActivateText}
        onActivateRevision={handleActivateRevision}
      />

      {/* Modals */}
      <AIModal
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          setAIResponse(""); // Clear response on close
        }}
        onSubmit={handleAISubmit}
        loading={isLoading} // Use appropriate loading state
        response={aiResponse}
      />

      <FlashcardModal
        isOpen={isFlashcardModalOpen}
        onClose={() => setIsFlashcardModalOpen(false)}
        // Pass function to get content, or the content itself if stable
        noteContent={getPlainText(slateValue)} // Pass plain text content
      />

      <TextSelectionToolbar
        position={selectionPosition}
        onOption={handleTransformOption}
      />

      <TextPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={handleRejectTransform}
        content={transformedText}
        onAccept={handleAcceptTransform}
        onReject={handleRejectTransform}
        loading={isTransformLoading}
        title={getTransformTitle()}
      />

      <AskAIModal
        isOpen={isAskAIModalOpen}
        onClose={() => {
          setIsAskAIModalOpen(false);
          setAskAIResponse(""); // Clear response
        }}
        selectedText={selectedText} // Pass the selected text context
        onSubmit={handleAskAISubmit}
        loading={isAskAILoading}
        response={askAIResponse}
      />

      {/* File Sidebar */}
      <FileSidebar
        isOpen={fileSidebar.isOpen}
        onClose={handleCloseFileSidebar}
        fileUrl={fileSidebar.fileUrl}
        fileName={fileSidebar.fileName}
      />

      {/* Media Context Menu */}
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
              path: null,
              mediaType: null,
              fileId: null,
            })
          }
        />
      )}

      {/* Media Dialog (for Insert/Replace) */}
      {showMediaDialog && (
        <MediaDialog
          type={mediaTypeForDialog} // Pass the type to insert/replace - UNCOMMENT THIS LINE
          isOpen={showMediaDialog}
          onClose={() => {
            setShowMediaDialog(false);
            setIsReplacing(false); // Reset replacing state on close
            // Don't reset contextMenu here, only on action or outside click
          }}
          onInsert={handleInsertFromDialog} // Use the combined handler
        />
      )}
    </div>
  );
};

export default NoteEditor;
