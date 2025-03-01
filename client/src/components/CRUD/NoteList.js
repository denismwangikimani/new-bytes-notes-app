import React, { useState } from "react";
import NoteItem from "./NoteItem";
import CreateNoteButton from "./CreateNoteButton";
import { SidebarToggle } from "./SidebarToggle";
import { useSidebar } from "./SidebarContext";
import "./notes.css";

const NotesList = ({
  notes,
  activeNote,
  onNoteSelect,
  onDeleteNote,
  onCreate,
  onSearch,
  onFilter,
  isLoading,
}) => {
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const { isSidebarOpen, toggleSidebar } = useSidebar();

  const handleSearch = () => {
    if (isLoading) return;
    onSearch(searchText);
  };

  const handleFilter = () => {
    if (isLoading) return;
    onFilter(filterDate);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleFilterKeyPress = (e) => {
    if (e.key === "Enter") {
      handleFilter();
    }
  };

  const handleSearchClear = () => {
    setSearchText("");
    onSearch("");
  };

  const handleFilterClear = () => {
    setFilterDate("");
    onFilter("");
  };

  // Handle note selection and close sidebar on mobile
  const handleNoteSelect = (note) => {
    onNoteSelect(note);
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  };

  return (
    <div className={`notes-sidebar ${isSidebarOpen ? "open" : "hidden"}`}>
      <div className="sidebar-header">
        <CreateNoteButton onCreate={onCreate} />
        <SidebarToggle />
      </div>

      <div className="search-container">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyPress={handleSearchKeyPress}
          placeholder="Search notes..."
          disabled={isLoading}
        />
        {searchText && (
          <button
            onClick={handleSearchClear}
            className="clear-button"
            disabled={isLoading}
          >
            ×
          </button>
        )}
        <button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="filter-container">
        <label htmlFor="filterDate">Filter by Created Date:</label>
        <input
          type="date"
          id="filterDate"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          onKeyPress={handleFilterKeyPress}
          disabled={isLoading}
        />
        {filterDate && (
          <button
            onClick={handleFilterClear}
            className="clear-button"
            disabled={isLoading}
          >
            ×
          </button>
        )}
        <button onClick={handleFilter} disabled={isLoading}>
          {isLoading ? "Filtering..." : "Filter"}
        </button>
      </div>

      <div className="notes-list">
        {notes.map((note) => (
          <NoteItem
            key={note._id}
            note={note}
            isActive={activeNote?._id === note._id}
            onSelect={() => handleNoteSelect(note)}
            onDelete={() => onDeleteNote(note._id)}
          />
        ))}
      </div>
    </div>
  );
};

export default NotesList;
