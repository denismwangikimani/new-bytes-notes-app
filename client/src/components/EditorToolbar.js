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
  // Add this new import for font family icon
  BookText,
} from "lucide-react";
import "./EditorToolbar.css";

const EditorToolbar = ({ onFormatText }) => {
  const [showAllTools, setShowAllTools] = useState(false);
  const [showFontFamilyMenu, setShowFontFamilyMenu] = useState(false); // Renamed from showFontMenu
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false); // New state for font size menu
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");

  // Refs for dropdowns and their toggle buttons
  const fontFamilyMenuRef = useRef(null); // Renamed
  const fontFamilyButtonRef = useRef(null); // Renamed
  const fontSizeMenuRef = useRef(null); // New ref
  const fontSizeButtonRef = useRef(null); // New ref
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
      // Close font family menu if click is outside
      if (
        showFontFamilyMenu &&
        fontFamilyMenuRef.current &&
        fontFamilyButtonRef.current &&
        !fontFamilyMenuRef.current.contains(event.target) &&
        !fontFamilyButtonRef.current.contains(event.target)
      ) {
        setShowFontFamilyMenu(false);
      }

      // Close font size menu if click is outside
      if (
        showFontSizeMenu &&
        fontSizeMenuRef.current &&
        fontSizeButtonRef.current &&
        !fontSizeMenuRef.current.contains(event.target) &&
        !fontSizeButtonRef.current.contains(event.target)
      ) {
        setShowFontSizeMenu(false);
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
  }, [showFontFamilyMenu, showFontSizeMenu, showHeadingMenu]); // Updated dependencies

  const handleFormat = (formatType, value = null) => {
    onFormatText(formatType, value);
    // Close menus after selection (existing code)
    if (formatType === "fontFamily") {
      setShowFontFamilyMenu(false);
    }
    if (formatType === "fontSize") {
      setShowFontSizeMenu(false);
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

  // Primary tools definition with separate font family and font size
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

      {/* Font Family dropdown - Use BookText icon */}
      <div className="toolbar-dropdown">
        <button
          ref={fontFamilyButtonRef}
          className="toolbar-button dropdown-toggle"
          onClick={(e) => {
            e.stopPropagation();
            console.log(
              "Font Family button clicked, showing:",
              !showFontFamilyMenu
            );

            // Toggle state first
            const newState = !showFontFamilyMenu;
            setShowFontFamilyMenu(newState);
            setShowFontSizeMenu(false); // Close other menus
            setShowHeadingMenu(false);

            // Position the menu AFTER updating state
            if (newState && fontFamilyButtonRef.current) {
              const rect = fontFamilyButtonRef.current.getBoundingClientRect();

              // Slight delay to ensure the menu exists in the DOM
              setTimeout(() => {
                if (fontFamilyMenuRef.current) {
                  fontFamilyMenuRef.current.style.left = `${rect.left}px`;
                  fontFamilyMenuRef.current.style.top = `${rect.top - 220}px`; // Position above button

                  // Check if menu would go off screen at top
                  const menuRect =
                    fontFamilyMenuRef.current.getBoundingClientRect();
                  if (menuRect.top < 10) {
                    // Position below the button instead
                    fontFamilyMenuRef.current.style.top = `${
                      rect.bottom + 5
                    }px`;
                  }
                }
              }, 0);
            }
          }}
          title="Font Family"
        >
          <BookText size={18} /> {/* Using BookText for font family */}
          <ChevronDown size={14} />
        </button>
        {showFontFamilyMenu && (
          <div
            ref={fontFamilyMenuRef}
            className="dropdown-menu"
            style={{ border: "2px solid green" }}
          >
            {console.log("Rendering font family menu")}
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
          </div>
        )}
      </div>

      {/* Font Size dropdown - Keep Type icon */}
      <div className="toolbar-dropdown">
        <button
          ref={fontSizeButtonRef}
          className="toolbar-button dropdown-toggle"
          onClick={(e) => {
            e.stopPropagation();
            console.log(
              "Font Size button clicked, showing:",
              !showFontSizeMenu
            );

            // Toggle state first
            const newState = !showFontSizeMenu;
            setShowFontSizeMenu(newState);
            setShowFontFamilyMenu(false); // Close other menus
            setShowHeadingMenu(false);

            // Position the menu AFTER updating state
            if (newState && fontSizeButtonRef.current) {
              const rect = fontSizeButtonRef.current.getBoundingClientRect();

              // Slight delay to ensure the menu exists in the DOM
              setTimeout(() => {
                if (fontSizeMenuRef.current) {
                  fontSizeMenuRef.current.style.left = `${rect.left}px`;
                  fontSizeMenuRef.current.style.top = `${rect.top - 180}px`; // Position above button

                  // Check if menu would go off screen at top
                  const menuRect =
                    fontSizeMenuRef.current.getBoundingClientRect();
                  if (menuRect.top < 10) {
                    // Position below the button instead
                    fontSizeMenuRef.current.style.top = `${rect.bottom + 5}px`;
                  }
                }
              }, 0);
            }
          }}
          title="Font Size"
        >
          <Type size={18} /> {/* Keep the Type icon for font size */}
          <ChevronDown size={14} />
        </button>
        {showFontSizeMenu && (
          <div
            ref={fontSizeMenuRef}
            className="dropdown-menu"
            style={{ border: "2px solid blue" }}
          >
            {console.log("Rendering font size menu")}
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

      {/* Color pickers - No changes needed */}
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

            // Toggle state first
            const newState = !showHeadingMenu;
            setShowHeadingMenu(newState);
            setShowFontFamilyMenu(false); // Close other menu
            setShowFontSizeMenu(false); // Close other menu

            // Position the menu AFTER updating state
            if (newState && headingButtonRef.current) {
              const rect = headingButtonRef.current.getBoundingClientRect();

              // Slight delay to ensure the menu exists in the DOM
              setTimeout(() => {
                if (headingMenuRef.current) {
                  headingMenuRef.current.style.left = `${rect.left}px`;
                  headingMenuRef.current.style.top = `${rect.top - 150}px`; // Position above button

                  // Check if menu would go off screen at top
                  const menuRect =
                    headingMenuRef.current.getBoundingClientRect();
                  if (menuRect.top < 10) {
                    // Position below the button instead
                    headingMenuRef.current.style.top = `${rect.bottom + 5}px`;
                  }
                }
              }, 0);
            }
          }}
          title="Headings"
        >
          <Heading1 size={18} />
          <ChevronDown size={14} />
        </button>
        {showHeadingMenu && (
          <div
            ref={headingMenuRef}
            className="dropdown-menu heading-menu"
            style={{ border: "2px solid blue" }}
          >
            {console.log("Rendering heading menu")} {/* Assign ref */}
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

  // Main return statement - unchanged
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
