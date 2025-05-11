import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./SettingsPage.css"; 

const API_BASE_URL = "https://new-bytes-notes-backend.onrender.com";

function SettingsPage() {
  const [userData, setUserData] = useState({ username: "", email: "" });
  const [newUsername, setNewUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const getApi = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return null;
    }
    return axios.create({
      baseURL: API_BASE_URL,
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      setIsLoading(true);
      const api = getApi();
      if (!api) return;

      try {
        const response = await api.get("/api/user/profile");
        setUserData(response.data);
        setNewUsername(response.data.username); // Pre-fill username for editing
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load user profile.");
        console.error("Fetch profile error:", err);
        setIsLoading(false);
      }
    };
    fetchUserProfile();
  }, [navigate]);

  const handleUpdateUsername = async (e) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setError("Username cannot be empty.");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccessMessage("");
    const api = getApi();
    if (!api) return;

    try {
      const response = await api.put("/api/user/update-username", {
        username: newUsername,
      });
      setUserData((prev) => ({ ...prev, username: newUsername }));
      setSuccessMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update username.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      // Example minimum length
      setError("New password must be at least 6 characters long.");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccessMessage("");
    const api = getApi();
    if (!api) return;

    try {
      const response = await api.put("/api/user/change-password", {
        currentPassword,
        newPassword,
      });
      setSuccessMessage(response.data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete your account? This action cannot be undone."
      )
    ) {
      setIsLoading(true);
      setError("");
      setSuccessMessage("");
      const api = getApi();
      if (!api) return;

      try {
        await api.delete("/api/user/delete-account");
        localStorage.removeItem("token");
        navigate("/login", {
          state: { message: "Account deleted successfully." },
        });
      } catch (err) {
        setError(err.response?.data?.message || "Failed to delete account.");
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="settings-container">
      <h2>Account Settings</h2>
      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      <div className="settings-card">
        <h3>Profile Information</h3>
        <p>
          <strong>Email:</strong> {userData.email}
        </p>
        <form onSubmit={handleUpdateUsername}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || newUsername === userData.username}
          >
            {isLoading ? "Updating..." : "Update Username"}
          </button>
        </form>
      </div>

      <div className="settings-card">
        <h3>Change Password</h3>
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password:</label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="newPassword">New Password:</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmNewPassword">Confirm New Password:</label>
            <input
              type="password"
              id="confirmNewPassword"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>

      <div className="settings-card danger-zone">
        <h3>Danger Zone</h3>
        <button
          onClick={handleDeleteAccount}
          className="delete-button"
          disabled={isLoading}
        >
          {isLoading ? "Deleting..." : "Delete Account"}
        </button>
        <p>Permanently delete your account and all associated data.</p>
      </div>
    </div>
  );
}

export default SettingsPage;
