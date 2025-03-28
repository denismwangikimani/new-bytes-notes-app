import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "../App.css";

function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First register the user
      await axios.post(
        "https://new-bytes-notes-backend.onrender.com/register",
        {
          email,
          username,
          password,
        }
      );

      // Then immediately log them in to get a token
      const loginResponse = await axios.post(
        "https://new-bytes-notes-backend.onrender.com/login",
        {
          email,
          password,
        }
      );

      // Store the token in localStorage
      localStorage.setItem("token", loginResponse.data.token);

      // Now navigate to notes with a valid token
      navigate("/notes");
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.message);
      } else {
        setError("Signup failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>Welcome to Byte-Notes!</h2>
      <p>
        We are excited to have you here. Please signup below and let's make
        note-taking enjoyable.
      </p>
      <form onSubmit={handleSignup} className="auth-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          disabled={isLoading}
        />
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
          disabled={isLoading}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Signing up..." : "Sign Up"}
        </button>
        {error && <p className="error-message">{error}</p>}
        <p>
          If you already have an account, <Link to="/login">Login here</Link>
        </p>
      </form>
    </div>
  );
}

export default Signup;
