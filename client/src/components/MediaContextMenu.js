import React from "react";
import { Trash, Replace } from "lucide-react";
import "./MediaContextMenu.css";

const MediaContextMenu = ({ position, onDelete, onReplace, onClose }) => {
  if (!position) return null;

  return (
    <div
      className="media-context-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button className="context-menu-item" onClick={onReplace}>
        <Replace size={16} />
        <span>Replace</span>
      </button>
      <button className="context-menu-item" onClick={onDelete}>
        <Trash size={16} />
        <span>Delete</span>
      </button>
    </div>
  );
};

export default MediaContextMenu;
