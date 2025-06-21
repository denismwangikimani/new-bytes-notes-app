import React, { useRef, useState, useEffect } from "react";
import "./Canvas.css";
import { sendCanvasToGemini } from "../../services/canvasGeminiService";

const COLORS = [
  "#ffffff",
  "#ee3333",
  "#e64980",
  "#be4bdb",
  "#893200",
  "#228be6",
  "#3333ee",
  "#40c057",
  "#00aa00",
  "#fab005",
  "#fd7e14",
];

const Canvas = ({
  value,
  onChange,
  onResult,
  width = 600,
  height = 400,
  noteId,
  onSwitchToNotes,
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#ffffff");
  const [result, setResult] = useState(null);
  const [penSize, setPenSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [shape, setShape] = useState("pen"); // "free", "rect", "circle", "triangle", etc.
  const [startPoint, setStartPoint] = useState(null);
  const [showResult, setShowResult] = useState(true);
  const lastLoadedValue = useRef(null);
  const saveTimeout = useRef(null);

  // Load saved canvas image for this note
  useEffect(() => {
    // Only reload if value is different from last loaded
    if (
      !isDrawing &&
      value &&
      value !== lastLoadedValue.current &&
      canvasRef.current
    ) {
      const ctx = canvasRef.current.getContext("2d");
      const img = new window.Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        lastLoadedValue.current = value;
      };
      img.src = value;
    } else if (!isDrawing && !value && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      lastLoadedValue.current = null;
    }
    // eslint-disable-next-line
  }, [value, width, height, isDrawing]);

  const debouncedSaveCanvas = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (canvasRef.current) {
        const dataUrl = canvasRef.current.toDataURL("image/png");
        onChange && onChange(dataUrl);
      }
    }, 500); // 500ms after last draw
  };

  // Save canvas image to parent only on mouse up (after drawing)
  const saveCanvas = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      // Don't call onChange here during every draw!
      // We'll call it only after drawing is done.
      return dataUrl;
    }
  };

  // Save current state to history
  const pushToHistory = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL();
      setHistory((prev) => [...prev, dataUrl]);
      setRedoStack([]); // Clear redo stack on new action
    }
  };

  // Undo
  const handleUndo = () => {
    if (history.length === 0) return;
    setRedoStack((prev) => [canvasRef.current.toDataURL(), ...prev]);
    const prevState = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      const img = new window.Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        saveCanvas();
      };
      img.src = prevState;
    }
  };

  // Redo
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[0];
    setRedoStack((prev) => prev.slice(1));
    setHistory((prev) => [...prev, canvasRef.current.toDataURL()]);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      const img = new window.Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        saveCanvas();
      };
      img.src = nextState;
    }
  };

  const getCanvasCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.nativeEvent.clientX - rect.left) * scaleX,
      y: (e.nativeEvent.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    pushToHistory();
    const { x, y } = getCanvasCoords(e);
    setStartPoint({ x, y });
    if (shape === "pen" || isEraser) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (shape !== "pen" && !isEraser) return;
    const { x, y } = getCanvasCoords(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.save();
    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = penSize;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
    debouncedSaveCanvas(); // <-- Use debounce here
  };
  
  const stopDrawing = (e) => {
    if (shape !== "pen" && !isEraser && startPoint) {
      const { x, y } = getCanvasCoords(e);
      drawShape(startPoint, { x, y });
      setStartPoint(null);
      // Save after shape is drawn
      if (canvasRef.current) {
        const dataUrl = canvasRef.current.toDataURL("image/png");
        onChange && onChange(dataUrl);
      }
    }
    if (isDrawing && (shape === "pen" || isEraser)) {
      // Save after pen/eraser drawing is done
      if (canvasRef.current) {
        const dataUrl = canvasRef.current.toDataURL("image/png");
        onChange && onChange(dataUrl);
      }
    }
    setIsDrawing(false);
  };

  const drawShape = (start, end) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = penSize;
    ctx.beginPath();
    switch (shape) {
      case "square": {
        // Draw a perfect square (equal width and height)
        const size = Math.max(
          Math.abs(end.x - start.x),
          Math.abs(end.y - start.y)
        );
        const signX = end.x - start.x >= 0 ? 1 : -1;
        const signY = end.y - start.y >= 0 ? 1 : -1;
        ctx.strokeRect(start.x, start.y, size * signX, size * signY);
        break;
      }
      case "rect":
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        break;
      case "circle": {
        const radius = Math.sqrt(
          Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
        );
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }
      case "line":
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;
      case "triangle":
        ctx.moveTo(start.x, end.y);
        ctx.lineTo((start.x + end.x) / 2, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.closePath();
        ctx.stroke();
        break;
      default:
        break;
    }
    ctx.restore();
  };

  const handleReset = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    lastLoadedValue.current = null;
    saveCanvas();
    setResult(null);
    onResult && onResult(null);
  };

  const handleCalculate = async () => {
    if (!canvasRef.current) return;
    setShowResult(true);
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setResult("Loading...");
    const answer = await sendCanvasToGemini(dataUrl, noteId);
    setResult(answer);
    onResult && onResult(answer);
  };

  const formatResult = (result) => {
    if (!result) return "";
    try {
      // Try to parse as JSON or Python-style list of dicts
      let arr = result;
      if (typeof result === "string") {
        // Replace single quotes with double quotes for JSON.parse
        arr = JSON.parse(result.replace(/'/g, '"'));
      }
      if (Array.isArray(arr)) {
        return arr
          .map((item) => {
            if (item.expr && item.result !== undefined) {
              return `${item.expr.replace(/\s+/g, "")}=${item.result}`;
            }
            return "";
          })
          .filter(Boolean)
          .join(", ");
      }
      return result;
    } catch (e) {
      // If parsing fails, just show the raw result
      return result;
    }
  };

  return (
    <div className="canvas-container">
      <div className="canvas-toolbar-outer">
        <button className="sticky-btn" onClick={onSwitchToNotes}>
          Convert to Notes
        </button>
        <div className="canvas-toolbar-scroll">
          {/* All other toolbar buttons (undo, redo, pen, shapes, colors, etc.) */}
          <button onClick={handleUndo} disabled={history.length === 0}>
            Undo
          </button>
          <button onClick={handleRedo} disabled={redoStack.length === 0}>
            Redo
          </button>
          <button onClick={handleReset}>Reset</button>
          <button
            onClick={() => setIsEraser((v) => !v)}
            style={{ background: isEraser ? "#eee" : "#fff" }}
            title="Eraser"
          >
            {isEraser ? "Eraser On" : "Eraser"}
          </button>
          <button
            className={shape === "pen" ? "active" : ""}
            onClick={() => setShape("pen")}
          >
            Pen
          </button>
          <div className="shapes-dropdown">
            <select
              id="shape-select"
              value={shape}
              onChange={(e) => setShape(e.target.value)}
            >
              <option value="">--Shapes--</option>
              <option value="square">Square</option>
              <option value="rect">Rectangle</option>
              <option value="circle">Circle</option>
              <option value="triangle">Triangle</option>
              <option value="line">Line</option>
            </select>
          </div>
          <div className="canvas-colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className="canvas-color"
                style={{
                  background: c,
                  border: color === c && !isEraser ? "2px solid #333" : "none",
                }}
                onClick={() => {
                  setColor(c);
                  setIsEraser(false);
                }}
              />
            ))}
          </div>
          <label style={{ marginLeft: 8 }}>
            Pen Size
            <input
              type="range"
              min={1}
              max={15}
              value={penSize}
              onChange={(e) => setPenSize(Number(e.target.value))}
              style={{ verticalAlign: "middle", marginLeft: 4 }}
            />
          </label>
        </div>
        <button className="sticky-btn" onClick={handleCalculate}>
          Calculate
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="canvas-board"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        style={{ width: "100%", maxWidth: "100%", background: "#fff" }}
      />
      {result && showResult && (
        <div
          className="canvas-result-sticky"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "32px",
            transform: "translateX(-50%)",
            zIndex: 100,
            background: "#18181b",
            color: "#fff",
            border: "2px solid #fff",
            borderRadius: "8px",
            minWidth: "320px",
            maxWidth: "90vw",
            maxHeight: "180px",
            overflowY: "auto",
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            padding: "1rem 2.5rem 1rem 1rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          <div style={{ flex: 1 }}>
            <strong>Result:</strong>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {formatResult(result)}
            </pre>
          </div>
          <button
            onClick={() => setShowResult(false)}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: "1.2rem",
              fontWeight: "bold",
              cursor: "pointer",
              position: "absolute",
              top: "8px",
              right: "12px",
            }}
            title="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default Canvas;
