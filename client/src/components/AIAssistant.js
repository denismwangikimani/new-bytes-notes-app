import React, { useState, useRef, useEffect } from "react";
import "./AIAssistant.css";

const AIAssistant = ({ onActivateText, onActivateRevision }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showMenu &&
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  const handleOptionClick = (option) => {
    setShowMenu(false);
    if (option === "text" && onActivateText) {
      onActivateText();
    } else if (option === "revision" && onActivateRevision) {
      onActivateRevision();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        className="ai-assistant-button"
        onClick={toggleMenu}
        aria-label="AI Assistant"
      >
        <span>AI</span>
      </button>

      <div
        ref={menuRef}
        className={`ai-assistant-menu ${showMenu ? "" : "hidden"}`}
      >
        <button onClick={() => handleOptionClick("text")}>
          <i>📝</i> Text Assistant
        </button>
        <button onClick={() => handleOptionClick("revision")}>
          <i>🔄</i> Revision Flashcards
        </button>
      </div>
    </>
  );
};

export default AIAssistant;
