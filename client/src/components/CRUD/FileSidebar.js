import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import FileSidebarAI from "../FileSidebarAI";

const FileSidebar = ({ isOpen, onClose, fileUrl, fileName }) => {
  const [fileType, setFileType] = useState(null);

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

  if (!isOpen) return null;

  return (
    <div className={`file-sidebar ${isOpen ? "open" : ""}`}>
      <div className="file-sidebar-header">
        <div className="file-sidebar-title">{fileName || "File Preview"}</div>
        <button className="file-sidebar-close" onClick={onClose}>
          <X size={20} />
        </button>
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
