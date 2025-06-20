/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import NotesList from "./CRUD/NoteList";
import NoteEditor from "./CRUD/NoteEditor";
import EditorHeader from "./CRUD/EditorHeader";
import { SidebarProvider, useSidebar } from "./CRUD/SidebarContext";
import "./CRUD/notes.css";

const NotesContent = () => {
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState({ type: "all", params: null });
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  const [groups, setGroups] = useState([]);

  const navigate = useNavigate();

  const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    "https://new-bytes-notes-backend.onrender.com";
  //const token = localStorage.getItem("token");

  // Create a function to get a fresh API instance with the current token
  const getApi = useCallback(() => {
    const currentToken = localStorage.getItem("token");

    if (!currentToken) {
      console.log("No token found, redirecting to login");
      navigate("/login");
      return null;
    }

    const api = axios.create({
      baseURL: API_BASE_URL,
      headers: { Authorization: `Bearer ${currentToken}` },
    });

    // Add response interceptor to handle 401 errors globally
    api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // Clear invalid token and redirect to login
          localStorage.removeItem("token");
          navigate("/login");
          return Promise.reject(
            new Error("Authentication expired. Please log in again.")
          );
        }
        return Promise.reject(error);
      }
    );

    return api;
  }, [navigate, API_BASE_URL]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("Current token:", token ? "exists" : "missing");
  }, []);

  // Add functions to fetch, create, delete groups and move notes
  const fetchGroups = useCallback(async () => {
    try {
      const api = getApi();
      if (!api) return;

      const response = await api.get("/groups");
      if (response.data.groups) {
        setGroups(response.data.groups);
      }
    } catch (error) {
      setError("Error fetching groups");
      console.error("Fetch groups error:", error);
    }
  }, [getApi]);

  // Create a new group
  const handleCreateGroup = async (groupData) => {
    try {
      const api = getApi();
      if (!api) return;

      const response = await api.post("/groups", groupData);
      const newGroup = response.data.group;

      setGroups((prev) => [...prev, newGroup]);
    } catch (error) {
      setError("Error creating group");
      console.error("Create group error:", error);
    }
  };

  // Delete a group
  const handleDeleteGroup = async (groupId) => {
    try {
      const api = getApi();
      if (!api) return;

      await api.delete(`/groups/${groupId}`);

      // Remove group from list
      setGroups((prev) => prev.filter((group) => group._id !== groupId));

      // Update notes that were in this group to be ungrouped
      setNotes((prev) =>
        prev.map((note) =>
          note.groupId === groupId ? { ...note, groupId: null } : note
        )
      );
    } catch (error) {
      setError("Error deleting group");
      console.error("Delete group error:", error);
    }
  };

  // Move a note to a group
  const handleMoveNote = async (noteId, groupId) => {
    try {
      const api = getApi();
      if (!api) return;

      const response = await api.put(`/notes/${noteId}/move`, { groupId });
      const updatedNote = response.data.note;

      setNotes((prev) =>
        prev.map((note) => (note._id === noteId ? updatedNote : note))
      );

      if (activeNote?._id === noteId) {
        setActiveNote(updatedNote);
      }
    } catch (error) {
      setError("Error moving note");
      console.error("Move note error:", error);
    }
  };

  // Fetch groups when component mounts
  useEffect(() => {
    fetchNotes();
    fetchGroups();
  }, []);

  const sortNotes = (notesArray) => {
    return [...notesArray].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt);
      const dateB = new Date(b.updatedAt || b.createdAt);
      return dateB - dateA;
    });
  };

  const fetchNotes = useCallback(
    async (queryType = "all", queryParams = null) => {
      setIsLoading(true);
      try {
        const api = getApi();
        if (!api) return; // Exit if no valid API instance

        const response = await api.get("/notes", { params: queryParams });

        // Check if notes is defined before sorting
        if (response.data.notes) {
          setNotes(sortNotes(response.data.notes));
        } else {
          // Handle the case when there are no notes
          setNotes([]);
        }

        setLastQuery({ type: queryType, params: queryParams });
        // Clear any previous errors on successful fetch
        setError(null);
      } catch (error) {
        setError(error.message || "Error fetching notes");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    },
    [getApi, sortNotes]
  );

  const handleSearch = async (searchText) => {
    if (!searchText.trim()) {
      fetchNotes();
      return;
    }
    fetchNotes("search", { search: searchText });
  };

  const handleFilter = async (filterDate) => {
    if (!filterDate) {
      fetchNotes();
      return;
    }

    const startDate = new Date(filterDate);
    const endDate = new Date(filterDate);
    endDate.setHours(23, 59, 59, 999);

    fetchNotes("filter", {
      createdAtStart: startDate.toISOString(),
      createdAtEnd: endDate.toISOString(),
    });
  };

  const handleCreateNote = async () => {
    setIsLoading(true);
    try {
      const api = getApi();
      if (!api) return;

      const response = await api.post("/notes", {
        title: "Untitled Note",
        content: "",
      });

      const newNote = response.data.note;

      if (lastQuery.type !== "all") {
        await fetchNotes();
      } else {
        setNotes((prev) => sortNotes([newNote, ...prev]));
      }

      setActiveNote(newNote);
      setError(null);

      // Add this check to close sidebar on mobile if it's open
      if (window.innerWidth <= 768) {
        if (isSidebarOpen) {
          // Only toggle if the sidebar is currently open
          toggleSidebar();
        }
      }
    } catch (error) {
      setError(error.message || "Error creating note");
      console.error("Create note error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateNote = async (id, updates) => {
    try {
      const api = getApi();
      if (!api) return; // Exit if no valid API instance

      const response = await api.put(`/notes/${id}`, updates);
      const updatedNote = response.data.note;

      setNotes((prev) => {
        const updatedNotes = prev.map((note) =>
          note._id === id ? updatedNote : note
        );
        return sortNotes(updatedNotes);
      });

      setActiveNote(updatedNote);
      // Clear any previous errors on successful update
      setError(null);
    } catch (error) {
      setError("Error updating note");
      console.error("Update note error:", error);
    }
  };

  const handleDeleteNote = async (id) => {
    setIsLoading(true);
    try {
      const api = getApi();
      if (!api) return; // Exit if no valid API instance

      await api.delete(`/notes/${id}`);

      setNotes((prev) => prev.filter((note) => note._id !== id));
      if (activeNote?._id === id) {
        setActiveNote(null);
      }
      // Clear any previous errors on successful delete
      setError(null);
    } catch (error) {
      setError("Error deleting note");
      console.error("Delete note error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  return (
    <div className="notes-container">
      <NotesList
        notes={notes}
        activeNote={activeNote}
        onNoteSelect={setActiveNote}
        onDeleteNote={handleDeleteNote}
        onCreate={handleCreateNote}
        onSearch={handleSearch}
        onFilter={handleFilter}
        isLoading={isLoading}
        groups={groups}
        onCreateGroup={handleCreateGroup}
        onDeleteGroup={handleDeleteGroup}
        onMoveNote={handleMoveNote}
      />
      {activeNote ? (
        <NoteEditor
          note={activeNote}
          onUpdate={handleUpdateNote}
          onCreate={handleCreateNote}
        />
      ) : (
        <div
          className={`editor-container ${!isSidebarOpen ? "full-width" : ""}`}
        >
          <EditorHeader onCreate={handleCreateNote} />
          <div className="empty-state-content">
            Select a note or create a new one
          </div>
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

// Main Notes component wrapped with Provider
function Notes() {
  return (
    <SidebarProvider>
      <NotesContent />
    </SidebarProvider>
  );
}

export default Notes;
