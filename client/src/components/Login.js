import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "../App.css";
import { GoogleLogin } from "@react-oauth/google";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const API_BASE_URL = process.env.REACT_APP_API_URL || "https://new-bytes-notes-backend.onrender.com";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    try {
      const response = await axios.post(
        `${API_BASE_URL}/login`,
        {
          email,
          password,
        }
      );
      console.log("Login response:", response.data);
      localStorage.setItem("token", response.data.token);
      // Optionally store user details from response.data.user if backend sends them
      navigate("/notes");
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.message);
      } else {
        setError("Login failed. Please try again.");
      }
    }
  };

  const handleGoogleLoginSuccess = async (credentialResponse) => {
    setError(null); // Clear previous errors
    console.log("Google login success raw response:", credentialResponse);
    const tokenId = credentialResponse.credential;

    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/google`,
        { tokenId }
      );
      console.log("Backend Google login response:", response.data);
      localStorage.setItem("token", response.data.token);
      // Optionally store user details from response.data.user
      navigate("/notes");
    } catch (err) {
      console.error("Google login backend error:", err);
      if (err.response && err.response.data) {
        setError(err.response.data.message || "Google login failed.");
      } else {
        setError("Google login failed. Please try again.");
      }
    }
  };

  const handleGoogleLoginError = (error) => {
    console.error("Google login failed on client:", error);
    setError(
      "Google login failed. Please try again or ensure cookies are enabled."
    );
  };

  return (
    <div className="auth-container">
      <h2>Welcome back to Byte-Notes</h2>
      <p>We are glad to have you. Please login below to access your notes.</p>
      <form onSubmit={handleLogin} className="auth-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit">Login</button>
        {error && (
          <p style={{ color: "red", textAlign: "center", marginTop: "10px" }}>
            {error}
          </p>
        )}
      </form>
      <div style={{ textAlign: "center", margin: "20px 0", color: "#555" }}>
        OR
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        <GoogleLogin
          onSuccess={handleGoogleLoginSuccess}
          onError={handleGoogleLoginError}
          useOneTap={false} // Can be true for one-tap sign-in experience
          shape="rectangular" // "rectangular", "pill", "circle", "square"
          theme="outline" // "outline", "filled_blue", "filled_black"
          size="large" // "small", "medium", "large"
        />
      </div>
      <p style={{ textAlign: "center" }}>
        If you do not have an account, <Link to="/signup">Signup here</Link>
      </p>
    </div>
  );
}

export default Login;
