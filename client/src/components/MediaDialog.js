import React, { useState, useRef } from "react";
import "./MediaDialog.css";
import { X } from "lucide-react";

// Add the API base URL constant - update this to your actual API endpoint
const API_BASE_URL = "https://new-bytes-notes-backend.onrender.com";

const MediaDialog = ({ type, isOpen, onClose, onInsert }) => {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const getTitle = () => {
    switch (type) {
      case "image":
        return "Insert Image";
      case "video":
        return "Insert Video";
      case "link":
        return "Insert Link";
      case "file":
        return "Insert File";
      default:
        return "Insert Media";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // For links, just pass the URL
    if (type === "link") {
      if (!url) {
        setError("Please enter a valid URL");
        return;
      }
      onInsert(type, { url });
      onClose();
      return;
    }

    // For file uploads
    if (!file) {
      setError(`Please select a ${type} to upload`);
      return;
    }

    // Check file size limits
    const maxSize = type === "image" ? 5 * 1024 * 1024 : 16 * 1024 * 1024; // 5MB or 16MB
    if (file.size > maxSize) {
      setError(
        `${type} size exceeds the limit (${type === "image" ? "5MB" : "16MB"})`
      );
      return;
    }

    // Begin upload
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to upload ${type}`);
      }

      // Update the URL to include the base URL if it's a relative path
      const fileUrl = data.url.startsWith("http")
        ? data.url
        : `${API_BASE_URL}${data.url}`;

      onInsert(type, {
        url: fileUrl,
        filename: data.filename,
        contentType: data.contentType,
        size: data.size,
      });
      onClose();
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="media-dialog-backdrop">
      <div className="media-dialog">
        <div className="media-dialog-header">
          <h3>{getTitle()}</h3>
          <button className="close-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {type === "link" ? (
            <div className="form-group">
              <label htmlFor="url">URL:</label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="file">
                {type.charAt(0).toUpperCase() + type.slice(1)}:
              </label>
              <input
                type="file"
                id="file"
                ref={fileInputRef}
                onChange={(e) => setFile(e.target.files[0])}
                accept={
                  type === "image"
                    ? "image/*"
                    : type === "video"
                    ? "video/*"
                    : type === "file"
                    ? ".pdf,.doc,.docx,.xls,.xlsx,.txt"
                    : undefined
                }
              />
              <div className="file-size-info">
                Maximum file size: {type === "image" ? "5MB" : "16MB"}
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="dialog-buttons">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isUploading}
            >
              {isUploading ? "Uploading..." : "Insert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MediaDialog;
