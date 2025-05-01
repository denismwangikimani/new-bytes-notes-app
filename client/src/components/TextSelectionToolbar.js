import React from "react";
import "./TextSelectionToolbar.css";

const TextSelectionToolbar = ({ position, onOption }) => {
  if (!position) return null;

  const { x, y } = position;

  // This function receives the option and calls the prop passed from NoteEditor
  const handleOptionClick = (option) => {
    console.log(
      `%c[Toolbar DEBUG] Button clicked: ${option}. Calling onOption prop.`,
      "color: orange;"
    );
    if (typeof onOption === "function") {
      onOption(option); // This should trigger handleTransformOption in NoteEditor
    } else {
      console.error("[Toolbar DEBUG] onOption prop is not a function!");
    }
  };

  return (
    <div
      className="text-selection-toolbar"
      style={{
        top: `${y - 45}px`,
        left: `${x - 100}px`,
      }}
      //check to prevent clicks outside buttons closing the toolbar too early
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Ensure onClick calls handleOptionClick */}
      <button className="ai-button" onClick={() => handleOptionClick("askAI")}>
        Ask AI
      </button>
      <button onClick={() => handleOptionClick("explain")}>Explain</button>
      <button onClick={() => handleOptionClick("summarize")}>Summarize</button>
      <button onClick={() => handleOptionClick("shorten")}>Shorten</button>
      <button onClick={() => handleOptionClick("expand")}>Expand</button>
    </div>
  );
};

export default TextSelectionToolbar;
