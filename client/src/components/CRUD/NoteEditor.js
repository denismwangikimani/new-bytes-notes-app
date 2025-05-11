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
  Maximize,
  Minimize,
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
import FileSidebar from "./FileSidebar";
import "./notes.css";

// Slate imports
import {
  createEditor,
  Editor,
  Transforms,
  Text,
  Range,
  Path,
  Element as SlateElement,
  //Descendant,
  Node,
} from "slate";
import {
  Slate,
  Editable,
  withReact,
  ReactEditor,
  DefaultElement,
} from "slate-react";
import { withHistory } from "slate-history";
import { isHotkey } from "is-hotkey";
import escapeHtml from "escape-html";

// --- HTML Deserialization/Serialization (Outside Component) ---
// ... (Keep your existing deserialize, serialize, ELEMENT_TAGS, TEXT_TAGS, deserializeChildren, deserializeNode, serializeNode, purifyConfig functions here)
// These seem largely okay for now, the primary issue is likely in the React component lifecycle.

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
  DIV: (el) => {
    // Check if this is a media container
    if (el.classList.contains("media-container")) {
      const dataType = el.getAttribute("data-type");

      if (dataType === "image") {
        const img = el.querySelector("img");
        if (img) {
          return {
            type: "image",
            url: img.getAttribute("src"),
            alt: img.getAttribute("alt") || "",
            children: [{ text: "" }],
          };
        }
      } else if (dataType === "video") {
        const video = el.querySelector("video");
        if (video) {
          return {
            type: "video",
            url: video.getAttribute("src"),
            poster: video.getAttribute("poster") || null,
            children: [{ text: "" }],
          };
        }
      } else if (dataType === "file") {
        return {
          type: "file",
          url: el.querySelector("a")?.getAttribute("href"),
          filename: el.getAttribute("data-filename") || "File",
          size: parseInt(el.getAttribute("data-size") || "0", 10),
          contentType:
            el.getAttribute("data-content-type") || "application/octet-stream",
          children: [{ text: "" }],
        };
      }
    }

    // Default div handling
    return { type: "paragraph", children: deserializeChildren(el) };
  },
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
    return { text: text || "" }; // Ensure text is never null
  } else if (el.nodeType === 1) {
    // ELEMENT_NODE
    const { nodeName } = el;

    // Handle void elements like BR
    if (nodeName === "BR") {
      return null; // Or { text: '\n' } if you want to preserve line breaks explicitly
    }

    let children = deserializeChildren(el);

    // If an element has no children or only empty/whitespace text, ensure it has at least one empty text node
    // This is crucial for Slate's normalization rules, especially for void elements or elements that should contain text.
    if (
      children.length === 0 ||
      children.every(
        (c) =>
          (Text.isText(c) && !c.text?.trim()) ||
          (typeof c === "string" && !c.trim())
      )
    ) {
      children = [{ text: "" }];
    }

    const elementFn = ELEMENT_TAGS[nodeName];
    if (elementFn) {
      const node = elementFn(el);
      // Ensure the returned node has children, especially if it's not a void element
      if (!node.children || node.children.length === 0) {
        node.children = [{ text: "" }];
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
        if (Text.isText(child)) {
          return { ...marks, ...child };
        } else if (SlateElement.isElement(child)) {
          // If a mark tag wraps a block, this might be an issue.
          // Typically, marks apply to text nodes.
          // For simplicity, let's assume marks are applied to text or inline elements.
          // If child.children exists, recurse, otherwise apply to child itself if it's inline.
          if (child.children) {
            return {
              ...child,
              children: child.children.map((c) => ({ ...marks, ...c })),
            };
          }
        }
        return child; // Should not happen if children are text or elements
      });
    }

    // Default fallback for unknown elements: treat as paragraph or pass children if block
    // This part needs to be careful not to create invalid structures.
    // A simple approach: if it contains block children, return them, else wrap in paragraph.
    const containsBlockChild = children.some(
      (child) =>
        typeof child === "object" &&
        child !== null &&
        !Text.isText(child) && // It's an element
        Editor.isBlock(createEditor(), child) // Check if it's a block type
    );
    if (containsBlockChild) {
      return children; // Pass block children up
    } else {
      // Wrap inline content or unknown tags in a paragraph
      return {
        type: "paragraph",
        children: children.length > 0 ? children : [{ text: "" }],
      };
    }
  }

  return null; // Ignore other node types like comments
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
    "style", // Allow style for alignment, colors, etc.
    "data-type", // For media containers
    "data-filename",
    "data-size",
    "data-content-type",
  ],
  ADD_TAGS: ["div", "span"], // Ensure div and span are allowed
  USE_PROFILES: { html: true },
  ALLOW_DATA_ATTR: true, // Allow all data-* attributes
  // FORBID_TAGS: [], // Potentially allow more tags if needed, or specify carefully
  // FORBID_ATTR: []
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
  if (!body || (!body.hasChildNodes() && !body.textContent?.trim())) {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }

  // 3. Deserialize the DOM body into Slate nodes
  const slateNodes = deserializeChildren(body);

  // 4. Ensure the top level consists of block nodes. Wrap stray text/inline nodes.
  const ensureBlocks = (nodes) => {
    const wrappedNodes = [];
    let currentParagraph = null;
    const dummyEditor = createEditor(); // Helper to check isInline

    for (const node of nodes) {
      if (node === null) continue; // Skip null nodes from BRs etc.

      // Check if the node is inline (text or inline element)
      const isInlineNode =
        typeof node === "string" || // Should ideally be {text: string} by now
        Text.isText(node) ||
        (SlateElement.isElement(node) && dummyEditor.isInline(node));

      if (isInlineNode) {
        if (!currentParagraph) {
          currentParagraph = { type: "paragraph", children: [] };
        }
        // Ensure the pushed node is a valid Text node or inline Element
        if (typeof node === "string") {
          currentParagraph.children.push({ text: node });
        } else if (Text.isText(node)) {
          currentParagraph.children.push(node);
        } else if (SlateElement.isElement(node) && dummyEditor.isInline(node)) {
          // This case handles inline elements like <Link>
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
        // Ensure the block node itself has valid children if it's not void
        if (SlateElement.isElement(node) && !dummyEditor.isVoid(node)) {
          if (
            !node.children ||
            node.children.length === 0 ||
            node.children.every((c) => Text.isText(c) && !c.text?.trim())
          ) {
            node.children = [{ text: "" }];
          }
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

  // Final check: if finalNodes is empty or only contains empty paragraphs, return a single empty paragraph.
  if (
    finalNodes.length === 0 ||
    finalNodes.every(
      (node) =>
        SlateElement.isElement(node) &&
        node.type === "paragraph" &&
        node.children.every((child) => Text.isText(child) && child.text === "")
    )
  ) {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }

  return finalNodes;
};

// Serialize Slate JSON back to HTML
const serializeNode = (node) => {
  if (Text.isText(node)) {
    // Text node handling remains the same
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
    // Existing cases remain the same
    case "paragraph":
      // Ensure paragraphs always have some content for HTML, even if it's a non-breaking space
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
      // Code blocks in <pre><code> should preserve whitespace, handled by CSS usually
      return `<pre${style}><code>${children}</code></pre>`;
    case "link":
      return `<a href="${escapeHtml(
        node.url
      )}" target="_blank" rel="noopener noreferrer">${children}</a>`;

    // Add cases for media elements
    // For void elements, Slate expects an empty text child. HTML serialization might not need it,
    // but ensure the deserializer handles this structure.
    // The <p></p> inside media divs is a bit unusual, consider if it's necessary or if a specific class/structure is better.
    // It might be for ensuring block behavior or spacing.
    case "image":
      return `<div data-type="image" class="media-container"><img src="${escapeHtml(
        node.url
      )}" alt="${escapeHtml(node.alt || "")}" /><p></p></div>`; // The <p></p> might be for spacing or to ensure it's treated as a block
    case "video":
      return `<div data-type="video" class="media-container"><video controls src="${escapeHtml(
        node.url
      )}"${
        node.poster ? ` poster="${escapeHtml(node.poster)}"` : ""
      }></video><p></p></div>`;
    case "file":
      return `<div data-type="file" class="media-container file-container" data-filename="${escapeHtml(
        node.filename
      )}" data-size="${node.size}" data-content-type="${escapeHtml(
        node.contentType || ""
      )}"><a href="${escapeHtml(node.url)}">${escapeHtml(
        node.filename
      )}</a><p></p></div>`;

    default:
      return children; // Or handle unknown types more explicitly
  }
};

const serialize = (value) => {
  // Ensure value is an array
  if (!Array.isArray(value)) {
    console.error("Invalid Slate value for serialization:", value);
    return ""; // Return empty string for invalid input
  }
  return value.map((n) => serializeNode(n)).join("");
};

// withMedia function to handle media elements
const withMedia = (editor) => {
  const { isVoid, insertBreak, normalizeNode } = editor;

  editor.isVoid = (element) => {
    return ["image", "video", "file"].includes(element.type)
      ? true
      : isVoid(element);
  };

  editor.insertBreak = () => {
    const { selection } = editor;

    if (selection) {
      const [match] = Editor.nodes(editor, {
        match: (n) =>
          !Editor.isEditor(n) && SlateElement.isElement(n) && editor.isVoid(n),
        mode: "highest", // Check the highest level void node at selection
      });

      if (match) {
        // If cursor is in a void node, insert a paragraph after it
        Transforms.insertNodes(
          editor,
          { type: "paragraph", children: [{ text: "" }] },
          { at: Path.next(match[1]), select: true } // Select the new paragraph
        );
        return;
      }
    }

    insertBreak(); // Call original insertBreak for non-void cases
  };

  // Ensure that void elements are followed by a paragraph if they are the last child.
  // This helps with editing experience.
  editor.normalizeNode = (entry) => {
    const [node, path] = entry;

    if (SlateElement.isElement(node) && editor.isVoid(node)) {
      // Check if this void element is the last child in the editor
      // or if the next sibling is not a paragraph (or another suitable block)
      const parent = Editor.parent(editor, path);
      const isLastChild =
        path[path.length - 1] === parent[0].children.length - 1;

      if (isLastChild) {
        Transforms.insertNodes(
          editor,
          { type: "paragraph", children: [{ text: "" }] },
          { at: Path.next(path) }
        );
        return; // Return because the structure changed
      } else {
        const nextNode = Editor.node(editor, Path.next(path));
        if (
          nextNode &&
          SlateElement.isElement(nextNode[0]) &&
          editor.isVoid(nextNode[0])
        ) {
          // If the next node is also a void node, insert a paragraph between them or after the current one
          Transforms.insertNodes(
            editor,
            { type: "paragraph", children: [{ text: "" }] },
            { at: Path.next(path) }
          );
          return;
        }
      }
    }
    // Call the original normalizeNode for other cases
    if (normalizeNode) {
      normalizeNode(entry);
    }
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
  const isAutoSaving = useRef(false);
  const [fullscreenMedia, setFullscreenMedia] = useState({
    id: null,
    type: null,
  });

  //file states
  const [isFileSidebarOpen, setIsFileSidebarOpen] = useState(false);
  const [currentFileUrl, setCurrentFileUrl] = useState(null);
  const [currentFileName, setCurrentFileName] = useState(null);

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
  }, [note?._id]); // Recreate editor when note ID changes (this is fine for major context switch)

  // Initial value derived from note content using deserialization
  const initialValue = useMemo(() => {
    const deserialized = deserialize(note?.content);
    return Array.isArray(deserialized) && deserialized.length > 0
      ? deserialized
      : [{ type: "paragraph", children: [{ text: "" }] }];
  }, [note?.content]);

  const [slateValue, setSlateValue] = useState(initialValue);

  useEffect(() => {
    if (isAutoSaving.current) {
      return;
    }
    const newSlateValue = deserialize(note?.content);
    setSlateValue(
      Array.isArray(newSlateValue) && newSlateValue.length > 0
        ? newSlateValue
        : [{ type: "paragraph", children: [{ text: "" }] }]
    );
    setTitle(note?.title || "");
  }, [note?._id, note?.content, note?.title]); // This effect syncs editor with external note changes

  const { isSidebarOpen } = useSidebar();
  const updateTimeoutRef = useRef(null);

  useEffect(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      if (note?._id && !isAutoSaving.current) {
        // Check !isAutoSaving.current here too
        const currentContent = serialize(slateValue);
        if (currentContent !== note.content || title !== note.title) {
          isAutoSaving.current = true;
          const selection = editor.selection; // Store selection before save
          onUpdate(note._id, { title, content: currentContent }).finally(() => {
            setTimeout(() => {
              // Delay resetting flag to allow parent state to propagate
              isAutoSaving.current = false;
              // Try to restore selection if editor still has focus and selection was stored
              if (selection && ReactEditor.isFocused(editor)) {
                try {
                  Transforms.select(editor, selection);
                } catch (e) {
                  console.warn(
                    "Could not restore selection after auto-save.",
                    e
                  );
                }
              }
            }, 100); // Small delay
          });
        }
      }
    }, 3000);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [slateValue, title, note, onUpdate, editor]);

  const CustomEditor = useMemo(
    () => ({
      isMarkActive(editorInstance, format) {
        const marks = Editor.marks(editorInstance);
        return marks ? marks[format] === true : false;
      },
      toggleMark(editorInstance, format) {
        const isActive = CustomEditor.isMarkActive(editorInstance, format);
        if (isActive) {
          Editor.removeMark(editorInstance, format);
        } else {
          Editor.addMark(editorInstance, format, true);
        }
        ReactEditor.focus(editorInstance);
      },
      isBlockActive(editorInstance, format, blockType = "type") {
        const { selection } = editorInstance;
        if (!selection) return false;
        const [match] = Editor.nodes(editorInstance, {
          at: Editor.unhangRange(editorInstance, selection),
          match: (n) =>
            !Editor.isEditor(n) &&
            SlateElement.isElement(n) &&
            n[blockType] === format,
        });
        return !!match;
      },
      toggleBlock(editorInstance, format) {
        const isActive = CustomEditor.isBlockActive(editorInstance, format);
        const isList = ["numbered-list", "bulleted-list"].includes(format);

        Transforms.unwrapNodes(editorInstance, {
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
        Transforms.setNodes(editorInstance, newProperties);

        if (!isActive && isList) {
          const block = { type: format, children: [] };
          Transforms.wrapNodes(editorInstance, block);
        }
        ReactEditor.focus(editorInstance);
      },
      toggleAlignment(editorInstance, alignValue) {
        Transforms.setNodes(
          editorInstance,
          { align: alignValue },
          {
            match: (n) =>
              SlateElement.isElement(n) && Editor.isBlock(editorInstance, n),
          }
        );
        ReactEditor.focus(editorInstance);
      },
      setStyleMark(editorInstance, styleFormat, value) {
        if (editorInstance.selection) {
          if (Range.isCollapsed(editorInstance.selection)) {
            Editor.addMark(editorInstance, styleFormat, value);
          } else {
            Transforms.setNodes(
              editorInstance,
              { [styleFormat]: value },
              { match: Text.isText, split: true }
            );
          }
        } else {
          Editor.addMark(editorInstance, styleFormat, value);
        }
        ReactEditor.focus(editorInstance);
      },
    }),
    [] // CustomEditor methods don't depend on NoteEditor state directly, they operate on the passed editor instance.
  );

  const toggleFullscreen = useCallback(
    (element) => {
      const mediaId = element.url;
      if (
        fullscreenMedia.id === mediaId &&
        fullscreenMedia.type === element.type
      ) {
        setFullscreenMedia({ id: null, type: null });
      } else {
        setFullscreenMedia({ id: mediaId, type: element.type });
      }
    },
    [fullscreenMedia]
  ); // Depends on fullscreenMedia state

  const formatFileSize = useCallback((bytes) => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  }, []); // No dependencies from component scope

  const renderElement = useCallback(
    ({ attributes, children, element }) => {
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
          const isImageFullscreen =
            fullscreenMedia.id === element.url &&
            fullscreenMedia.type === "image";
          return (
            <div
              {...attributes}
              contentEditable={false}
              className={`media-container ${
                isImageFullscreen ? "fullscreen-active" : ""
              }`}
            >
              <div style={{ position: "relative" }}>
                <img src={element.url} alt={element.alt || ""} />
                <button
                  className="fullscreen-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen(element);
                  }}
                  title={
                    isImageFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"
                  }
                >
                  {isImageFullscreen ? (
                    <Minimize size={18} />
                  ) : (
                    <Maximize size={18} />
                  )}
                </button>
              </div>
              {children}
            </div>
          );
        case "video":
          const isVideoFullscreen =
            fullscreenMedia.id === element.url &&
            fullscreenMedia.type === "video";
          return (
            <div
              {...attributes}
              contentEditable={false}
              className={`media-container ${
                isVideoFullscreen ? "fullscreen-active" : ""
              }`}
            >
              <div style={{ position: "relative" }}>
                <video
                  controls
                  src={element.url}
                  poster={element.poster}
                  preload="metadata"
                  playsInline
                  muted={false}
                  autoPlay={false}
                  key={element.url}
                  onLoadedData={(e) => {
                    const video = e.target;
                    video.pause();
                  }}
                  onClick={(e) => {
                    if (isVideoFullscreen) e.stopPropagation();
                  }}
                >
                  Your browser doesn't support embedded videos.
                </video>
                <button
                  className="fullscreen-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen(element);
                  }}
                  title={
                    isVideoFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"
                  }
                >
                  {isVideoFullscreen ? (
                    <Minimize size={18} />
                  ) : (
                    <Maximize size={18} />
                  )}
                </button>
              </div>
              {children}
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
                  <button
                    className="view-file-button"
                    onClick={() => {
                      setCurrentFileUrl(element.url);
                      setCurrentFileName(element.filename);
                      setIsFileSidebarOpen(true);
                    }}
                  >
                    View
                  </button>
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
    },
    [
      fullscreenMedia,
      toggleFullscreen,
      formatFileSize,
      setCurrentFileUrl,
      setCurrentFileName,
      setIsFileSidebarOpen,
    ] // Added dependencies
  );

  const renderLeaf = useCallback(({ attributes, children, leaf }) => {
    let el = <>{children}</>;
    if (leaf.bold) el = <strong>{el}</strong>;
    if (leaf.italic) el = <em>{el}</em>;
    if (leaf.underline) el = <u>{el}</u>;
    if (leaf.strikethrough) el = <s>{el}</s>;
    if (leaf.code) el = <code>{el}</code>;
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

  const insertMedia = useCallback((editorInstance, mediaProps) => {
    const { type, ...props } = mediaProps;
    const mediaElement = { type, ...props, children: [{ text: "" }] };

    // If selection is at the end of a non-empty paragraph, insert media on new line
    // Otherwise, insert at selection, splitting current block if necessary
    const { selection } = editorInstance;
    if (selection) {
      const [match] = Editor.nodes(editorInstance, {
        match: (n) =>
          SlateElement.isElement(n) && Editor.isBlock(editorInstance, n),
        mode: "lowest",
      });

      if (match) {
        const [currentNode, currentPath] = match;
        // If current block is empty or cursor at end of non-empty block, insert after
        if (
          Editor.isEmpty(editorInstance, currentNode) ||
          Editor.isEnd(editorInstance, selection.anchor, currentPath)
        ) {
          Transforms.insertNodes(editorInstance, mediaElement, {
            at: Path.next(currentPath),
          });
          Transforms.insertNodes(
            editorInstance,
            { type: "paragraph", children: [{ text: "" }] },
            { at: Path.next(Path.next(currentPath)), select: true }
          );
        } else {
          // Insert at selection, splitting the block
          Transforms.insertNodes(editorInstance, mediaElement);
          Transforms.insertNodes(
            editorInstance,
            { type: "paragraph", children: [{ text: "" }] },
            { select: true }
          );
        }
      } else {
        // Should not happen in a valid editor state
        Transforms.insertNodes(editorInstance, mediaElement);
        Transforms.insertNodes(
          editorInstance,
          { type: "paragraph", children: [{ text: "" }] },
          { select: true }
        );
      }
    } else {
      // No selection, append to end
      Transforms.insertNodes(editorInstance, mediaElement, {
        at: [editorInstance.children.length],
      });
      Transforms.insertNodes(
        editorInstance,
        { type: "paragraph", children: [{ text: "" }] },
        { at: [editorInstance.children.length], select: true }
      );
    }
    ReactEditor.focus(editorInstance);
  }, []);

  const insertImage = useCallback(
    (editorInstance, url, alt = "") => {
      insertMedia(editorInstance, { type: "image", url, alt });
    },
    [insertMedia]
  );

  const insertVideo = useCallback(
    (editorInstance, url, poster = null) => {
      insertMedia(editorInstance, { type: "video", url, poster });
    },
    [insertMedia]
  );

  const insertFile = useCallback(
    (editorInstance, url, filename, size, contentType) => {
      insertMedia(editorInstance, {
        type: "file",
        url,
        filename,
        size,
        contentType,
      });
    },
    [insertMedia]
  );

  const insertLink = useCallback((editorInstance, url) => {
    if (!url) return;
    const { selection } = editorInstance;
    const link = {
      type: "link",
      url,
      children: selection && Range.isExpanded(selection) ? [] : [{ text: url }],
    };
    if (selection) {
      if (Range.isExpanded(selection)) {
        Transforms.wrapNodes(editorInstance, link, { split: true });
        Transforms.collapse(editorInstance, { edge: "end" });
      } else {
        Transforms.insertNodes(editorInstance, link);
      }
    } else {
      Transforms.insertNodes(editorInstance, link);
    }
    ReactEditor.focus(editorInstance);
  }, []);

  const handleMediaInsert = useCallback(
    (type, mediaData) => {
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
    },
    [editor, insertImage, insertVideo, insertFile, insertLink]
  );

  const handleFormatText = useCallback(
    (formatType, value = null) => {
      const openMediaDialog = (type) => {
        setMediaDialogType(type);
        setIsMediaDialogOpen(true);
      };
      if (formatType === "link") {
        const url = window.prompt("Enter the URL of the link:");
        if (url) insertLink(editor, url);
        return;
      }
      if (formatType === "media") {
        openMediaDialog(value);
        return;
      }
      if (["image", "video", "file"].includes(formatType)) {
        openMediaDialog(formatType);
        return;
      }
      switch (formatType) {
        case "bold":
        case "italic":
        case "underline":
        case "strikethrough":
        case "code":
          CustomEditor.toggleMark(editor, formatType);
          break;
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
          console.log("Slate formatting not implemented: ", formatType);
      }
    },
    [editor, CustomEditor, insertLink]
  ); // Added insertLink

  const HOTKEYS = useMemo(
    () => ({
      // Memoize HOTKEYS object
      "mod+b": "bold",
      "mod+i": "italic",
      "mod+u": "underline",
      "mod+`": "code",
    }),
    []
  );

  const handleKeyDown = useCallback(
    (event) => {
      for (const hotkey in HOTKEYS) {
        if (isHotkey(hotkey, event)) {
          event.preventDefault();
          const mark = HOTKEYS[hotkey];
          CustomEditor.toggleMark(editor, mark);
          return;
        }
      }
      // Add specific handling for Enter key after void blocks if needed,
      // though withMedia's normalizeNode and insertBreak should handle most cases.
    },
    [editor, CustomEditor, HOTKEYS]
  ); // Added HOTKEYS

  const handleSlateChange = useCallback(
    (newValue) => {
      setSlateValue(newValue); // Main state update

      // Handle selection toolbar positioning
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
      // Removed the explicit scroll restoration from here.
      // Slate and the browser should handle keeping the cursor in view during typing.
      // If scroll jumps persist, they are more likely due to layout shifts from re-renders
      // or CSS, rather than needing manual correction on every change.
    },
    [editor]
  ); // Removed scroll restoration logic from here

  // ... (rest of your AI handlers, modal handlers, etc.)
  // Ensure all other handlers that interact with the editor or its state are also memoized if necessary.

  const handleAISubmit = async (prompt) => {
    setIsLoading(true);
    setAIResponse("");
    try {
      const response = await generateContent(prompt);
      setAIResponse(response);
      if (response) {
        // Insert AI response at current selection or end of document
        if (editor.selection) {
          Transforms.insertText(editor, response);
        } else {
          Transforms.insertText(editor, response, {
            at: Editor.end(editor, []),
          });
        }
      }
      setIsAIModalOpen(false);
    } catch (error) {
      console.error("Error generating AI content:", error);
      setAIResponse("Error: Failed to generate content.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransformOption = async (option) => {
    if (!selectedText) return;
    if (option === "askAI") {
      setIsAskAIModalOpen(true);
      setSelectionPosition(null);
      return;
    }
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

  const handleAcceptTransform = () => {
    if (editor.selection && transformedText) {
      Transforms.insertText(editor, transformedText, { at: editor.selection });
    }
    setIsPreviewModalOpen(false);
    ReactEditor.focus(editor);
  };

  const handleRejectTransform = () => {
    setIsPreviewModalOpen(false);
    ReactEditor.focus(editor);
  };

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

  const handleActivateText = () => setIsAIModalOpen(true);

  const getPlainText = useCallback((nodes) => {
    if (!Array.isArray(nodes)) {
      console.error("getPlainText received non-array:", nodes);
      return "";
    }
    try {
      return nodes.map((n) => Node.string(n)).join("\n");
    } catch (error) {
      console.error(
        "Error in getPlainText during Node.string:",
        error,
        "Nodes:",
        nodes
      );
      return "";
    }
  }, []);

  const handleActivateRevision = () => setIsFlashcardModalOpen(true);

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
        <Slate
          editor={editor}
          initialValue={initialValue} // Use initialValue for initial setup
          value={slateValue} // Controlled component with slateValue
          onChange={handleSlateChange}
          // FIX 1: Correct the key to prevent re-initialization on every render
          key={note?._id || "new-note"}
        >
          <Editable
            className="editor-content rich-editor"
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            placeholder="Start typing your note..."
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            data-gramm="false" // Consider data-gramm_editor="false" if Grammarly is an issue
            onKeyDown={handleKeyDown}
          />
        </Slate>
      </div>
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
      <FileSidebar
        isOpen={isFileSidebarOpen}
        onClose={() => setIsFileSidebarOpen(false)}
        fileUrl={currentFileUrl}
        fileName={currentFileName}
      />
    </div>
  );
};

export default NoteEditor;
