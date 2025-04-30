import React, { useState, useEffect } from "react";
import NoteItem from "./NoteItem";
import CreateNoteButton from "./CreateNoteButton";
import { SidebarToggle } from "./SidebarToggle";
import { useSidebar } from "./SidebarContext";
import { ChevronDown, ChevronRight, FolderPlus, X } from "lucide-react";
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
  groups = [], // New prop for groups
  onCreateGroup, // New prop for creating groups
  onDeleteGroup, // New prop for deleting groups
  onMoveNote, // New prop for moving notes between groups
}) => {
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  const [expandedGroups, setExpandedGroups] = useState({});
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Initialize all groups as expanded
  useEffect(() => {
    const initialExpanded = {};
    groups.forEach((group) => {
      initialExpanded[group._id] = true;
    });
    setExpandedGroups(initialExpanded);
  }, [groups]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Handle search and filter functions - existing code remains...
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

  // New group management functions
  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      onCreateGroup({ name: newGroupName.trim() });
      setNewGroupName("");
      setIsCreatingGroup(false);
    }
  };

  const handleGroupNameKeyPress = (e) => {
    if (e.key === "Enter") {
      handleCreateGroup();
    }
  };

  // Group notes by their groupId
  const organizeNotesByGroup = () => {
    const ungroupedNotes = notes.filter((note) => !note.groupId);
    const groupedNotes = {};

    groups.forEach((group) => {
      groupedNotes[group._id] = notes.filter(
        (note) => note.groupId === group._id
      );
    });

    return { ungroupedNotes, groupedNotes };
  };

  const { ungroupedNotes, groupedNotes } = organizeNotesByGroup();

  return (
    <div className={`notes-sidebar ${isSidebarOpen ? "open" : "hidden"}`}>
      <div className="sidebar-header">
        <CreateNoteButton onCreate={onCreate} />
        <SidebarToggle />
      </div>

      {/* Search & Filter sections remain unchanged */}
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

      {/* New section for group management */}
      <div className="groups-header">
        <span>Groups</span>
        <button
          className="create-group-button"
          onClick={() => setIsCreatingGroup(!isCreatingGroup)}
          title="Create new group"
        >
          <FolderPlus size={16} />
        </button>
      </div>

      {isCreatingGroup && (
        <div className="create-group-container">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyPress={handleGroupNameKeyPress}
            placeholder="Group name..."
            className="create-group-input"
          />
          <button
            onClick={handleCreateGroup}
            className="create-group-submit"
            disabled={!newGroupName.trim()}
          >
            Add
          </button>
          <button
            onClick={() => setIsCreatingGroup(false)}
            className="create-group-cancel"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Notes listing with groups */}
      <div className="notes-list">
        {/* Display groups and their notes */}
        {groups.map((group) => (
          <div key={group._id} className="note-group">
            <div
              className="group-header"
              onClick={() => toggleGroup(group._id)}
            >
              {expandedGroups[group._id] ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              <span className="group-name">{group.name}</span>
              <button
                className="delete-group-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteGroup(group._id);
                }}
                title="Delete group"
              >
                <X size={14} />
              </button>
            </div>

            {expandedGroups[group._id] &&
              groupedNotes[group._id]?.map((note) => (
                <NoteItem
                  key={note._id}
                  note={note}
                  isActive={activeNote?._id === note._id}
                  onSelect={() => handleNoteSelect(note)}
                  onDelete={() => onDeleteNote(note._id)}
                  inGroup={true}
                />
              ))}
          </div>
        ))}

        {/* Ungrouped notes section */}
        <div className="ungrouped-notes-header">
          <span>Ungrouped Notes</span>
        </div>
        {ungroupedNotes.map((note) => (
          <NoteItem
            key={note._id}
            note={note}
            isActive={activeNote?._id === note._id}
            onSelect={() => handleNoteSelect(note)}
            onDelete={() => onDeleteNote(note._id)}
            onMove={(groupId) => onMoveNote(note._id, groupId)}
            groups={groups}
          />
        ))}
      </div>
    </div>
  );
};

export default NotesList;
