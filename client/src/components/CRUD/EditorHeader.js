import React from "react";
import { SidebarToggle } from "./SidebarToggle";
import CreateNoteButton from "./CreateNoteButton";
import { useSidebar } from "./SidebarContext";

const EditorHeader = ({ onCreate }) => {
  const { isSidebarOpen } = useSidebar();

  return (
    <div className="editor-header">
      <div className="editor-controls">
        {!isSidebarOpen && (
          <>
            <SidebarToggle />
            <CreateNoteButton onCreate={onCreate} />
          </>
        )}
      </div>
    </div>
  );
};

export default EditorHeader;
