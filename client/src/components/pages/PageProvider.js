import React, { createContext, useContext, useState } from "react";

const PageContext = createContext();

export const usePages = () => useContext(PageContext);

export const PageProvider = ({ children }) => {
  const [pageType, setPageType] = useState("blank");
  const [pageMode, setPageMode] = useState("infinite");
  const [pages, setPages] = useState([
    { id: 1, slateValue: null, canvasImage: null },
  ]);
  const [currentPage, setCurrentPage] = useState(0);

  const addPage = () =>
    setPages((prev) => [
      ...prev,
      { id: prev.length + 1, slateValue: null, canvasImage: null },
    ]);

  const setPageContent = (idx, { slateValue, canvasImage }) => {
    setPages((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, slateValue, canvasImage } : p))
    );
  };

  return (
    <PageContext.Provider
      value={{
        pageType,
        setPageType,
        pageMode,
        setPageMode,
        pages,
        addPage,
        currentPage,
        setCurrentPage,
        setPageContent,
      }}
    >
      {children}
    </PageContext.Provider>
  );
};
