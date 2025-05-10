/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  FileIcon,
  //Image as ImageIcon,
  //Video as VideoIcon,
  //Link as LinkIcon,
} from "lucide-react";
import DOMPurify from "dompurify";
import MediaDialog from "../MediaDialog";
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

// Slate imports
import {
  createEditor,
  Editor,
  Transforms,
  Element as SlateElement,
  Text,
  Range,
  Node,
  Path,
} from "slate";
import {
  Slate,
  Editable,
  withReact,
  ReactEditor,
  DefaultElement,
} from "slate-react";
import { withHistory } from "slate-history";
import isHotkey from "is-hotkey";
import escapeHtml from "escape-html";

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
  LI: (el) => ({ type: "list-item", children: deserializeChildren(el) }),
  OL: (el) => ({ type: "numbered-list", children: deserializeChildren(el) }),
  P: (el) => ({ type: "paragraph", children: deserializeChildren(el) }),
  PRE: (el) => ({ type: "code", children: deserializeChildren(el) }),
  UL: (el) => ({ type: "bulleted-list", children: deserializeChildren(el) }),
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
    const fontStyleMatch = style.match(/font-style:\s*italic;?/);
    const fontWeightMatch = style.match(/font-weight:\s*bold;?/);
    const textDecorationMatch = style.match(/text-decoration:\s*underline;?/);
    const textDecorationLineThroughMatch = style.match(
      /text-decoration:\s*line-through;?/
    );
    const fontFamilyMatch = style.match(/font-family:\s*([^;]+);?/);
    const fontSizeMatch = style.match(/font-size:\s*([^;]+);?/);

    if (colorMatch) marks.textColor = colorMatch[1].trim();
    if (bgColorMatch) marks.backgroundColor = bgColorMatch[1].trim();
    if (fontStyleMatch) marks.italic = true;
    if (fontWeightMatch) marks.bold = true;
    if (textDecorationMatch) marks.underline = true;
    if (textDecorationLineThroughMatch) marks.strikethrough = true;
    if (fontFamilyMatch)
      marks.fontFamily = fontFamilyMatch[1].replace(/['"]/g, "").trim();
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
    return { text: text || "" };
  } else if (el.nodeType === 1) {
    // ELEMENT_NODE
    const { nodeName } = el;

    // Handle void elements like BR
    if (nodeName === "BR") {
      return null;
    }

    let children = deserializeChildren(el);

    // If an element has no children or only empty/whitespace text, ensure it has at least one empty text node
    if (
      children.length === 0 ||
      children.every((c) => typeof c === "string" && !c.trim())
    ) {
      children = [{ text: "" }];
    }

    const elementFn = ELEMENT_TAGS[nodeName];
    if (elementFn) {
      const node = elementFn(el);
      // Ensure the returned node has children
      if (!node.children) {
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
        } else if (SlateElement.isElement(child)) {
          return child;
        }
        console.warn("Unexpected child type during mark application:", child);
        return child;
      });
    }

    // Default fallback
    const containsBlockChild = children.some(
      (child) =>
        typeof child === "object" &&
        child !== null &&
        !Text.isText(child) &&
        Editor.isBlock({ type: "paragraph", children: [] }, child)
    );
    if (containsBlockChild) {
      return children;
    } else {
      console.warn(
        "Unknown HTML tag encountered during deserialization:",
        nodeName
      );
      return { type: "paragraph", children: children };
    }
  }

  return null;
};

// Initial purify config
const purifyConfig = {
  ADD_ATTR: [
    "target",
    "contenteditable",
    "autocapitalize",
    "autocorrect",
    "spellcheck",
    "data-gramm",
    "style",
  ],
  ADD_TAGS: ["div", "span"],
  USE_PROFILES: { html: true },
  ALLOW_DATA_ATTR: true,
};

const deserialize = (htmlString) => {
  if (!htmlString || !htmlString.trim()) {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }

  // 1. Sanitize the HTML string
  const sanitizedHtml = DOMPurify.sanitize(htmlString, purifyConfig);

  // 2. Parse the sanitized HTML
  const parsed = new DOMParser().parseFromString(sanitizedHtml, "text/html");
  const body = parsed.body;

  // If body is empty after sanitization, return default
  if (!body || !body.textContent?.trim()) {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }

  // 3. Deserialize the DOM body into Slate nodes
  const slateNodes = deserializeChildren(body);

  // 4. Ensure the top level consists of block nodes. Wrap stray text/inline nodes.
  const ensureBlocks = (nodes) => {
    const wrappedNodes = [];
    let currentParagraph = null;
    const dummyEditor = createEditor();

    for (const node of nodes) {
      if (node === null) continue;

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
          currentParagraph.children.push({ text: node });
        } else if (Text.isText(node)) {
          currentParagraph.children.push(node);
        } else if (SlateElement.isElement(node) && dummyEditor.isInline(node)) {
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
  return finalNodes;
};

// Serialize Slate JSON back to HTML
const serializeNode = (node) => {
  if (Text.isText(node)) {
    let string = escapeHtml(node.text);
    // Apply marks
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
      return `<p${style}>${children || "&nbsp;"}</p>`;
    case "heading-one":
      return `<h1${style}>${children}</h1>`;
    case "heading-two":
      return `<h2${style}>${children}</h2>`;
    case "heading-three":
      return `<h3${style}>${children}</h3>`;
    case "list-item":
      return `<li${style}>${children}</li>`;
    case "numbered-list":
      return `<ol${style}>${children}</ol>`;
    case "bulleted-list":
      return `<ul${style}>${children}</ul>`;
    case "block-quote":
      return `<blockquote${style}>${children}</blockquote>`;
    case "code":
      return `<pre${style}><code>${children}</code></pre>`;
    case "link":
      return `<a href="${escapeHtml(
        node.url
      )}" target="_blank" rel="noopener noreferrer">${children}</a>`;
    default:
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

// withMedia function to handle media elements
const withMedia = (editor) => {
  const { isVoid, insertBreak } = editor;

  editor.isVoid = (element) => {
    return ["image", "video", "file"].includes(element.type)
      ? true
      : isVoid(element);
  };

  editor.insertBreak = () => {
    const { selection } = editor;

    if (selection) {
      const [node] = Editor.parent(editor, selection.focus.path);
      if (editor.isVoid(node)) {
        // If in a void node, insert a paragraph after it
        Transforms.insertNodes(
          editor,
          { type: "paragraph", children: [{ text: "" }] },
          { at: Path.next(ReactEditor.findPath(editor, node)) }
        );
        return;
      }
    }

    insertBreak();
  };

  return editor;
};

// --- NoteEditor Component -
const NoteEditor = ({ note, onUpdate, onCreate }) => {
  // --- State variables ---
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
  const [transformType, setTransformType] = useState("");
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);

  // Ask AI states
  const [isAskAIModalOpen, setIsAskAIModalOpen] = useState(false);
  const [askAIResponse, setAskAIResponse] = useState("");
  const [isAskAILoading, setIsAskAILoading] = useState(false);

  //media states
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState(false);
  const [mediaDialogType, setMediaDialogType] = useState(null);

  // --- Slate Specific State ---
  const editor = useMemo(() => {
    const e = withMedia(withHistory(withReact(createEditor())));
    return e;
  }, [note?._id]); // Recreate editor when note ID changes

  // Initial value derived from note content using deserialization
  const initialValue = useMemo(() => {
    const deserialized = deserialize(note?.content);
    // Ensure deserialize ALWAYS returns a valid array, even if empty/error
    return Array.isArray(deserialized) && deserialized.length > 0
      ? deserialized
      : [{ type: "paragraph", children: [{ text: "" }] }]; // Fallback default
  }, [note?.content]); // Memoize initial value to avoid re-computing on every render

  // State to hold the current Slate value (JSON)
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
    }, 3000); // Adjust debounce time as needed

    // Cleanup function to clear timer on unmount or before next effect run
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [slateValue, title, note, onUpdate, editor]);

  // Custom Editor Commands
  const CustomEditor = useMemo(
    () => ({
      isMarkActive(editor, format) {
        const marks = Editor.marks(editor);
        return marks ? marks[format] === true : false;
      },

      toggleMark(editor, format) {
        const isActive = CustomEditor.isMarkActive(editor, format);
        if (isActive) {
          Editor.removeMark(editor, format);
        } else {
          Editor.addMark(editor, format, true);
        }
        ReactEditor.focus(editor);
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
        ].includes(format);

        // Unwrap lists first
        Transforms.unwrapNodes(editor, {
          match: (n) =>
            !Editor.isEditor(n) &&
            SlateElement.isElement(n) &&
            ["numbered-list", "bulleted-list"].includes(n.type),
          split: true,
        });

        let newProperties;
        if (isActive) {
          newProperties = { type: "paragraph" };
        } else if (isList) {
          newProperties = { type: "list-item" };
        } else {
          newProperties = { type: format };
        }

        // Apply the new properties only to relevant block types
        Transforms.setNodes(editor, newProperties, {
          match: (n) =>
            SlateElement.isElement(n) &&
            Editor.isBlock(editor, n) &&
            isIndentable,
        });

        // If the target format is a list, wrap the nodes in the list container
        if (!isActive && isList) {
          const block = { type: format, children: [] };
          Transforms.wrapNodes(editor, block, {
            match: (n) => SlateElement.isElement(n) && n.type === "list-item",
          });
        }
        ReactEditor.focus(editor);
      },

      toggleAlignment(editor, alignValue) {
        Transforms.setNodes(
          editor,
          { align: alignValue },
          {
            match: (n) =>
              SlateElement.isElement(n) && Editor.isBlock(editor, n),
          }
        );
        ReactEditor.focus(editor);
      },

      setStyleMark(editor, format, value) {
        if (editor.selection) {
          if (Range.isCollapsed(editor.selection)) {
            Editor.addMark(editor, format, value);
          } else {
            Transforms.setNodes(
              editor,
              { [format]: value },
              { match: Text.isText, split: true }
            );
          }
        } else {
          Editor.addMark(editor, format, value);
        }
        ReactEditor.focus(editor);
      },
    }),
    [editor]
  );

  // --- Rendering Callbacks for Slate ---
  const renderElement = useCallback(({ attributes, children, element }) => {
    const style = element.align ? { textAlign: element.align } : {};

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
      case "code":
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
      case "paragraph":
        return (
          <p {...attributes} style={style}>
            {children}
          </p>
        );
      case "image":
        return (
          <div
            className="media-container"
            {...attributes}
            contentEditable={false}
          >
            <div className="media-spacer">
              <img src={element.url} alt={element.alt || ""} />
              {children}
            </div>
          </div>
        );
      case "video":
        return (
          <div
            className="media-container"
            {...attributes}
            contentEditable={false}
          >
            <div className="media-spacer">
              <video controls src={element.url} poster={element.poster}>
                Your browser doesn't support embedded videos.
              </video>
              {children}
            </div>
          </div>
        );
      case "file":
        return (
          <div
            className="media-container file-container"
            {...attributes}
            contentEditable={false}
          >
            <div className="file-preview">
              <FileIcon size={24} />
              <div className="file-info">
                <span className="file-name">{element.filename}</span>
                <span className="file-size">
                  {formatFileSize(element.size)}
                </span>
                <a
                  href={element.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-file-button"
                >
                  View
                </a>
              </div>
            </div>
            {children}
          </div>
        );
      default:
        return (
          <DefaultElement {...attributes} element={element} style={style}>
            {children}
          </DefaultElement>
        );
    }
  }, []);

  // --- File Size Formatter ---
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  // Insert image, video, or file
  const insertMedia = (editor, mediaProps) => {
    const { type, ...props } = mediaProps;
    const mediaElement = { type, ...props, children: [{ text: "" }] };

    // Insert the media node
    Transforms.insertNodes(editor, mediaElement);

    // // Check if we're not at the end of a block
    // const isAtEndOfBlock = Editor.isEnd(
    //   editor,
    //   editor.selection.focus,
    //   editor.selection.focus.path
    // );

    // Always add a paragraph after the media
    Transforms.insertNodes(editor, {
      type: "paragraph",
      children: [{ text: "" }],
    });

    // Move selection to the new paragraph
    Transforms.select(editor, Editor.end(editor, editor.selection));
    ReactEditor.focus(editor);
  };

  // Image specific insertion helper
  const insertImage = (editor, url, alt = "") => {
    insertMedia(editor, { type: "image", url, alt });
  };

  // Video specific insertion helper
  const insertVideo = (editor, url, poster = null) => {
    insertMedia(editor, { type: "video", url, poster });
  };

  // File specific insertion helper
  const insertFile = (editor, url, filename, size, contentType) => {
    insertMedia(editor, {
      type: "file",
      url,
      filename,
      size,
      contentType,
    });
  };

  // Add this handler function to your NoteEditor component
  const handleMediaInsert = (type, mediaData) => {
    switch (type) {
      case "image":
        insertImage(editor, mediaData.url, mediaData.filename);
        break;
      case "video":
        insertVideo(editor, mediaData.url);
        break;
      case "file":
        insertFile(
          editor,
          mediaData.url,
          mediaData.filename,
          mediaData.size,
          mediaData.contentType
        );
        break;
      case "link":
        insertLink(editor, mediaData.url);
        break;
      default:
        console.error("Unknown media type:", type);
    }
  };

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

    return <span {...attributes}>{el}</span>;
  }, []);

  // --- Event Handlers ---

  // Handle Toolbar Actions
  const handleFormatText = (formatType, value = null) => {
    // Add media buttons to your toolbar in the handleFormatText function
    const openMediaDialog = (type) => {
      setMediaDialogType(type);
      setIsMediaDialogOpen(true);
    };
    // Handle link insertion
    if (formatType === "link") {
      const url = window.prompt("Enter the URL of the link:");
      if (url) {
        insertLink(editor, url);
      }
      return;
    }

    // Handle media insertion
    if (formatType === "media") {
      openMediaDialog(value); // value will be 'image', 'video', or 'file'
      return;
    }

    // Handle media insertion
    if (["image", "video", "file"].includes(formatType)) {
      openMediaDialog(formatType);
      return;
    }

    // Apply formatting using CustomEditor commands
    switch (formatType) {
      // Marks
      case "bold":
      case "italic":
      case "underline":
      case "strikethrough":
      case "code":
        CustomEditor.toggleMark(editor, formatType);
        break;

      // Blocks
      case "heading":
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

      // Styles/Properties
      case "align":
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
    },
    [editor, CustomEditor]
  );

  const HOTKEYS = {
    "mod+b": "bold",
    "mod+i": "italic",
    "mod+u": "underline",
    "mod+`": "code",
  };

  // Insert Link Helper
  const insertLink = (editor, url) => {
    if (!url) return;
    const { selection } = editor;
    const link = {
      type: "link",
      url,
      children: selection && Range.isExpanded(selection) ? [] : [{ text: url }],
    };

    if (selection) {
      if (Range.isExpanded(selection)) {
        Transforms.wrapNodes(editor, link, { split: true });
        Transforms.collapse(editor, { edge: "end" });
      } else {
        Transforms.insertNodes(editor, link);
      }
    } else {
      Transforms.insertNodes(editor, link);
    }
    ReactEditor.focus(editor);
  };

  // Update selection state for toolbar
  const handleSlateChange = (newValue) => {
    setSlateValue(newValue);

    const { selection } = editor;

    if (selection && Range.isExpanded(selection)) {
      try {
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          const domRange = domSelection.getRangeAt(0);
          const rect = domRange.getBoundingClientRect();

          setSelectionPosition({
            x: rect.left + window.scrollX + rect.width / 2,
            y: rect.top + window.scrollY - 10,
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
    setIsLoading(true);
    setAIResponse("");
    try {
      const response = await generateContent(prompt);
      setAIResponse(response);

      if (response) {
        Transforms.insertText(editor, response);
      }

      setIsAIModalOpen(false);
    } catch (error) {
      console.error("Error generating AI content:", error);
      setAIResponse("Error: Failed to generate content.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle transformation options from selection toolbar
  const handleTransformOption = async (option) => {
    if (!selectedText) return;

    console.log(`Transform option selected: ${option}`);

    if (option === "askAI") {
      setIsAskAIModalOpen(true);
      setSelectionPosition(null);
      return;
    }

    // For other transformations
    setSelectionPosition(null);
    setTransformType(option);
    setIsTransformLoading(true);
    setIsPreviewModalOpen(true);
    setTransformedText("");

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
      Transforms.insertText(editor, transformedText, { at: editor.selection });
    }
    setIsPreviewModalOpen(false);
    ReactEditor.focus(editor);
  };

  // Reject/Close the transformed text preview modal
  const handleRejectTransform = () => {
    setIsPreviewModalOpen(false);
    ReactEditor.focus(editor);
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
          if (!n || typeof n !== "object") {
            console.warn("getPlainText encountered invalid node:", n);
            return "";
          }
          if (SlateElement.isElement(n) && !Array.isArray(n.children)) {
            console.warn(
              "getPlainText encountered element node missing children:",
              n
            );
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
      return "";
    }
  };

  const handleActivateRevision = () => {
    setIsFlashcardModalOpen(true);
  };

  return (
    <div className={`editor-container ${!isSidebarOpen ? "full-width" : ""}`}>
      <EditorHeader onCreate={onCreate} />
      <div className="editor-content-wrapper">
        <EditorToolbar editor={editor} onFormatText={handleFormatText} />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="editor-title"
          placeholder="Note title..."
        />

        {/* SLATE EDITOR */}
        <Slate
          key={`note-${note?._id || "new"}-${Date.now()}`}
          editor={editor}
          initialValue={slateValue}
          value={slateValue}
          onChange={handleSlateChange}
        >
          <Editable
            className="editor-content rich-editor"
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            placeholder="Start typing your note..."
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            data-gramm="false"
            onKeyDown={handleKeyDown}
          />
        </Slate>
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
          setAIResponse("");
        }}
        onSubmit={handleAISubmit}
        loading={isLoading}
        response={aiResponse}
      />

      <FlashcardModal
        isOpen={isFlashcardModalOpen}
        onClose={() => setIsFlashcardModalOpen(false)}
        noteContent={getPlainText(slateValue)}
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
          setAskAIResponse("");
        }}
        selectedText={selectedText}
        onSubmit={handleAskAISubmit}
        loading={isAskAILoading}
        response={askAIResponse}
      />

      <MediaDialog
        type={mediaDialogType}
        isOpen={isMediaDialogOpen}
        onClose={() => setIsMediaDialogOpen(false)}
        onInsert={handleMediaInsert}
      />
    </div>
  );
};

export default NoteEditor;
