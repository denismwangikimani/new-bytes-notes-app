import React, { useState, useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Code,
  Quote,
  Type,
  Heading1,
  Heading2,
  Heading3,
  ChevronDown,
  MoreHorizontal,
  Image,
  Link,
  Video,
  FileText,
  BookText,
} from "lucide-react";
import "./EditorToolbar.css";
import MediaDialog from "./MediaDialog";

// A simplified toolbar for canvas controls
const CanvasToolbar = ({
  onUndo,
  onRedo,
  onReset,
  onEraser,
  onPenSize,
  isEraser,
  penSize,
}) => (
  <div
    className="canvas-toolbar-scroll"
    style={{ display: "flex", alignItems: "center", gap: 8 }}
  >
    <button className="toolbar-button" onClick={onUndo}>
      Undo
    </button>
    <button className="toolbar-button" onClick={onRedo}>
      Redo
    </button>
    <button className="toolbar-button" onClick={onReset}>
      Clear
    </button>
    <button
      className={`toolbar-button ${isEraser ? "active" : ""}`}
      onClick={onEraser}
      title={isEraser ? "Switch to Pen" : "Switch to Eraser"}
    >
      Eraser
    </button>
    <label
      style={{
        marginLeft: 8,
        display: "flex",
        alignItems: "center",
        gap: "4px",
        color: "#6b7280",
      }}
    >
      Size:
      <input
        type="range"
        min={1}
        max={20}
        value={penSize}
        onChange={(e) => onPenSize(Number(e.target.value))}
        style={{ verticalAlign: "middle" }}
      />
    </label>
  </div>
);

const EditorToolbar = ({
  onFormatText,
  editor,
  onInsertMedia,
  isDrawingMode,
  onToggleDrawingMode,
  penColor,
  onSetPenColor,
  penSize,
  onSetPenSize,
  isEraser,
  onSetIsEraser,
  onUndoDrawing,
  onRedoDrawing,
  onResetDrawing,
}) => {
  const [showAllTools, setShowAllTools] = useState(false);
  const [showFontFamilyMenu, setShowFontFamilyMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [mediaType, setMediaType] = useState(null);

  const fontFamilyMenuRef = useRef(null);
  const fontFamilyButtonRef = useRef(null);
  const fontSizeMenuRef = useRef(null);
  const fontSizeButtonRef = useRef(null);
  const headingMenuRef = useRef(null);
  const headingButtonRef = useRef(null);

  const fontFamilies = [
    { name: "Arial", value: "Arial, sans-serif" },
    { name: "Times New Roman", value: '"Times New Roman", Times, serif' },
    { name: "Courier New", value: '"Courier New", Courier, monospace' },
    { name: "Georgia", value: "Georgia, serif" },
    { name: "Verdana", value: "Verdana, sans-serif" },
    { name: "Calibri", value: "Calibri, sans-serif" },
  ];
  const fontSizes = [
    { name: "Small", value: "12px" },
    { name: "Normal", value: "16px" },
    { name: "Medium", value: "20px" },
    { name: "Large", value: "24px" },
    { name: "X-Large", value: "32px" },
  ];

  const handlePenIconClick = () => {
    onToggleDrawingMode();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showFontFamilyMenu &&
        fontFamilyMenuRef.current &&
        !fontFamilyMenuRef.current.contains(event.target) &&
        !fontFamilyButtonRef.current.contains(event.target)
      )
        setShowFontFamilyMenu(false);
      if (
        showFontSizeMenu &&
        fontSizeMenuRef.current &&
        !fontSizeMenuRef.current.contains(event.target) &&
        !fontSizeButtonRef.current.contains(event.target)
      )
        setShowFontSizeMenu(false);
      if (
        showHeadingMenu &&
        headingMenuRef.current &&
        !headingMenuRef.current.contains(event.target) &&
        !headingButtonRef.current.contains(event.target)
      )
        setShowHeadingMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFontFamilyMenu, showFontSizeMenu, showHeadingMenu]);

  const handleFormat = (formatType, value = null) => {
    if (["image", "video", "link", "file"].includes(formatType)) {
      setMediaType(formatType);
      setShowMediaDialog(true);
      return;
    }
    onFormatText(formatType, value);
    if (formatType === "fontFamily") setShowFontFamilyMenu(false);
    if (formatType === "fontSize") setShowFontSizeMenu(false);
    if (formatType.startsWith("heading")) setShowHeadingMenu(false);
  };

  const handleColorChange = (type, color) => {
    if (type === "text") {
      setTextColor(color);
      onFormatText("textColor", color);
    } else {
      setBgColor(color);
      onFormatText("backgroundColor", color);
    }
  };

  useEffect(() => {
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const detectKeyboard = () => {
      if (!isTouchDevice) return;
      const newViewportHeight = window.innerHeight;
      if (viewportHeight - newViewportHeight > 150) {
        setIsKeyboardVisible(true);
      } else {
        setIsKeyboardVisible(false);
      }
      setViewportHeight(newViewportHeight);
    };
    if (isTouchDevice) {
      window.addEventListener("resize", detectKeyboard);
      return () => window.removeEventListener("resize", detectKeyboard);
    }
  }, [viewportHeight]);

  const primaryTools = (
    <>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("bold")}
        title="Bold"
      >
        <Bold size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("italic")}
        title="Italic"
      >
        <Italic size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("underline")}
        title="Underline"
      >
        <Underline size={18} />
      </button>
      <div className="toolbar-divider"></div>
      <div className="toolbar-dropdown">
        <button
          ref={fontFamilyButtonRef}
          className="toolbar-button dropdown-toggle"
          onClick={() => setShowFontFamilyMenu((s) => !s)}
          title="Font Family"
        >
          <BookText size={18} />
          <ChevronDown size={14} />
        </button>
        {showFontFamilyMenu && (
          <div ref={fontFamilyMenuRef} className="dropdown-menu">
            <div className="dropdown-section">
              <div className="dropdown-label">Font Family</div>
              {fontFamilies.map((font) => (
                <button
                  key={font.name}
                  className="dropdown-item"
                  style={{ fontFamily: font.value }}
                  onClick={() => handleFormat("fontFamily", font.value)}
                >
                  {font.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="toolbar-dropdown">
        <button
          ref={fontSizeButtonRef}
          className="toolbar-button dropdown-toggle"
          onClick={() => setShowFontSizeMenu((s) => !s)}
          title="Font Size"
        >
          <Type size={18} />
          <ChevronDown size={14} />
        </button>
        {showFontSizeMenu && (
          <div ref={fontSizeMenuRef} className="dropdown-menu">
            <div className="dropdown-section">
              <div className="dropdown-label">Font Size</div>
              {fontSizes.map((size) => (
                <button
                  key={size.name}
                  className="dropdown-item"
                  onClick={() => handleFormat("fontSize", size.value)}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="toolbar-divider"></div>
      <div className="color-picker-container">
        <button
          className="toolbar-button color-button"
          title="Text Color"
          style={{ borderBottom: `3px solid ${textColor}` }}
        >
          <input
            type="color"
            value={textColor}
            onChange={(e) => handleColorChange("text", e.target.value)}
            className="color-input"
          />
          <span className="color-label">A</span>
        </button>
      </div>
      <div className="color-picker-container">
        <button
          className="toolbar-button color-button"
          title="Background Color"
          style={{
            backgroundColor: bgColor !== "#ffffff" ? bgColor : "transparent",
          }}
        >
          <input
            type="color"
            value={bgColor}
            onChange={(e) => handleColorChange("background", e.target.value)}
            className="color-input"
          />
          <span className="color-label bg-label">BG</span>
        </button>
      </div>
      <div className="toolbar-divider"></div>
    </>
  );

  const secondaryTools = (
    <>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("strikethrough")}
        title="Strikethrough"
      >
        <Strikethrough size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("code")}
        title="Code"
      >
        <Code size={18} />
      </button>
      <div className="toolbar-divider"></div>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("align", "left")}
        title="Align Left"
      >
        <AlignLeft size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("align", "center")}
        title="Align Center"
      >
        <AlignCenter size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("align", "right")}
        title="Align Right"
      >
        <AlignRight size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("align", "justify")}
        title="Align Justify"
      >
        <AlignJustify size={18} />
      </button>
      <div className="toolbar-divider"></div>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("bulletList")}
        title="Bulleted List"
      >
        <List size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("numberedList")}
        title="Numbered List"
      >
        <ListOrdered size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("blockquote")}
        title="Blockquote"
      >
        <Quote size={18} />
      </button>
      <div className="toolbar-divider"></div>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("image")}
        title="Insert Image"
      >
        <Image size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("video")}
        title="Insert Video"
      >
        <Video size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("link")}
        title="Insert Link"
      >
        <Link size={18} />
      </button>
      <button
        className="toolbar-button"
        onClick={() => handleFormat("file")}
        title="Insert File"
      >
        <FileText size={18} />
      </button>
    </>
  );

  return (
    <div
      className={`editor-toolbar ${
        isKeyboardVisible ? "keyboard-visible" : ""
      }`}
    >
      <div className="toolbar-inner">
        <button
          className={`toolbar-button${isDrawingMode ? " active" : ""}`}
          onClick={handlePenIconClick}
          title={isDrawingMode ? "Switch to Typing" : "Switch to Drawing"}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
          </svg>
        </button>
        <div className="toolbar-divider"></div>

        {isDrawingMode ? (
          <>
            <CanvasToolbar
              onUndo={onUndoDrawing}
              onRedo={onRedoDrawing}
              onReset={onResetDrawing}
              onEraser={() => onSetIsEraser((e) => !e)}
              onPenSize={onSetPenSize}
              isEraser={isEraser}
              penSize={penSize}
            />
            <div className="color-picker-container">
              <button
                className="toolbar-button color-button"
                title="Pen Color"
                style={{ borderBottom: `3px solid ${penColor}` }}
              >
                <input
                  type="color"
                  value={penColor}
                  onChange={(e) => onSetPenColor(e.target.value)}
                  className="color-input"
                />
                <span className="color-label" style={{ color: penColor }}>
                  Pen
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            {primaryTools}
            <div
              className={`secondary-tools ${showAllTools ? "expanded" : ""}`}
            >
              {secondaryTools}
            </div>
            <button
              className="toolbar-button more-button"
              onClick={() => setShowAllTools(!showAllTools)}
              title={showAllTools ? "Show Less" : "Show More"}
            >
              <MoreHorizontal size={18} />
            </button>
          </>
        )}
      </div>
      {!isDrawingMode && showMediaDialog && (
        <MediaDialog
          type={mediaType}
          isOpen={showMediaDialog}
          onClose={() => setShowMediaDialog(false)}
          onInsert={(type, data) => {
            onInsertMedia(type, data);
            setShowMediaDialog(false);
          }}
        />
      )}
    </div>
  );
};

export default EditorToolbar;
