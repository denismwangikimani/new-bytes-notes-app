import React from "react";
import NoteItem from "./NoteItem";
import CreateNoteButton from "./CreateNoteButton";
import "./notes.css";

const NotesList = ({ notes, activeNote, onNoteSelect, onDeleteNote, onCreate }) => {
  return (
    <div className="notes-sidebar">
      <CreateNoteButton onCreate={onCreate} />
      <div className="notes-list">
        {notes.map(note => (
          <NoteItem
            key={note._id}
            note={note}
            isActive={activeNote?._id === note._id}
            onSelect={() => onNoteSelect(note)}
            onDelete={() => onDeleteNote(note._id)}
          />
        ))}
      </div>
    </div>
  );
};

export default NotesList;
