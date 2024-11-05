import React, { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import NoteActions from "./NoteActions";
import "./notes.css";

const NoteItem = ({ note, isActive, onSelect, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);

  const truncateTitle = (title) => {
    const words = title.split(" ");
    if (words.length > 6) {
      return words.slice(0, 6).join(" ") + "...";
    }
    return title;
  };

  return (
    <div className={`note-item ${isActive ? "active" : ""}`} onClick={onSelect}>
      <div className="note-item-header">
        <h3 className="note-title" title={note.title}>
          {truncateTitle(note.title)}
        </h3>
        <button
          className="menu-button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      <NoteActions
        isVisible={showMenu}
        onDelete={onDelete}
        onClose={() => setShowMenu(false)}
      />
    </div>
  );
};

export default NoteItem;
