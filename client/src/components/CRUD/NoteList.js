import React, { useState } from "react";
import NoteItem from "./NoteItem";
import CreateNoteButton from "./CreateNoteButton";
import "./notes.css";

const NotesList = ({
  notes,
  activeNote,
  onNoteSelect,
  onDeleteNote,
  onCreate,
  onSearch,
  onFilter,
}) => {
  const [searchText, setSearchText] = useState("");
  const [createdAtStart, setCreatedAtStart] = useState("");
  const [createdAtEnd, setCreatedAtEnd] = useState("");
  const [updatedAtStart, setUpdatedAtStart] = useState("");
  const [updatedAtEnd, setUpdatedAtEnd] = useState("");

  const handleSearch = () => {
    onSearch(searchText);
  };

  const handleFilter = () => {
    onFilter({
      createdAtStart,
      createdAtEnd,
      updatedAtStart,
      updatedAtEnd,
    });
  };

  return (
    <div className="notes-sidebar">
      <CreateNoteButton onCreate={onCreate} />
      <div className="search-container">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search notes..."
        />
        <button onClick={handleSearch}>Search</button>
      </div>
      <div className="filter-container">
        <label htmlFor="createdAtStart">Created At Start:</label>
        <input
          type="date"
          id="createdAtStart"
          value={createdAtStart}
          onChange={(e) => setCreatedAtStart(e.target.value)}
        />
        <label htmlFor="createdAtEnd">Created At End:</label>
        <input
          type="date"
          id="createdAtEnd"
          value={createdAtEnd}
          onChange={(e) => setCreatedAtEnd(e.target.value)}
        />
        <label htmlFor="updatedAtStart">Updated At Start:</label>
        <input
          type="date"
          id="updatedAtStart"
          value={updatedAtStart}
          onChange={(e) => setUpdatedAtStart(e.target.value)}
        />
        <label htmlFor="updatedAtEnd">Updated At End:</label>
        <input
          type="date"
          id="updatedAtEnd"
          value={updatedAtEnd}
          onChange={(e) => setUpdatedAtEnd(e.target.value)}
        />
        <button onClick={handleFilter}>Filter</button>
      </div>
      <div className="notes-list">
        {notes.map((note) => (
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
