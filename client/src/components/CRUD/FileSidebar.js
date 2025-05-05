import React, { useEffect, useState } from "react";
import { X, Maximize, Minimize } from "lucide-react";
import FileSidebarAI from "../FileSidebarAI";
import "./FileSidebar.css";

const FileSidebar = ({ isOpen, onClose, fileUrl, fileName }) => {
  const [fileType, setFileType] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Try to determine file type
    if (fileName) {
      const extension = fileName.split(".").pop().toLowerCase();
      if (["pdf"].includes(extension)) {
        setFileType("application/pdf");
      } else if (["doc", "docx"].includes(extension)) {
        setFileType("application/msword");
      } else if (["xls", "xlsx"].includes(extension)) {
        setFileType("application/vnd.ms-excel");
      } else if (["jpg", "jpeg", "png", "gif"].includes(extension)) {
        setFileType(`image/${extension === "jpg" ? "jpeg" : extension}`);
      } else {
        setFileType("application/octet-stream");
      }
    }
  }, [fileName]);

  // Set fullscreen mode when on mobile automatically
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsFullscreen(true);
      }
    };

    handleResize(); // Check on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`file-sidebar ${isOpen ? "open" : ""} ${
        isFullscreen ? "fullscreen" : ""
      }`}
      onClick={(e) => e.stopPropagation()} // Prevent events from propagating to parent
    >
      <div className="file-sidebar-header">
        <div className="file-sidebar-title">{fileName || "File Preview"}</div>
        <div className="file-sidebar-controls">
          <button
            className="file-sidebar-toggle"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button
            className="file-sidebar-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="file-sidebar-content">
        <iframe
          src={fileUrl}
          title={fileName || "File Preview"}
          allowFullScreen
        />
      </div>
      <FileSidebarAI
        fileUrl={fileUrl}
        fileName={fileName}
        fileType={fileType}
      />
    </div>
  );
};

export default FileSidebar;
