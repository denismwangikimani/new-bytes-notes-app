import React, { useState, useEffect, useRef } from "react"; // Import useEffect and useRef
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
} from "lucide-react";
import "./EditorToolbar.css";

const EditorToolbar = ({ onFormatText }) => {
  const [showAllTools, setShowAllTools] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");

  // Refs for dropdowns and their toggle buttons
  const fontMenuRef = useRef(null);
  const fontButtonRef = useRef(null);
  const headingMenuRef = useRef(null);
  const headingButtonRef = useRef(null);

  // Font families and sizes (existing code)
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close font menu if click is outside
      if (
        showFontMenu &&
        fontMenuRef.current &&
        fontButtonRef.current &&
        !fontMenuRef.current.contains(event.target) &&
        !fontButtonRef.current.contains(event.target)
      ) {
        setShowFontMenu(false);
      }
      // Close heading menu if click is outside
      if (
        showHeadingMenu &&
        headingMenuRef.current &&
        headingButtonRef.current &&
        !headingMenuRef.current.contains(event.target) &&
        !headingButtonRef.current.contains(event.target)
      ) {
        setShowHeadingMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFontMenu, showHeadingMenu]); // Add dependencies

  const handleFormat = (formatType, value = null) => {
    onFormatText(formatType, value);
    // Close menus after selection (existing code)
    if (formatType === "fontFamily" || formatType === "fontSize") {
      setShowFontMenu(false);
    }
    if (formatType.startsWith("heading")) {
      setShowHeadingMenu(false);
    }
  };

  const handleColorChange = (type, color) => {
    // Existing code
    if (type === "text") {
      setTextColor(color);
      onFormatText("textColor", color);
    } else {
      setBgColor(color);
      onFormatText("backgroundColor", color);
    }
  };

  // Primary tools definition (modified font dropdown part)
  const primaryTools = (
    <>
      {/* Bold, Italic, Underline buttons */}
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

      {/* Font dropdown - ADDED ref and stopPropagation */}
      <div className="toolbar-dropdown">
        <button
          ref={fontButtonRef} // Assign ref
          className="toolbar-button dropdown-toggle"
          onClick={(e) => {
            e.stopPropagation(); // Prevent click from closing menu immediately
            setShowFontMenu(!showFontMenu);
            setShowHeadingMenu(false); // Close other menu
          }}
          title="Font Options"
        >
          <Type size={18} />
          <ChevronDown size={14} />
        </button>
        {showFontMenu && (
          <div ref={fontMenuRef} className="dropdown-menu">
            {" "}
            {/* Assign ref */}
            {/* Font Family Section */}
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
            <div className="dropdown-divider"></div>
            {/* Font Size Section */}
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

      {/* Color pickers */}
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

  // Secondary tools definition (modified heading dropdown part)
  const secondaryTools = (
    <>
      {/* Alignment buttons */}
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
        title="Justify"
      >
        <AlignJustify size={18} />
      </button>
      <div className="toolbar-divider"></div>

      {/* List buttons */}
      <button
        className="toolbar-button"
        onClick={() => handleFormat("bulletList")}
        title="Bullet List"
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
      <div className="toolbar-divider"></div>

      {/* Headings dropdown - ADDED ref and stopPropagation */}
      <div className="toolbar-dropdown">
        <button
          ref={headingButtonRef} // Assign ref
          className="toolbar-button dropdown-toggle"
          onClick={(e) => {
            e.stopPropagation(); // Prevent click from closing menu immediately
            setShowHeadingMenu(!showHeadingMenu);
            setShowFontMenu(false); // Close other menu
          }}
          title="Headings"
        >
          <Heading1 size={18} />
          <ChevronDown size={14} />
        </button>
        {showHeadingMenu && (
          <div ref={headingMenuRef} className="dropdown-menu heading-menu">
            {" "}
            {/* Assign ref */}
            <button
              className="dropdown-item"
              onClick={() => handleFormat("heading", "h1")}
            >
              <Heading1 size={16} /> Heading 1
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleFormat("heading", "h2")}
            >
              <Heading2 size={16} /> Heading 2
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleFormat("heading", "h3")}
            >
              <Heading3 size={16} /> Heading 3
            </button>
          </div>
        )}
      </div>

      {/* Strikethrough, Code, Quote buttons */}
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
      <button
        className="toolbar-button"
        onClick={() => handleFormat("blockquote")}
        title="Blockquote"
      >
        <Quote size={18} />
      </button>
      <div className="toolbar-divider"></div>

      {/* Future features (disabled) */}
      <button
        className="toolbar-button disabled"
        title="Insert Image (Coming Soon)"
      >
        <Image size={18} />
      </button>
      <button
        className="toolbar-button disabled"
        title="Insert Link (Coming Soon)"
      >
        <Link size={18} />
      </button>
      <button
        className="toolbar-button disabled"
        title="Insert Video (Coming Soon)"
      >
        <Video size={18} />
      </button>
    </>
  );

  // Main return statement
  return (
    <div className="editor-toolbar">
      <div className="toolbar-inner">
        {primaryTools}
        <div className={`secondary-tools ${showAllTools ? "expanded" : ""}`}>
          {secondaryTools}
        </div>
        <button
          className="toolbar-button more-button"
          onClick={() => setShowAllTools(!showAllTools)}
          title={showAllTools ? "Show Less" : "Show More"}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
    </div>
  );
};

export default EditorToolbar;
