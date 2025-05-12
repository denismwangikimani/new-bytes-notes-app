import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./components/Login";
import Signup from "./components/Signup";
import Notes from "./components/Notes";
import LandingPage from "./components/LandingPage";
import ProtectedRoute from "./components/ProtectedRoute";
import PaymentConfirmation from "./components/PaymentConfirmation";
import SettingsPage from "./components/SettingsPage";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID ||
  "252353892449-b68ecorocpbcbd5ghvok4goblmil5314.apps.googleusercontent.com";

function App() {
  if (!GOOGLE_CLIENT_ID) {
    console.error(
      "Google Client ID not found. Make sure REACT_APP_GOOGLE_CLIENT_ID is set in your .env file."
    );
    // Optionally render a message or fallback UI
  }
  return (
    <GoogleOAuthProvider
      clientId={GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_FALLBACK"}
    >
      {" "}
      {/* Fallback to prevent crash if env is missing */}
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/payment-confirmation"
            element={<PaymentConfirmation />}
          />

          {/* Protected Routes */}
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <Notes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
