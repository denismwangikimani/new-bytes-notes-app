// filepath: client/src/components/CRUD/NoteList.js
import React, { useState, useEffect } from "react";
import NoteItem from "./NoteItem";
import CreateNoteButton from "./CreateNoteButton";
import { SidebarToggle } from "./SidebarToggle";
import { useSidebar } from "./SidebarContext";
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  X,
  Settings,
} from "lucide-react"; // Import Settings
import { Link } from "react-router-dom"; // Import Link
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
  groups = [],
  onCreateGroup,
  onDeleteGroup,
  onMoveNote,
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

  const handleNoteSelect = (note) => {
    onNoteSelect(note);
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  };

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

  if (!isSidebarOpen && window.innerWidth > 768) {
    return null; // Don't render if sidebar is closed on desktop
  }

  return (
    <div className={`notes-sidebar ${isSidebarOpen ? "open" : "closed"}`}>
      <div className="sidebar-header">
        <SidebarToggle />
        <CreateNoteButton onCreate={onCreate} />
      </div>

      {/* Search and Filter */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyPress={handleSearchKeyPress}
          disabled={isLoading}
        />
        <button onClick={handleSearch} disabled={isLoading}>
          Search
        </button>
        {searchText && (
          <button onClick={handleSearchClear} className="clear-search-btn">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="filter-container">
        <label htmlFor="filter-date">Filter by creation date:</label>
        <input
          type="date"
          id="filter-date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          onKeyPress={handleFilterKeyPress}
          disabled={isLoading}
        />
        <button onClick={handleFilter} disabled={isLoading}>
          Filter
        </button>
        {filterDate && (
          <button onClick={handleFilterClear} className="clear-filter-btn">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Group Creation */}
      <div className="groups-header">
        <span>Groups</span>
        <button
          onClick={() => setIsCreatingGroup(true)}
          className="create-group-button"
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
                  if (
                    window.confirm(
                      "Are you sure you want to delete this group? Notes in this group will become ungrouped."
                    )
                  ) {
                    onDeleteGroup(group._id);
                  }
                }}
                title="Delete group"
              >
                <X size={14} />
              </button>
            </div>
            {expandedGroups[group._id] &&
              (groupedNotes[group._id] || []).map((note) => (
                <NoteItem
                  key={note._id}
                  note={note}
                  isActive={activeNote?._id === note._id}
                  onSelect={() => handleNoteSelect(note)}
                  onDelete={() => onDeleteNote(note._id)}
                  onMove={(groupId) => onMoveNote(note._id, groupId)}
                  groups={groups}
                  isGrouped={true}
                />
              ))}
          </div>
        ))}

        {/* Display ungrouped notes */}
        {ungroupedNotes.length > 0 && (
          <>
            <div className="ungrouped-notes-header">Ungrouped Notes</div>
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
          </>
        )}
      </div>

      {/* Settings Link */}
      <div className="sidebar-footer">
        <Link to="/settings" className="settings-link">
          <Settings size={20} />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );
};

export default NotesList;
