import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
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
  const { isSidebarOpen } = useSidebar();

  const API_BASE_URL = "https://new-bytes-notes-backend.onrender.com";
  const token = localStorage.getItem("token");

  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

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
        const response = await api.get("/notes", { params: queryParams });
        setNotes(sortNotes(response.data.notes));
        setLastQuery({ type: queryType, params: queryParams });
      } catch (error) {
        setError("Error fetching notes");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    },
    [api]
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
      const response = await api.post("/notes", {
        title: "Untitled Note",
        content: "",
      });
      const newNote = response.data.note;

      // If we're in a filtered view, fetch all notes
      if (lastQuery.type !== "all") {
        await fetchNotes();
      } else {
        setNotes((prev) => sortNotes([newNote, ...prev]));
      }

      setActiveNote(newNote);
    } catch (error) {
      setError("Error creating note");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateNote = async (id, updates) => {
    try {
      const response = await api.put(`/notes/${id}`, updates);
      const updatedNote = response.data.note;
      setNotes((prev) => {
        const updatedNotes = prev.map((note) =>
          note._id === id ? updatedNote : note
        );
        return sortNotes(updatedNotes);
      });
      setActiveNote(updatedNote);
    } catch (error) {
      setError("Error updating note");
      console.error(error);
    }
  };

  const handleDeleteNote = async (id) => {
    setIsLoading(true);
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((note) => note._id !== id));
      if (activeNote?._id === id) {
        setActiveNote(null);
      }
    } catch (error) {
      setError("Error deleting note");
      console.error(error);
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
