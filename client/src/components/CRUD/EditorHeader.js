import React from "react";
import { SidebarToggle } from "./SidebarToggle";
import CreateNoteButton from "./CreateNoteButton";
import { useSidebar } from "./SidebarContext";

const EditorHeader = ({ onCreate }) => {
  const { isSidebarOpen } = useSidebar();

  return !isSidebarOpen ? (
    <div className="editor-header">
      <div className="editor-controls">
        <SidebarToggle />
        <CreateNoteButton onCreate={onCreate} />
      </div>
    </div>
  ) : null;
};

export default EditorHeader;
