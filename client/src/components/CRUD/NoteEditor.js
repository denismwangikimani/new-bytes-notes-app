/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { FileIcon, Maximize, Minimize } from "lucide-react";
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
import Canvas from "../canvas/Canvas"; // Keep for DrawingElement
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

// --- (Keep all your existing deserialize/serialize functions here) ---
// ...
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
    // Text node
    return el.textContent.trim() === "" ? null : { text: el.textContent };
  } else if (el.nodeType !== 1) {
    // Not an element node
    return null;
  }

  const nodeName = el.nodeName.toUpperCase();

  // Handle BR tags as newlines within text, or null if they create empty lines between blocks
  if (nodeName === "BR") {
    return null;
  }

  let children = deserializeChildren(el);

  if (children.length === 0) {
    children = [{ text: "" }];
  }

  const elementFn = ELEMENT_TAGS[nodeName];
  if (elementFn) {
    const node = elementFn(el);
    if (!node.children || node.children.length === 0) {
      node.children = [{ text: "" }];
    }
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
    return children.map((child) => {
      if (Text.isText(child)) {
        return { ...marks, ...child };
      }
      return child;
    });
  }

  return children;
};

const purifyConfig = {
  ADD_ATTR: [
    "target",
    "contenteditable",
    "autocapitalize",
    "autocorrect",
    "spellcheck",
    "data-gramm",
    "style",
    "data-type",
    "data-filename",
    "data-size",
    "data-content-type",
  ],
  ADD_TAGS: ["div", "span"],
  USE_PROFILES: { html: true },
  ALLOW_DATA_ATTR: true,
};

const deserialize = (htmlString) => {
  if (!htmlString || !htmlString.trim()) {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }
  const sanitizedHtml = DOMPurify.sanitize(htmlString, purifyConfig);
  const parsed = new DOMParser().parseFromString(sanitizedHtml, "text/html");
  const body = parsed.body;

  if (!body || (!body.hasChildNodes() && !body.textContent?.trim())) {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }

  const slateNodes = deserializeChildren(body);

  const ensureBlocks = (nodes) => {
    const wrappedNodes = [];
    let currentParagraph = null;
    const dummyEditor = createEditor();

    for (const node of nodes) {
      if (node === null) continue;
      const isInlineNode =
        Text.isText(node) ||
        (SlateElement.isElement(node) && dummyEditor.isInline(node));

      if (isInlineNode) {
        if (!currentParagraph) {
          currentParagraph = { type: "paragraph", children: [] };
        }
        currentParagraph.children.push(node);
      } else {
        if (currentParagraph) {
          if (currentParagraph.children.length === 0) {
            currentParagraph.children = [{ text: "" }];
          }
          wrappedNodes.push(currentParagraph);
          currentParagraph = null;
        }
        if (SlateElement.isElement(node) && !dummyEditor.isVoid(node)) {
          if (!node.children || node.children.length === 0) {
            node.children = [{ text: "" }];
          }
        }
        wrappedNodes.push(node);
      }
    }
    if (currentParagraph) {
      if (currentParagraph.children.length === 0) {
        currentParagraph.children = [{ text: "" }];
      }
      wrappedNodes.push(currentParagraph);
    }
    return wrappedNodes.length > 0
      ? wrappedNodes
      : [{ type: "paragraph", children: [{ text: "" }] }];
  };

  const finalNodes = ensureBlocks(slateNodes);

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

const serializeNode = (node) => {
  if (Text.isText(node)) {
    let string = escapeHtml(node.text);
    if (node.code) string = `<code>${string}</code>`;
    if (node.italic) string = `<em>${string}</em>`;
    if (node.underline) string = `<u>${string}</u>`;
    if (node.strikethrough) string = `<s>${string}</s>`;
    if (node.bold) string = `<strong>${string}</strong>`;

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

  const children = node.children.map((n) => serializeNode(n)).join("");
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
    case "image":
      return `<div data-type="image" class="media-container"><img src="${escapeHtml(
        node.url
      )}" alt="${escapeHtml(node.alt || "")}" /><p></p></div>`;
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
      return children;
  }
};

const serialize = (value) => {
  if (!Array.isArray(value)) {
    console.error("Invalid Slate value for serialization:", value);
    return "";
  }
  return value.map((n) => serializeNode(n)).join("");
};

const withMedia = (editor) => {
  const { isVoid, insertBreak, normalizeNode } = editor;

  editor.isVoid = (element) => {
    return ["image", "video", "file", "drawing"].includes(element.type)
      ? true
      : isVoid(element);
  };

  editor.insertBreak = () => {
    const { selection } = editor;
    if (selection) {
      const [match] = Editor.nodes(editor, {
        match: (n) =>
          !Editor.isEditor(n) && SlateElement.isElement(n) && editor.isVoid(n),
        mode: "highest",
      });
      if (match) {
        Transforms.insertNodes(
          editor,
          { type: "paragraph", children: [{ text: "" }] },
          { at: Path.next(match[1]), select: true }
        );
        return;
      }
    }
    insertBreak();
  };

  editor.normalizeNode = (entry) => {
    const [node, path] = entry;
    if (SlateElement.isElement(node) && editor.isVoid(node)) {
      const parent = Editor.parent(editor, path);
      const isLastChild =
        path[path.length - 1] === parent[0].children.length - 1;
      if (isLastChild) {
        Transforms.insertNodes(
          editor,
          { type: "paragraph", children: [{ text: "" }] },
          { at: Path.next(path) }
        );
        return;
      } else {
        const nextNode = Editor.node(editor, Path.next(path));
        if (
          nextNode &&
          SlateElement.isElement(nextNode[0]) &&
          editor.isVoid(nextNode[0])
        ) {
          Transforms.insertNodes(
            editor,
            { type: "paragraph", children: [{ text: "" }] },
            { at: Path.next(path) }
          );
          return;
        }
      }
    }
    if (normalizeNode) {
      normalizeNode(entry);
    }
  };

  return editor;
};

const NoteEditor = ({ note, onUpdate, onCreate }) => {
  const [title, setTitle] = useState(note?.title || "");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiResponse, setAIResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isAutoSaving = useRef(false);
  const [fullscreenMedia, setFullscreenMedia] = useState({
    id: null,
    type: null,
  });
  const [isFileSidebarOpen, setIsFileSidebarOpen] = useState(false);
  const [currentFileUrl, setCurrentFileUrl] = useState(null);
  const [currentFileName, setCurrentFileName] = useState(null);
  const [selectionPosition, setSelectionPosition] = useState(null);
  const [selectedText, setSelectedText] = useState("");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [transformedText, setTransformedText] = useState("");
  const [isTransformLoading, setIsTransformLoading] = useState(false);
  const [transformType, setTransformType] = useState("");
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
  const [isAskAIModalOpen, setIsAskAIModalOpen] = useState(false);
  const [askAIResponse, setAskAIResponse] = useState("");
  const [isAskAILoading, setIsAskAILoading] = useState(false);
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState(false);
  const [mediaDialogType, setMediaDialogType] = useState(null);

  // --- New Integrated Drawing State ---
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [penColor, setPenColor] = useState("#000000");
  const [penSize, setPenSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  // --- Refs for canvas and drawing ---
  const canvasRef = useRef(null);
  const editorWrapperRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const drawingHistory = useRef([]);
  const historyIndex = useRef(-1);

  const editor = useMemo(() => {
    const e = withMedia(withHistory(withReact(createEditor())));
    return e;
  }, [note?._id]);

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
  }, [note?._id, note?.content, note?.title]);

  const { isSidebarOpen } = useSidebar();
  const updateTimeoutRef = useRef(null);

  useEffect(() => {
    updateTimeoutRef.current = setTimeout(() => {
      if (
        note &&
        (serialize(slateValue) !== note.content || title !== note.title)
      ) {
        isAutoSaving.current = true;
        onUpdate(note._id, {
          ...note,
          content: serialize(slateValue),
          title,
        }).finally(() => {
          isAutoSaving.current = false;
        });
      }
    }, 3000);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [slateValue, title, note, onUpdate, editor]);

  // --- Drawing Logic ---
  const saveToHistory = useCallback(() => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    if (historyIndex.current < drawingHistory.current.length - 1) {
      drawingHistory.current = drawingHistory.current.slice(
        0,
        historyIndex.current + 1
      );
    }
    drawingHistory.current.push(dataUrl);
    historyIndex.current = drawingHistory.current.length - 1;
  }, []);

  const drawImageOnCanvas = useCallback((dataUrl, ctx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = ctx || canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!dataUrl) return;

    const img = new Image();
    img.onload = () => {
      context.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }, []);

  const handleUndoDrawing = useCallback(() => {
    if (historyIndex.current > 0) {
      historyIndex.current--;
      const imageData = drawingHistory.current[historyIndex.current];
      drawImageOnCanvas(imageData);
      onUpdate(note._id, { canvasImage: imageData });
    }
  }, [note, onUpdate, drawImageOnCanvas]);

  const handleRedoDrawing = useCallback(() => {
    if (historyIndex.current < drawingHistory.current.length - 1) {
      historyIndex.current++;
      const imageData = drawingHistory.current[historyIndex.current];
      drawImageOnCanvas(imageData);
      onUpdate(note._id, { canvasImage: imageData });
    }
  }, [note, onUpdate, drawImageOnCanvas]);

  const handleResetDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const blankImage = canvas.toDataURL("image/png");
    drawingHistory.current = [blankImage];
    historyIndex.current = 0;
    onUpdate(note._id, { canvasImage: "" });
  }, [note, onUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = editorWrapperRef.current;
    if (!canvas || !wrapper) return;

    const resizeObserver = new ResizeObserver(() => {
      const currentImageData = canvas.toDataURL();
      canvas.width = wrapper.scrollWidth;
      canvas.height = wrapper.scrollHeight;
      const ctx = canvas.getContext("2d");
      drawImageOnCanvas(currentImageData, ctx);
    });

    resizeObserver.observe(wrapper);

    canvas.width = wrapper.scrollWidth;
    canvas.height = wrapper.scrollHeight;
    const ctx = canvas.getContext("2d");
    if (note?.canvasImage) {
      drawImageOnCanvas(note.canvasImage, ctx);
      drawingHistory.current = [note.canvasImage];
      historyIndex.current = 0;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawingHistory.current = [canvas.toDataURL("image/png")];
      historyIndex.current = 0;
    }

    return () => resizeObserver.disconnect();
  }, [note?._id, note?.canvasImage, drawImageOnCanvas]);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = useCallback((e) => {
    isDrawingRef.current = true;
    lastPositionRef.current = getCoords(e);
  }, []);

  const draw = useCallback(
    (e) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const newPos = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(lastPositionRef.current.x, lastPositionRef.current.y);
      ctx.lineTo(newPos.x, newPos.y);
      if (isEraser) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = penSize * 2;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
      ctx.stroke();
      lastPositionRef.current = newPos;
    },
    [isEraser, penColor, penSize]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    saveToHistory();
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onUpdate(note._id, { canvasImage: dataUrl });
  }, [note, onUpdate, saveToHistory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawingMode) return;
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseout", stopDrawing);
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);
    return () => {
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mouseout", stopDrawing);
      canvas.removeEventListener("touchstart", startDrawing);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDrawing);
    };
  }, [isDrawingMode, startDrawing, draw, stopDrawing]);

  // --- (Keep all your existing CustomEditor, handlers, renderElement, etc.) ---
  // ...
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
    []
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
  );

  const formatFileSize = useCallback((bytes) => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  }, []);

  function DrawingElement({ element, attributes, children, onEditDrawing }) {
    const [editing, setEditing] = useState(false);
    return (
      <div {...attributes} contentEditable={false} style={{ margin: "1em 0" }}>
        {editing ? (
          <Canvas
            value={element.dataUrl}
            onChange={(dataUrl) => {
              onEditDrawing(dataUrl);
              setEditing(false);
            }}
            width={600}
            height={300}
          />
        ) : (
          <div onClick={() => setEditing(true)} style={{ cursor: "pointer" }}>
            <img
              src={element.dataUrl}
              alt="Drawing"
              style={{ width: "100%", maxWidth: 600, borderRadius: 8 }}
            />
            <div style={{ textAlign: "center", color: "#888" }}>
              Click to edit drawing
            </div>
          </div>
        )}
        {children}
      </div>
    );
  }

  const renderElement = useCallback(
    (props) => {
      const { element, attributes, children } = props;
      const style = element.align ? { textAlign: element.align } : {};
      switch (element.type) {
        case "drawing":
          return (
            <DrawingElement
              element={element}
              attributes={attributes}
              children={children}
              onEditDrawing={(newDataUrl) => {
                Transforms.setNodes(
                  editor,
                  { dataUrl: newDataUrl },
                  { at: ReactEditor.findPath(editor, element) }
                );
              }}
            />
          );
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
                    e.target.pause();
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
      editor,
      fullscreenMedia,
      toggleFullscreen,
      formatFileSize,
      setCurrentFileUrl,
      setCurrentFileName,
      setIsFileSidebarOpen,
    ]
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
    const mediaElement = { ...mediaProps, children: [{ text: "" }] };
    Transforms.insertNodes(editorInstance, mediaElement);
    Transforms.insertNodes(
      editorInstance,
      { type: "paragraph", children: [{ text: "" }] },
      { select: true }
    );
    ReactEditor.focus(editorInstance);
  }, []);

  const insertImage = useCallback(
    (editorInstance, url, alt = "") =>
      insertMedia(editorInstance, { type: "image", url, alt }),
    [insertMedia]
  );
  const insertVideo = useCallback(
    (editorInstance, url, poster = null) =>
      insertMedia(editorInstance, { type: "video", url, poster }),
    [insertMedia]
  );
  const insertFile = useCallback(
    (editorInstance, url, filename, size, contentType) =>
      insertMedia(editorInstance, {
        type: "file",
        url,
        filename,
        size,
        contentType,
      }),
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
  );

  const HOTKEYS = useMemo(
    () => ({
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
    },
    [editor, CustomEditor, HOTKEYS]
  );

  const handleSlateChange = useCallback(
    (newValue) => {
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
    },
    [editor]
  );

  // ... (Keep all your AI/Modal handlers)
  const handleAISubmit = async (prompt) => {
    setIsLoading(true);
    setAIResponse("");
    try {
      const response = await generateContent(prompt);
      setAIResponse(response);
      if (response) {
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
      <EditorToolbar
        editor={editor}
        onFormatText={handleFormatText}
        onInsertMedia={handleMediaInsert}
        isDrawingMode={isDrawingMode}
        onToggleDrawingMode={() => setIsDrawingMode((prev) => !prev)}
        penColor={penColor}
        onSetPenColor={setPenColor}
        penSize={penSize}
        onSetPenSize={setPenSize}
        isEraser={isEraser}
        onSetIsEraser={setIsEraser}
        onUndoDrawing={handleUndoDrawing}
        onRedoDrawing={handleRedoDrawing}
        onResetDrawing={handleResetDrawing}
      />
      <div className="editor-content-wrapper" ref={editorWrapperRef}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="editor-title"
          placeholder="Note title..."
          style={{ pointerEvents: isDrawingMode ? "none" : "auto" }}
        />
        <Slate
          editor={editor}
          initialValue={initialValue}
          value={slateValue}
          onChange={handleSlateChange}
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
            data-gramm="false"
            onKeyDown={handleKeyDown}
            style={{ pointerEvents: isDrawingMode ? "none" : "auto" }}
          />
        </Slate>
        <canvas
          ref={canvasRef}
          className="drawing-canvas"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: isDrawingMode ? "auto" : "none",
            zIndex: 10,
          }}
        />
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
