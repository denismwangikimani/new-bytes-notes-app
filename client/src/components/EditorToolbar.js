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
  ChevronDown,
  MoreHorizontal,
  Image,
  Link,
  Video,
  FileText,
  BookText,
  Square,
  Circle,
  Triangle,
  Minus,
  Brush,
  Highlighter,
  Pencil,
  Eraser,
  Calculator,
  Pen,
  Undo,
  Redo,
  Trash2,
} from "lucide-react";
import "./EditorToolbar.css";
import MediaDialog from "./MediaDialog";

const EditorToolbar = ({
  onFormatText,
  editor,
  onInsertMedia,
  isDrawingMode,
  onToggleDrawingMode,
  penColor,
  onSetPenColor,
  penSize,
  onSetPenSize, // Add penSize props
  isEraser,
  onSetIsEraser,
  onUndoDrawing,
  onRedoDrawing,
  onResetDrawing,
  penType,
  onSetPenType,
  shape,
  onSetShape,
  onCalculate,
  highlighterOpacity,
  onSetHighlighterOpacity,
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

  // State for drawing dropdowns
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);

  const fontFamilyMenuRef = useRef(null);
  const fontFamilyButtonRef = useRef(null);
  const fontSizeMenuRef = useRef(null);
  const fontSizeButtonRef = useRef(null);
  const headingMenuRef = useRef(null);
  const headingButtonRef = useRef(null);
  // Refs for drawing dropdowns
  const shapeMenuRef = useRef(null);
  const shapeButtonRef = useRef(null);
  const colorPaletteRef = useRef(null);
  const colorButtonRef = useRef(null);

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

  const pens = [
    {
      type: "ballpoint",
      name: "Ballpoint Pen",
      icon: <Pen size={18} />,
      defaultSize: 2,
      minSize: 0.5,
      maxSize: 8,
    },
    {
      type: "fountain",
      name: "Fountain Pen",
      icon: <Brush size={18} />,
      defaultSize: 3,
      minSize: 1,
      maxSize: 12,
    },
    {
      type: "calligraphy",
      name: "Calligraphy Pen",
      icon: <Pencil size={18} />, // You might want a different icon
      defaultSize: 4,
      minSize: 2,
      maxSize: 20,
    },
    {
      type: "pencil",
      name: "Pencil",
      icon: <Pencil size={18} />,
      defaultSize: 1.5,
      minSize: 0.5,
      maxSize: 6,
    },
    {
      type: "highlighter",
      name: "Highlighter",
      icon: <Highlighter size={18} />,
      defaultSize: 8,
      minSize: 4,
      maxSize: 24,
    },
  ];

  const shapes = [
    { type: "pen", name: "Freehand", icon: <Pen size={18} /> },
    { type: "line", name: "Line", icon: <Minus size={18} /> },
    { type: "rect", name: "Rectangle", icon: <Square size={18} /> },
    { type: "circle", name: "Circle", icon: <Circle size={18} /> },
    { type: "triangle", name: "Triangle", icon: <Triangle size={18} /> },
  ];

  const drawingColors = [
    "#000000", // Black
    "#ef4444", // Red
    "#f97316", // Orange
    "#eab308", // Yellow - great for highlighting
    "#84cc16", // Lime green
    "#22c55e", // Green
    "#14b8a6", // Teal
    "#06b6d4", // Cyan - good for highlighting
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#d946ef", // Magenta - good for highlighting
    "#ec4899", // Pink
    "#ffffff", // White
    "#6b7280", // Gray
    "#facc15", // Bright yellow - excellent for highlighting
    "#4ade80", // Bright green
    "#67e8f9", // Light cyan
    "#a5b4fc", // Light purple
    "#f0abfc", // Light pink - great for highlighting
  ];

  const handlePenIconClick = () => {
    onToggleDrawingMode();
  };

  // Handle pen type change with size reset
  const handlePenTypeChange = (newPenType) => {
    const pen = pens.find((p) => p.type === newPenType);
    if (pen) {
      onSetPenType(newPenType);
      onSetPenSize(pen.defaultSize);
      onSetIsEraser(false);

      // UPDATED: For highlighter, show instruction about unified highlighting
      if (newPenType === "highlighter") {
        // Don't show alert anymore, just activate the highlighter
        console.log(
          "Highlighter selected - can highlight both typed and handwritten text"
        );
      }
    }
  };

  // Get current pen for size limits
  const currentPen = pens.find((p) => p.type === penType) || pens[0];

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
      if (
        showShapeMenu &&
        shapeMenuRef.current &&
        !shapeMenuRef.current.contains(event.target) &&
        !shapeButtonRef.current.contains(event.target)
      )
        setShowShapeMenu(false);
      if (
        showColorPalette &&
        colorPaletteRef.current &&
        !colorPaletteRef.current.contains(event.target) &&
        !colorButtonRef.current.contains(event.target)
      )
        setShowColorPalette(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [
    showFontFamilyMenu,
    showFontSizeMenu,
    showHeadingMenu,
    showShapeMenu,
    showColorPalette,
  ]);

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
          <Pen size={18} />
        </button>
        <div className="toolbar-divider"></div>

        {isDrawingMode ? (
          <>
            <button
              className="toolbar-button"
              onClick={onUndoDrawing}
              title="Undo"
            >
              <Undo size={18} />
            </button>
            <button
              className="toolbar-button"
              onClick={onRedoDrawing}
              title="Redo"
            >
              <Redo size={18} />
            </button>
            <div className="toolbar-divider"></div>

            {/* Pen Type Buttons */}
            {pens.map((p) => (
              <button
                key={p.type}
                className={`toolbar-button ${
                  penType === p.type && !isEraser ? "active" : ""
                }`}
                onClick={() => handlePenTypeChange(p.type)}
                title={p.name}
              >
                {p.icon}
              </button>
            ))}

            <button
              className={`toolbar-button ${isEraser ? "active" : ""}`}
              onClick={() => onSetIsEraser((e) => !e)}
              title="Eraser"
            >
              <Eraser size={18} />
            </button>
            <div className="toolbar-divider"></div>

            {/* Pen Size Slider */}
            <div className="pen-size-container">
              <label className="toolbar-label-with-slider">
                Size:
                <input
                  type="range"
                  min={currentPen.minSize}
                  max={currentPen.maxSize}
                  step={0.5}
                  value={penSize}
                  onChange={(e) => onSetPenSize(Number(e.target.value))}
                  className="size-slider"
                />
                <span className="size-display">{penSize}</span>
              </label>
            </div>
            <div className="toolbar-divider"></div>

            {/* Highlighter Opacity Slider */}
            {penType === "highlighter" && (
              <div className="pen-size-container">
                <label className="toolbar-label-with-slider">
                  Transparency:
                  <input
                    type="range"
                    min={0.02}
                    max={0.3}
                    step={0.01}
                    value={highlighterOpacity}
                    onChange={(e) =>
                      onSetHighlighterOpacity(Number(e.target.value))
                    }
                    className="size-slider"
                    style={{ width: 80 }}
                  />
                  <span className="size-display">
                    {highlighterOpacity <= 0.04
                      ? "Clear"
                      : highlighterOpacity < 0.12
                      ? "Less"
                      : highlighterOpacity < 0.22
                      ? "More"
                      : "Opaque"}
                  </span>
                </label>
              </div>
            )}

            {/* Shape Dropdown */}
            <div className="toolbar-dropdown">
              <button
                ref={shapeButtonRef}
                className="toolbar-button"
                onClick={() => setShowShapeMenu((s) => !s)}
                title="Draw Shape"
              >
                {shapes.find((s) => s.type === shape)?.icon || (
                  <Square size={18} />
                )}
                <ChevronDown size={14} />
              </button>
              {showShapeMenu && (
                <div ref={shapeMenuRef} className="dropdown-menu">
                  {shapes.map((s) => (
                    <button
                      key={s.type}
                      className="dropdown-item"
                      onClick={() => {
                        onSetShape(s.type);
                        setShowShapeMenu(false);
                      }}
                    >
                      {s.icon} <span style={{ marginLeft: 8 }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Color Palette */}
            <div className="toolbar-dropdown">
              <button
                ref={colorButtonRef}
                className="toolbar-button"
                onClick={() => setShowColorPalette((s) => !s)}
                title="Pen Color"
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    backgroundColor: penColor,
                    border: "1px solid #ccc",
                  }}
                ></div>
              </button>
              {showColorPalette && (
                <div
                  ref={colorPaletteRef}
                  className="dropdown-menu color-palette-menu"
                >
                  {drawingColors.map((c) => (
                    <button
                      key={c}
                      className="color-palette-item"
                      style={{ backgroundColor: c }}
                      onClick={() => {
                        onSetPenColor(c);
                        setShowColorPalette(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <button
              className="toolbar-button"
              onClick={onResetDrawing}
              title="Clear Canvas"
            >
              <Trash2 size={18} />
            </button>
            <div className="toolbar-divider"></div>

            <button
              className="toolbar-button"
              onClick={onCalculate}
              title="Calculate with AI"
            >
              <Calculator size={18} />
            </button>
            <div className="toolbar-divider"></div>

            <button
              className="toolbar-button"
              onClick={() => handleFormat("image")}
              title="Insert Image"
            >
              <Image size={18} />
            </button>
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
      {showMediaDialog && (
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
