import React from "react";
import { PenSquare } from "lucide-react";
import "./notes.css";

const CreateNoteButton = ({ onCreate }) => {
  const handleCreate = () => {
    // Directly call onCreate without prompting for title
    onCreate();
  };

  return (
    <button onClick={handleCreate} className="create-button">
      <PenSquare size={20} />
      <span>Create</span>
    </button>
  );
};

export default CreateNoteButton;
