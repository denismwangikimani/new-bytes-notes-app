import React from "react";
import { usePages } from "./PageProvider";

const PAGE_TYPES = [
  { value: "blank", label: "Blank" },
  { value: "lines", label: "Lines" },
  { value: "grid", label: "Grid" },
];

const PAGE_MODES = [
  { value: "infinite", label: "Infinite" },
  { value: "numbered", label: "Numbered" },
];

const PageControls = () => {
  const {
    pageType,
    setPageType,
    pageMode,
    setPageMode,
    pages,
    addPage,
    currentPage,
    setCurrentPage,
  } = usePages();

  return (
    <div className="page-controls">
      <div>
        <label>Page Style:</label>
        <select value={pageType} onChange={(e) => setPageType(e.target.value)}>
          {PAGE_TYPES.map((pt) => (
            <option key={pt.value} value={pt.value}>
              {pt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Page Mode:</label>
        <select value={pageMode} onChange={(e) => setPageMode(e.target.value)}>
          {PAGE_MODES.map((pm) => (
            <option key={pm.value} value={pm.value}>
              {pm.label}
            </option>
          ))}
        </select>
      </div>
      {pageMode === "numbered" && (
        <div>
          <button onClick={addPage}>+ Add Page</button>
          <span>
            Page:{" "}
            <select
              value={currentPage}
              onChange={(e) => setCurrentPage(Number(e.target.value))}
            >
              {pages.map((p, idx) => (
                <option key={p.id} value={idx}>
                  {idx + 1}
                </option>
              ))}
            </select>
            / {pages.length}
          </span>
        </div>
      )}
    </div>
  );
};

export default PageControls;
