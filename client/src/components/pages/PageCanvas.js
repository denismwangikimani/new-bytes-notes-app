import React, { useRef, useEffect } from "react";
//import { usePages } from "./PageProvider";
import "./pages.css";

const PageCanvas = ({ pageType, ...props }) => {
  //const { pageType, pageMode, pages, currentPage } = usePages();
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    // Make canvas match the wrapper's scrollHeight
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.offsetWidth;
      canvas.height = parent.scrollHeight || parent.offsetHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background based on pageType
    if (pageType === "lines") {
      for (let y = 40; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else if (pageType === "grid") {
      for (let x = 40; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (let y = 40; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    // Blank: do nothing
  }, [pageType]);

  return (
    <canvas
      ref={canvasRef}
      className={`page-canvas ${pageType}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        pointerEvents: "none",
      }}
      {...props}
    />
  );
};

export default PageCanvas;
