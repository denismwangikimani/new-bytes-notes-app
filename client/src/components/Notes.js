import React, { useEffect, useState } from "react";
import axios from "axios";
import NotesList from "./CRUD/NoteList";
import NoteEditor from "./CRUD/NoteEditor";
import "./CRUD/notes.css";

function Notes() {
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  const [error, setError] = useState(null);

  const API_BASE_URL = "https://bytenotesapp-797ceffec255.herokuapp.com";
  const token = localStorage.getItem("token");

  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

  // Helper function to sort notes by most recent
  const sortNotes = (notesArray) => {
    return [...notesArray].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt);
      const dateB = new Date(b.updatedAt || b.createdAt);
      return dateB - dateA;
    });
  };

  const handleCreateNote = async () => {
    try {
      const response = await api.post("/notes", {
        title: "Untitled Note",
        content: "",
      });
      const newNote = response.data.note;
      // Add the new note and sort the array
      setNotes((prev) => sortNotes([newNote, ...prev]));
      setActiveNote(newNote);
    } catch (error) {
      setError("Error creating note");
      console.error(error);
    }
  };

  const handleUpdateNote = async (id, updates) => {
    try {
      const response = await api.put(`/notes/${id}`, updates);
      const updatedNote = response.data.note;
      setNotes((prev) => {
        // Create new array with the updated note
        const updatedNotes = prev.map((note) =>
          note._id === id ? updatedNote : note
        );
        // Sort the array to ensure updated note moves to top
        return sortNotes(updatedNotes);
      });
      setActiveNote(updatedNote);
    } catch (error) {
      setError("Error updating note");
      console.error(error);
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((note) => note._id !== id));
      if (activeNote?._id === id) {
        setActiveNote(null);
      }
    } catch (error) {
      setError("Error deleting note");
      console.error(error);
    }
  };

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await api.get("/notes");
        // Sort notes when initially fetching
        setNotes(sortNotes(response.data.notes));
      } catch (error) {
        setError("Error fetching notes");
        console.error(error);
      }
    };

    fetchNotes();
  }, [api]);

  return (
    <div className="notes-container">
      <NotesList
        notes={notes}
        activeNote={activeNote}
        onNoteSelect={setActiveNote}
        onDeleteNote={handleDeleteNote}
        onCreate={handleCreateNote}
      />
      {activeNote ? (
        <NoteEditor note={activeNote} onUpdate={handleUpdateNote} />
      ) : (
        <div className="empty-state">Select a note or create a new one</div>
      )}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

export default Notes;
