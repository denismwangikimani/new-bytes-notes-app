import React from "react";
import { PenSquare } from "lucide-react";
import "./notes.css";

const CreateNoteButton = ({ onCreate }) => {
  const handleCreate = async () => {
    const title = prompt("Enter note title:");
    if (title) {
      onCreate(title);
    }
  };

  return (
    <button onClick={handleCreate} className="create-button">
      <PenSquare size={20} />
      <span>New Note</span>
    </button>
  );
};

export default CreateNoteButton;
