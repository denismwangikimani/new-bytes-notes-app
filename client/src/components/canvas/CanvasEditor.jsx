import React, { useRef, useState, useEffect } from "react";
import { RefreshCw, Eraser, Pen, Calculator } from "lucide-react";
import "./CanvasEditor.css";

const CanvasEditor = ({
  onSwitchMode,
  noteId,
  onUpdateCanvas,
  initialData,
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("pen"); // 'pen' or 'eraser'
  const [color, setColor] = useState("#000000"); // Default color: black
  const [thickness, setThickness] = useState(2); // Default thickness
  const [context, setContext] = useState(null);

  const colors = [
    { name: "Black", value: "#000000" },
    { name: "Red", value: "#FF0000" },
    { name: "Orange", value: "#FFA500" },
    { name: "Green", value: "#008000" },
    { name: "Blue", value: "#0000FF" },
    { name: "Pink", value: "#FFC0CB" },
    { name: "Purple", value: "#800080" },
    { name: "Brown", value: "#A52A2A" },
    { name: "Grey", value: "#808080" },
    { name: "Yellow", value: "#FFFF00" },
  ];

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Set canvas dimensions to match parent container
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight - 50; // Leave space for toolbar
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    setContext(ctx);

    // Load initial data if available
    if (initialData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = initialData;
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [initialData]);

  // Save canvas data when drawing stops
  useEffect(() => {
    if (!isDrawing && context) {
      const canvas = canvasRef.current;
      const canvasData = canvas.toDataURL("image/png");
      onUpdateCanvas(canvasData);
    }
  }, [isDrawing, context, onUpdateCanvas]);

  const startDrawing = (e) => {
    const { offsetX, offsetY } = getCoordinates(e);
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);

    // Set drawing styles based on current tool
    if (tool === "pen") {
      context.strokeStyle = color;
      context.lineWidth = thickness;
      context.lineCap = "round";
    } else if (tool === "eraser") {
      context.strokeStyle = "#FFFFFF"; // White for eraser
      context.lineWidth = thickness * 2; // Eraser is typically thicker
      context.lineCap = "round";
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const { offsetX, offsetY } = getCoordinates(e);
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      context.closePath();
      setIsDrawing(false);
    }
  };

  // Handle touch events and mouse events
  const getCoordinates = (event) => {
    if (event.touches) {
      // Touch event
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        offsetX: event.touches[0].clientX - rect.left,
        offsetY: event.touches[0].clientY - rect.top,
      };
    } else {
      // Mouse event
      return {
        offsetX: event.nativeEvent.offsetX,
        offsetY: event.nativeEvent.offsetY,
      };
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to clear the canvas?")) {
      const canvas = canvasRef.current;
      context.clearRect(0, 0, canvas.width, canvas.height);
      onUpdateCanvas("");
    }
  };

  const handleCalculate = () => {
    // This will be implemented later with AI
    alert("Math calculation feature will be implemented soon!");
  };

  return (
    <div className="canvas-editor">
      <div className="canvas-toolbar">
        <div className="toolbar-left">
          <button
            className="toolbar-button"
            title="Switch to Rich Text Mode"
            onClick={onSwitchMode}
          >
            <span className="button-text">Notes</span>
          </button>
          <button
            className="toolbar-button"
            title="Reset Canvas"
            onClick={handleReset}
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="toolbar-center">
          <button
            className={`toolbar-button ${tool === "pen" ? "active" : ""}`}
            title="Pen Tool"
            onClick={() => setTool("pen")}
          >
            <Pen size={18} />
          </button>
          <button
            className={`toolbar-button ${tool === "eraser" ? "active" : ""}`}
            title="Eraser"
            onClick={() => setTool("eraser")}
          >
            <Eraser size={18} />
          </button>

          <div className="thickness-control">
            <input
              type="range"
              min="1"
              max="10"
              value={thickness}
              onChange={(e) => setThickness(parseInt(e.target.value))}
              title="Adjust Thickness"
            />
          </div>

          <div className="color-palette">
            {colors.map((colorOption) => (
              <button
                key={colorOption.name}
                className={`color-button ${
                  color === colorOption.value ? "active" : ""
                }`}
                style={{ backgroundColor: colorOption.value }}
                title={colorOption.name}
                onClick={() => setColor(colorOption.value)}
              />
            ))}
          </div>
        </div>

        <div className="toolbar-right">
          <button
            className="toolbar-button calculate-button"
            title="Calculate"
            onClick={handleCalculate}
          >
            <Calculator size={18} />
            <span className="button-text">Calculate</span>
          </button>
        </div>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
};

export default CanvasEditor;
