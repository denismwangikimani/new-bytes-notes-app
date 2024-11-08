import React from "react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

function LandingPage() {
  return (
    <div className="landing-container">
      <nav className="landing-nav">
        <div className="nav-left">
          <h1>BYTE-NOTES</h1>
        </div>
        <div className="nav-right">
          <Link to="/signup">
            <button className="signup-button">SIGNUP</button>
          </Link>
          <Link to="/login">
            <button className="login-button">LOGIN</button>
          </Link>
        </div>
      </nav>

      <main className="landing-main">
        <h1>Welcome to Your Digital Notebook</h1>
        <h2>
          Sync your notes across all your devices and never lose a thought
          again.
        </h2>
        <p>Simplify your life, one note at a time.</p>
        <img
          src="appscreenshot.png"
          alt="Notes App Screenshot"
          className="app-screenshot"
        />
      </main>
    </div>
  );
}

export default LandingPage;
