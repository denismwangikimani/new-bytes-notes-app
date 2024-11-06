import React from "react";
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { useSidebar } from "./SidebarContext";

export const SidebarToggle = () => {
  const { isSidebarOpen, toggleSidebar } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className="sidebar-toggle-btn"
      aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
    >
      {isSidebarOpen ? (
        <PanelRightOpen size={20} />
      ) : (
        <PanelRightClose size={20} />
      )}
    </button>
  );
};
