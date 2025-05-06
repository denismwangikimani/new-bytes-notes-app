import React from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Cpu,
  Cloud,
  CreditCard,
  CheckCircle,
  BookOpen,
  Headphones,
  Users,
  Image,
} from "lucide-react";
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
            <button className="try-now-button">TRY NOW</button>
          </Link>
          <Link to="/login">
            <button className="login-button">LOGIN</button>
          </Link>
        </div>
      </nav>

      <main className="landing-main">
        <div className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">NOTE TAKING,</h1>
            <h1 className="hero-title">MADE SIMPLE</h1>
            <h2 className="hero-subtitle">USE AI TO LEARN FASTER</h2>
            <p className="hero-description">
              A powerful note-taking app with AI capabilities to help you
              organize, understand, and remember information better.
            </p>
            <Link to="/signup">
              <button className="cta-button">GET STARTED</button>
            </Link>
          </div>
          <div className="hero-image">
            <img src="/notepad-illustration.png" alt="AI Enhanced Notes" />
          </div>
        </div>

        <div className="features-section">
          <h2>Everything You Need In One Place</h2>
          <div className="features-grid">
            <div className="feature-card">
              <FileText size={32} />
              <h3>Smart Note Taking</h3>
              <p>
                Create, edit, and organize your notes with powerful formatting
                tools.
              </p>
            </div>
            <div className="feature-card">
              <Cpu size={32} />
              <h3>AI-Powered</h3>
              <p>
                Use AI to summarize, explain, and transform your content
                instantly.
              </p>
            </div>
            <div className="feature-card">
              <Cloud size={32} />
              <h3>Always In Sync</h3>
              <p>
                Access your notes from any device with automatic
                synchronization.
              </p>
            </div>
            <div className="feature-card">
              <BookOpen size={32} />
              <h3>Learn Effectively</h3>
              <p>Generate flashcards and practice with AI-created questions.</p>
            </div>
          </div>
        </div>

        <div className="pricing-section">
          <div className="pricing-card">
            <div className="pricing-header">
              <h3>One-Time Payment</h3>
              <div className="price">
                <span className="dollar">$</span>
                <span className="amount">18</span>
                <span className="period">forever</span>
              </div>
            </div>
            <div className="pricing-features">
              <div className="feature">
                <CheckCircle size={20} />
                <span>Create Unlimited Notes</span>
              </div>
              <div className="feature">
                <Cloud size={20} />
                <span>Synchronized Notes</span>
              </div>
              <div className="feature">
                <Cpu size={20} />
                <span>AI Features (Ask, Explain, Summarize)</span>
              </div>
              <div className="feature">
                <BookOpen size={20} />
                <span>Flashcard AI Questions</span>
              </div>
              <div className="feature">
                <Headphones size={20} />
                <span>Audio Overview</span>
              </div>
              <div className="feature">
                <Image size={20} />
                <span>Upload Files, Images, Videos</span>
              </div>
              <div className="feature">
                <Users size={20} />
                <span>Group Notes Together</span>
              </div>
              <div className="feature">
                <FileText size={20} />
                <span>AI Document Analysis</span>
              </div>
            </div>
            <Link to="/signup">
              <button className="purchase-button">
                <CreditCard size={18} />
                <span>Subscribe Now</span>
              </button>
            </Link>
          </div>
        </div>
        
      </main>

      <footer className="landing-footer">
        <p>© 2025 Byte-Notes. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default LandingPage;
