/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { FileIcon, Maximize, Minimize, X } from "lucide-react";
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
import { sendCanvasToGemini } from "../../services/canvasGeminiService";
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

// --- Deserialize/Serialize Functions ---
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
    const style = el.getAttribute("style") || "";
    const marks = {};
    const colorMatch = style.match(/color:\s*([^;]+);?/);
    const bgColorMatch = style.match(/background-color:\s*([^;]+);?/);
    const fontFamilyMatch = style.match(/font-family:\s*([^;]+);?/);
    const fontSizeMatch = style.match(/font-size:\s*([^;]+);?/);
    if (colorMatch) marks.textColor = colorMatch[1].trim();
    if (bgColorMatch) marks.backgroundColor = bgColorMatch[1].trim();
    if (fontFamilyMatch)
      marks.fontFamily = fontFamilyMatch[1].replace(/["']/g, "").trim();
    if (fontSizeMatch) marks.fontSize = fontSizeMatch[1].trim();
    return marks;
  },
};

const deserializeChildren = (parent) => {
  return Array.from(parent.childNodes)
    .map((node) => deserializeNode(node))
    .flat()
    .filter(Boolean);
};

const deserializeNode = (el) => {
  if (el.nodeType === 3) {
    return el.textContent.trim() === "" ? null : { text: el.textContent };
  } else if (el.nodeType !== 1) {
    return null;
  }
  const nodeName = el.nodeName.toUpperCase();
  if (nodeName === "BR") return null;
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

const deserialize = (htmlString) => {
  if (!htmlString || !htmlString.trim()) {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }
  const sanitizedHtml = DOMPurify.sanitize(htmlString, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["div", "span"],
    ADD_ATTR: [
      "style",
      "data-type",
      "data-filename",
      "data-size",
      "data-content-type",
      "target",
    ],
  });
  const parsed = new DOMParser().parseFromString(sanitizedHtml, "text/html");
  const slateNodes = deserializeChildren(parsed.body);
  return slateNodes.length > 0
    ? slateNodes
    : [{ type: "paragraph", children: [{ text: "" }] }];
};

const serializeNode = (node) => {
  if (Text.isText(node)) {
    let string = escapeHtml(node.text);
    if (node.bold) string = `<strong>${string}</strong>`;
    if (node.italic) string = `<em>${string}</em>`;
    if (node.underline) string = `<u>${string}</u>`;
    if (node.strikethrough) string = `<s>${string}</s>`;
    if (node.code) string = `<code>${string}</code>`;

    const styles = {};
    if (node.textColor) styles.color = node.textColor;
    if (node.backgroundColor) styles["background-color"] = node.backgroundColor;
    if (node.fontFamily) styles["font-family"] = node.fontFamily;
    if (node.fontSize) styles["font-size"] = node.fontSize;
    if (Object.keys(styles).length > 0) {
      const styleString = Object.entries(styles)
        .map(([k, v]) => `${k}: ${v};`)
        .join(" ");
      string = `<span style="${styleString}">${string}</span>`;
    }
    return string;
  }

  const children = node.children.map((n) => serializeNode(n)).join("");
  const style = node.align ? `style="text-align: ${node.align};"` : "";

  switch (node.type) {
    case "paragraph":
      return `<p ${style}>${children || "&nbsp;"}</p>`;
    case "heading-one":
      return `<h1 ${style}>${children}</h1>`;
    case "heading-two":
      return `<h2 ${style}>${children}</h2>`;
    case "heading-three":
      return `<h3 ${style}>${children}</h3>`;
    case "list-item":
      return `<li ${style}>${children}</li>`;
    case "numbered-list":
      return `<ol ${style}>${children}</ol>`;
    case "bulleted-list":
      return `<ul ${style}>${children}</ul>`;
    case "block-quote":
      return `<blockquote ${style}>${children}</blockquote>`;
    case "code":
      return `<pre ${style}><code>${children}</code></pre>`;
    case "link":
      return `<a href="${escapeHtml(
        node.url
      )}" target="_blank" rel="noopener noreferrer">${children}</a>`;
    case "image":
      return `<div data-type="image" class="media-container"><img src="${escapeHtml(
        node.url
      )}" alt="${escapeHtml(node.alt || "")}" /></div>`;
    case "video":
      return `<div data-type="video" class="media-container"><video controls src="${escapeHtml(
        node.url
      )}"></video></div>`;
    case "file":
      return `<div data-type="file" class="media-container" data-filename="${escapeHtml(
        node.filename
      )}" data-size="${node.size}"><a href="${escapeHtml(
        node.url
      )}">${escapeHtml(node.filename)}</a></div>`;
    default:
      return children;
  }
};

const serialize = (value) => {
  if (!Array.isArray(value)) return "";
  return value.map(serializeNode).join("");
};

const withMedia = (editor) => {
  const { isVoid, insertBreak } = editor;
  editor.isVoid = (element) =>
    ["image", "video", "file", "drawing"].includes(element.type)
      ? true
      : isVoid(element);

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

  // --- Drawing State ---
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [penColor, setPenColor] = useState("#000000");
  const [penSize, setPenSize] = useState(2);
  const [penType, setPenType] = useState("ballpoint");
  const [isEraser, setIsEraser] = useState(false);
  const [shape, setShape] = useState("pen");
  const [isCanvasDirty, setIsCanvasDirty] = useState(false);
  const [calculationResult, setCalculationResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // --- Refs for canvas and drawing ---
  const canvasRef = useRef(null);
  const editorWrapperRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const drawingHistory = useRef([]);
  const historyIndex = useRef(-1);
  const shapeStartPointRef = useRef(null);
  const canvasSnapshotBeforeShapeRef = useRef(null);
  const [highlighterOpacity, setHighlighterOpacity] = useState(0.3);

  // --- Enhanced refs for realistic pen physics ---
  const lastVelocityRef = useRef(0);
  const lastTimestampRef = useRef(performance.now());
  const pressureRef = useRef(0.5);

  const editor = useMemo(
    () => withMedia(withHistory(withReact(createEditor()))),
    [note?._id]
  );

  const initialValue = useMemo(() => {
    const deserialized = deserialize(note?.content);
    return Array.isArray(deserialized) && deserialized.length > 0
      ? deserialized
      : [{ type: "paragraph", children: [{ text: "" }] }];
  }, [note?.content]);

  const [slateValue, setSlateValue] = useState(initialValue);

  useEffect(() => {
    if (isAutoSaving.current) return;
    setSlateValue(deserialize(note?.content || ""));
    setTitle(note?.title || "");
  }, [note?._id]);

  const { isSidebarOpen } = useSidebar();
  const updateTimeoutRef = useRef(null);

  useEffect(() => {
    updateTimeoutRef.current = setTimeout(() => {
      const contentChanged = note
        ? serialize(slateValue) !== note.content
        : false;
      const titleChanged = note ? title !== note.title : false;

      if (note && (contentChanged || titleChanged || isCanvasDirty)) {
        isAutoSaving.current = true;
        const updatePayload = {
          content: serialize(slateValue),
          title,
        };
        if (isCanvasDirty && canvasRef.current) {
          updatePayload.canvasImage = canvasRef.current.toDataURL("image/png");
        }
        onUpdate(note._id, updatePayload)
          .then(() => setIsCanvasDirty(false))
          .finally(() => {
            isAutoSaving.current = false;
          });
      }
    }, 3000);

    return () => clearTimeout(updateTimeoutRef.current);
  }, [slateValue, title, note, onUpdate, isCanvasDirty]);

  // --- Drawing Logic ---
  const hexToRgba = useCallback((hex, alpha) => {
    if (!hex?.startsWith("#")) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  // --- Enhanced pen properties function for realistic effects ---
  const getPenProperties = useCallback(
    (type, color, size, velocity = 0, pressure = 0.5) => {
      const baseProps = {
        strokeStyle: color,
        lineWidth: size,
        lineCap: "round",
        lineJoin: "round",
        opacity: 1.0,
        blend: "source-over",
      };

      switch (type) {
        case "fountain":
          // Fountain pen: Varies significantly with pressure and speed
          const fountainWidth =
            size *
            (0.5 + pressure * 1.0) *
            (1.2 - Math.min(velocity * 0.8, 0.6));
          return {
            ...baseProps,
            lineWidth: Math.max(
              size * 0.3,
              Math.min(fountainWidth, size * 2.0)
            ),
            opacity: 0.9,
            lineCap: "round",
          };

        case "calligraphy":
          // Calligraphy: Sharp edges, varies dramatically with speed
          const calligraphyWidth =
            size *
            (0.8 + pressure * 0.7) *
            (1.5 - Math.min(velocity * 1.2, 1.0));
          return {
            ...baseProps,
            lineWidth: Math.max(
              size * 0.2,
              Math.min(calligraphyWidth, size * 3.0)
            ),
            lineCap: "butt", // Sharp edges
            lineJoin: "miter",
            opacity: 0.95,
          };

        case "pencil":
          // Pencil: Subtle variations, graphite-like
          const pencilWidth =
            size *
            (0.7 + pressure * 0.4) *
            (1.1 - Math.min(velocity * 0.3, 0.3));
          return {
            ...baseProps,
            strokeStyle: hexToRgba(color, 0.7 + pressure * 0.2),
            lineWidth: Math.max(size * 0.6, Math.min(pencilWidth, size * 1.4)),
            opacity: 0.7 + pressure * 0.2,
          };

        case "highlighter":
          // Use the user-selected opacity
          return {
            ...baseProps,
            strokeStyle: hexToRgba(color, highlighterOpacity),
            lineWidth: size * 1.2,
            lineCap: "butt",
            lineJoin: "round",
            opacity: highlighterOpacity,
            blend: "multiply",
            globalCompositeOperation: "destination-over",
          };

        case "ballpoint":
        default:
          // Ballpoint: Consistent, reliable
          return {
            ...baseProps,
            lineWidth: size,
            opacity: 1.0,
          };
      }
    },
    [hexToRgba, highlighterOpacity]
  );

  // --- NEW: Text highlighting function ---
  const handleTextHighlight = useCallback(
    (color) => {
      const { selection } = editor;

      // If we have a text selection, highlight it
      if (selection && !Range.isCollapsed(selection)) {
        Transforms.setNodes(
          editor,
          { backgroundColor: color },
          {
            match: Text.isText,
            split: true,
            at: selection,
          }
        );
        ReactEditor.focus(editor);
        return;
      }

      // If no text selection, check if we have a DOM selection (for when clicking from canvas)
      const domSelection = window.getSelection();
      if (domSelection && !domSelection.isCollapsed) {
        try {
          // Get the selected text range
          const range = domSelection.getRangeAt(0);
          const selectedText = range.toString();

          if (selectedText.trim()) {
            // Find the corresponding Slate selection
            const slateRange = ReactEditor.toSlateRange(editor, range, {
              exactMatch: false,
              suppressThrow: true,
            });

            if (slateRange) {
              Transforms.setNodes(
                editor,
                { backgroundColor: color },
                {
                  match: Text.isText,
                  split: true,
                  at: slateRange,
                }
              );
            }
          }
        } catch (error) {
          console.log("Could not highlight DOM selection:", error);
        }

        // Clear the DOM selection
        domSelection.removeAllRanges();
        ReactEditor.focus(editor);
        return;
      }

      // If no selection at all, just set the mark for future typing
      Editor.addMark(editor, "backgroundColor", color);
    },
    [editor]
  );

  // --- NEW: Remove text highlight function ---
  const handleRemoveHighlight = useCallback(() => {
    const { selection } = editor;
    if (!selection) return;

    if (Range.isCollapsed(selection)) {
      // Remove highlight mark for future typing
      Editor.removeMark(editor, "backgroundColor");
    } else {
      // Remove highlight from selected text
      Transforms.unsetNodes(editor, "backgroundColor", {
        match: Text.isText,
        split: true,
        at: selection,
      });
    }

    ReactEditor.focus(editor);
  }, [editor]);

  const drawShapeOnCanvas = useCallback(
    (ctx, start, end, color, size, shapeType) => {
      const penProps = getPenProperties(penType, color, size);

      // UPDATED: Handle highlighter shapes specially
      if (penType === "highlighter") {
        ctx.globalCompositeOperation = "destination-over"; // Draw behind existing content
        ctx.globalAlpha = penProps.opacity;
        ctx.strokeStyle = penProps.strokeStyle;
        ctx.lineWidth = penProps.lineWidth;
        ctx.lineCap = penProps.lineCap;
        ctx.lineJoin = penProps.lineJoin;
      } else {
        ctx.strokeStyle = penProps.strokeStyle;
        ctx.lineWidth = penProps.lineWidth;
        ctx.lineCap = penProps.lineCap;
        ctx.lineJoin = penProps.lineJoin;
        ctx.globalAlpha = penProps.opacity;
        ctx.globalCompositeOperation = penProps.blend || "source-over";
      }

      ctx.beginPath();
      switch (shapeType) {
        case "rect":
          ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
          break;
        case "circle": {
          const radius = Math.hypot(end.x - start.x, end.y - start.y);
          ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        }
        case "line":
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          break;
        case "triangle":
          ctx.moveTo(start.x, end.y);
          ctx.lineTo((start.x + end.x) / 2, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.closePath();
          ctx.stroke();
          break;
        default:
          break;
      }
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = "source-over";
    },
    [getPenProperties, penType]
  );

  const handleCalculate = async () => {
    if (!canvasRef.current || isCalculating) return;
    setIsCalculating(true);
    setCalculationResult("Loading...");
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const answer = await sendCanvasToGemini(dataUrl, note?._id);
      setCalculationResult(answer);
    } catch (error) {
      console.error("Calculation error:", error);
      setCalculationResult("Error: Could not get a result.");
    } finally {
      setIsCalculating(false);
    }
  };

  const formatResult = (result) => {
    // Simply return the result as a string, removing any JSON parsing.
    return result || "";
  };

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
      setIsCanvasDirty(true);
    }
  }, [drawImageOnCanvas]);

  const handleRedoDrawing = useCallback(() => {
    if (historyIndex.current < drawingHistory.current.length - 1) {
      historyIndex.current++;
      const imageData = drawingHistory.current[historyIndex.current];
      drawImageOnCanvas(imageData);
      setIsCanvasDirty(true);
    }
  }, [drawImageOnCanvas]);

  const handleResetDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const blankImage = canvas.toDataURL("image/png");
    drawingHistory.current = [blankImage];
    historyIndex.current = 0;
    setIsCanvasDirty(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = editorWrapperRef.current;
    if (!canvas || !wrapper) return;

    const resizeObserver = new ResizeObserver(() => {
      const currentData = canvas.toDataURL();
      canvas.width = wrapper.scrollWidth;
      canvas.height = wrapper.scrollHeight;
      const ctx = canvas.getContext("2d");
      drawImageOnCanvas(currentData, ctx);
    });
    resizeObserver.observe(wrapper);

    canvas.width = wrapper.scrollWidth;
    canvas.height = wrapper.scrollHeight;

    if (note?.canvasImage) {
      drawImageOnCanvas(note.canvasImage);
      drawingHistory.current = [note.canvasImage];
      historyIndex.current = 0;
    } else {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawingHistory.current = [canvas.toDataURL()];
      historyIndex.current = 0;
    }

    return () => resizeObserver.disconnect();
  }, [note?._id, drawImageOnCanvas]);

  const getCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  // --- COMPLETELY REWRITTEN: Apple Notes-style drawing logic ---
  const startDrawing = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // --- SMART HIGHLIGHTER LOGIC ---
      if (penType === "highlighter" && !isEraser) {
        // Temporarily disable pointer events on the canvas to "peek" at what's underneath.
        canvas.style.pointerEvents = "none";
        const elementUnderneath = document.elementFromPoint(
          e.clientX,
          e.clientY
        );
        // Immediately restore pointer events so canvas drawing can work if needed.
        canvas.style.pointerEvents = "auto";

        const editorContent =
          editorWrapperRef.current?.querySelector(".rich-editor");

        // Check if the click was on the rich text editor content.
        if (editorContent && editorContent.contains(elementUnderneath)) {
          // The user is trying to highlight typed text.
          // 1. Prevent the canvas from starting a drawing path.
          e.preventDefault();

          // 2. Temporarily disable drawing mode to allow native browser text selection.
          setIsDrawingMode(false);

          // 3. On mouse up, check for a selection and apply the highlight.
          const handleMouseUpForHighlight = () => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed) {
              handleTextHighlight(penColor);
            }
            // 4. Always re-enable drawing mode afterwards.
            setIsDrawingMode(true);
          };

          // Listen for the *next* mouseup event on the document, then remove the listener.
          document.addEventListener("mouseup", handleMouseUpForHighlight, {
            once: true,
          });

          // Return here to prevent the canvas drawing logic from running.
          return;
        }
        // If the click was not on the editor, fall through to the default canvas drawing logic below.
      }

      // --- HANDWRITTEN/CANVAS DRAWING LOGIC (existing code) ---
      e.preventDefault(); // Keep this for touch devices
      saveToHistory();
      isDrawingRef.current = true;
      const coords = getCoords(e);
      const ctx = canvas.getContext("2d");

      pressureRef.current = e.pressure || 0.5;

      if (shape !== "pen") {
        shapeStartPointRef.current = coords;
        canvasSnapshotBeforeShapeRef.current = canvas.toDataURL();
      } else {
        const penProps =
          penType === "highlighter"
            ? getPenProperties(penType, penColor, penSize, 0, 1)
            : getPenProperties(
                penType,
                penColor,
                penSize,
                0,
                pressureRef.current
              );

        if (isEraser) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.globalAlpha = 1.0;
          ctx.lineCap = "round";
          ctx.lineWidth = penSize * 2;
        } else if (penType === "highlighter") {
          ctx.globalCompositeOperation = "destination-over";
          ctx.globalAlpha = penProps.opacity;
          ctx.lineCap = penProps.lineCap;
          ctx.lineJoin = penProps.lineJoin;
          ctx.strokeStyle = penProps.strokeStyle;
          ctx.lineWidth = penProps.lineWidth;
        } else {
          ctx.globalCompositeOperation = penProps.blend || "source-over";
          ctx.globalAlpha = penProps.opacity;
          ctx.lineCap = penProps.lineCap;
          ctx.lineJoin = penProps.lineJoin;
          ctx.strokeStyle = penProps.strokeStyle;
          ctx.lineWidth = penProps.lineWidth;
        }

        lastPositionRef.current = coords;
        lastTimestampRef.current = performance.now();
        lastVelocityRef.current = 0;

        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
      }
    },
    [
      shape,
      saveToHistory,
      getCoords,
      getPenProperties,
      penType,
      penColor,
      penSize,
      isEraser,
      handleTextHighlight,
      setIsDrawingMode,
    ]
  );

  // --- COMPLETELY REWRITTEN: Smooth, Apple Notes-style drawing with highlighter support ---
  const draw = useCallback(
    (e) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const newPos = getCoords(e);

      // Handle shapes
      if (shape !== "pen" && shapeStartPointRef.current) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          drawShapeOnCanvas(
            ctx,
            shapeStartPointRef.current,
            newPos,
            penColor,
            penSize,
            shape
          );
        };
        img.src = canvasSnapshotBeforeShapeRef.current;
        return;
      }

      // Handle pen drawing
      if (shape === "pen") {
        // Calculate velocity for realistic pen behavior
        const now = performance.now();
        const timeDelta = Math.max(now - lastTimestampRef.current, 1);
        const distance = Math.hypot(
          newPos.x - lastPositionRef.current.x,
          newPos.y - lastPositionRef.current.y
        );
        const currentVelocity = distance / timeDelta;

        // Smooth the velocity to avoid jitter
        const smoothedVelocity =
          currentVelocity * 0.3 + lastVelocityRef.current * 0.7;

        // Update pressure if available
        pressureRef.current = e.pressure || pressureRef.current;

        let penProps;
        if (!isEraser) {
          penProps =
            penType === "highlighter"
              ? getPenProperties(penType, penColor, penSize, 0, 1)
              : getPenProperties(
                  penType,
                  penColor,
                  penSize,
                  smoothedVelocity,
                  pressureRef.current
                );

          if (penType === "highlighter") {
            ctx.globalCompositeOperation = "destination-over";
            ctx.globalAlpha = penProps.opacity;
            ctx.strokeStyle = penProps.strokeStyle;
            ctx.lineWidth = penProps.lineWidth;
            ctx.lineCap = penProps.lineCap;
            ctx.lineJoin = penProps.lineJoin;
          } else {
            const targetWidth = penProps.lineWidth;
            ctx.lineWidth = ctx.lineWidth * 0.7 + targetWidth * 0.3;
            ctx.strokeStyle = penProps.strokeStyle;
            ctx.globalAlpha = penProps.opacity;
            ctx.globalCompositeOperation = penProps.blend;
          }
        }

        ctx.lineTo(newPos.x, newPos.y);
        ctx.stroke();

        lastPositionRef.current = newPos;
        lastTimestampRef.current = now;
        lastVelocityRef.current = smoothedVelocity;
      }
    },
    [
      isDrawingRef,
      getCoords,
      shape,
      drawShapeOnCanvas,
      penColor,
      penSize,
      getPenProperties,
      penType,
      isEraser,
    ]
  );

  // --- UPDATED: Clean stop drawing ---
  const stopDrawing = useCallback(
    (e) => {
      if (!isDrawingRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");

      // --- Shape Drawing Logic ---
      if (
        shape !== "pen" &&
        shapeStartPointRef.current &&
        canvasSnapshotBeforeShapeRef.current
      ) {
        // Capture the start point before it's cleared
        const startPoint = shapeStartPointRef.current;
        const endPoint = getCoords(e);
        const snapshot = canvasSnapshotBeforeShapeRef.current;

        const img = new Image();
        img.onload = () => {
          // 1. Restore canvas to the state before the shape was started
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          // 2. Draw the final shape
          drawShapeOnCanvas(
            ctx,
            startPoint,
            endPoint,
            penColor,
            penSize,
            shape
          );

          // 3. Now it's safe to clear the refs
          shapeStartPointRef.current = null;
          canvasSnapshotBeforeShapeRef.current = null;
        };
        img.src = snapshot;
      } else {
        // For pen/eraser, just clear the refs
        shapeStartPointRef.current = null;
        canvasSnapshotBeforeShapeRef.current = null;
      }

      // --- General Cleanup ---
      ctx.closePath();
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      isDrawingRef.current = false;
      setIsCanvasDirty(true);
    },
    [shape, getCoords, drawShapeOnCanvas, penColor, penSize]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawingMode) return;

    // UPDATED: Special handling for highlighter mode
    if (penType === "highlighter") {
      // Allow both text selection and canvas drawing
      canvas.style.pointerEvents = "auto";
      canvas.style.zIndex = "5"; // Lower than text, but higher than background
    } else {
      // Normal drawing mode
      canvas.style.pointerEvents = "auto";
      canvas.style.zIndex = "10";
    }

    // Use pointer events for better compatibility
    canvas.addEventListener("pointerdown", startDrawing);
    canvas.addEventListener("pointermove", draw);
    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointerleave", stopDrawing);

    // Prevent scrolling on touch devices while drawing
    const preventDefault = (e) => e.preventDefault();
    document.body.addEventListener("touchmove", preventDefault, {
      passive: false,
    });

    return () => {
      canvas.removeEventListener("pointerdown", startDrawing);
      canvas.removeEventListener("pointermove", draw);
      canvas.removeEventListener("pointerup", stopDrawing);
      canvas.removeEventListener("pointerleave", stopDrawing);
      document.body.removeEventListener("touchmove", preventDefault);
    };
  }, [isDrawingMode, startDrawing, draw, stopDrawing, penType]);

  // --- CustomEditor and other Slate functions ---
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
                  onLoadedData={(e) => e.target.pause()}
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
    [editor, fullscreenMedia, toggleFullscreen, formatFileSize]
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

      // UPDATED: Handle text highlighting - now only called from highlighter pen
      if (formatType === "highlight") {
        handleTextHighlight(value || penColor);
        return;
      }

      if (formatType === "removeHighlight") {
        handleRemoveHighlight();
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
    [
      editor,
      CustomEditor,
      insertLink,
      handleTextHighlight,
      handleRemoveHighlight,
      penColor,
    ]
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

  // AI and Modal handlers
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
        highlighterOpacity={highlighterOpacity}
        onSetHighlighterOpacity={setHighlighterOpacity}
        isEraser={isEraser}
        onSetIsEraser={setIsEraser}
        onUndoDrawing={handleUndoDrawing}
        onRedoDrawing={handleRedoDrawing}
        onResetDrawing={handleResetDrawing}
        penType={penType}
        onSetPenType={setPenType}
        shape={shape}
        onSetShape={setShape}
        onCalculate={handleCalculate}
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
            touchAction: "none", // Prevents default touch behaviors
          }}
        />
      </div>

      {/* AI Assistant and Modals */}
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
      {calculationResult && (
        <div className="canvas-result-sticky">
          <div style={{ flex: 1 }}>
            <strong>Result:</strong>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {isCalculating ? "Loading..." : formatResult(calculationResult)}
            </pre>
          </div>
          <button
            onClick={() => setCalculationResult(null)}
            className="close-btn"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default NoteEditor;
