import React, { useState } from "react";
import { MoreHorizontal, FolderSymlink } from "lucide-react";
import NoteActions from "./NoteActions";
import "./notes.css";

const NoteItem = ({
  note,
  isActive,
  onSelect,
  onDelete,
  onMove,
  groups = [],
  inGroup = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const truncateTitle = (title) => {
    const words = title.split(" ");
    if (words.length > 6) {
      return words.slice(0, 6).join(" ") + "...";
    }
    return title;
  };

  return (
    <div
      className={`note-item ${isActive ? "active" : ""} ${
        inGroup ? "in-group" : ""
      }`}
      onClick={onSelect}
    >
      <div className="note-item-header">
        <h3 className="note-title" title={note.title}>
          {truncateTitle(note.title)}
        </h3>
        <div className="note-actions-container">
          {!inGroup && onMove && (
            <button
              className="move-button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMoveMenu(!showMoveMenu);
                setShowMenu(false);
              }}
              title="Move to group"
            >
              <FolderSymlink size={16} />
            </button>
          )}
          <button
            className="menu-button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
              setShowMoveMenu(false);
            }}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {showMoveMenu && (
        <div className="move-menu">
          <div className="move-menu-header">Move to:</div>
          {groups.map((group) => (
            <div
              key={group._id}
              className="move-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                onMove(group._id);
                setShowMoveMenu(false);
              }}
            >
              {group.name}
            </div>
          ))}
        </div>
      )}

      <NoteActions
        isVisible={showMenu}
        onDelete={onDelete}
        onClose={() => setShowMenu(false)}
      />
    </div>
  );
};

export default NoteItem;
