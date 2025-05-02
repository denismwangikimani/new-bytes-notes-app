import React from 'react';
import { X } from 'lucide-react';

const FileSidebar = ({ isOpen, onClose, fileUrl, fileName }) => {
  if (!isOpen) return null;

  return (
    <div className={`file-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="file-sidebar-header">
        <div className="file-sidebar-title">{fileName || 'File Preview'}</div>
        <button className="file-sidebar-close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="file-sidebar-content">
        <iframe 
          src={fileUrl} 
          title={fileName || 'File Preview'} 
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default FileSidebar;