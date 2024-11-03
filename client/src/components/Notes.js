import React, { useEffect, useState } from "react";
import axios from "axios";

function Notes() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          "https://bytenotesapp-797ceffec255.herokuapp.com/notes",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setMessage(response.data.message);
      } catch (error) {
        console.error("Error fetching notes", error);
      }
    };

    fetchNotes();
  }, []);

  return <h1>{message || "Hey, welcome to your notes app!"}</h1>;
}

export default Notes;
