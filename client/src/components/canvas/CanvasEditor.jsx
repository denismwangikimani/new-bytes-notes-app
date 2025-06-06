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

  // Initialize canvas with improved mobile support
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Set canvas dimensions to match parent container
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      const devicePixelRatio = window.devicePixelRatio || 1;

      // Set display size
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight - 50}px`; // Leave space for toolbar

      // Set actual size
      canvas.width = container.clientWidth * devicePixelRatio;
      canvas.height = (container.clientHeight - 50) * devicePixelRatio;

      // Scale canvas context
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Optimize canvas for drawing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

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

  // Optimize touch handling for mobile
  const getCoordinates = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();

    if (event.touches) {
      // Prevent default to avoid scrolling while drawing on mobile
      event.preventDefault();
      return {
        offsetX: event.touches[0].clientX - rect.left,
        offsetY: event.touches[0].clientY - rect.top,
      };
    } else {
      return {
        offsetX: event.nativeEvent.offsetX,
        offsetY: event.nativeEvent.offsetY,
      };
    }
  };

  // Use passive: false to prevent default behavior properly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !context) return;

    // Function to prevent default on touch events
    const preventDefaultTouch = (e) => e.preventDefault();

    // Add touch event listener with passive: false to enable preventDefault
    canvas.addEventListener("touchstart", preventDefaultTouch, {
      passive: false,
    });
    canvas.addEventListener("touchmove", preventDefaultTouch, {
      passive: false,
    });

    return () => {
      canvas.removeEventListener("touchstart", preventDefaultTouch);
      canvas.removeEventListener("touchmove", preventDefaultTouch);
    };
  }, [context]);

  // Save canvas data when drawing stops
  // Add inside the useEffect that saves canvas data
useEffect(() => {
  if (!isDrawing && context) {
    const canvas = canvasRef.current;
    const canvasData = canvas.toDataURL("image/jpeg", 0.7); // Use JPEG with compression
    
    // Debug data size
    const sizeInKB = Math.round(canvasData.length / 1024);
    console.log(`Canvas data size: ${sizeInKB} KB`);
    
    // Only save if there's actually data to save and it's not too large
    if (canvasData && sizeInKB < 10000) { // 10MB limit
      onUpdateCanvas(canvasData);
    } else if (sizeInKB >= 10000) {
      console.warn("Canvas data too large, trying with higher compression");
      const compressedData = canvas.toDataURL("image/jpeg", 0.4);
      onUpdateCanvas(compressedData);
    }
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
      context.globalCompositeOperation = "source-over"; // Normal drawing mode
    } else if (tool === "eraser") {
      context.globalCompositeOperation = "destination-out"; // True eraser effect
      context.lineWidth = thickness * 3; // Make eraser bigger for better usability
      context.lineCap = "round";
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const { offsetX, offsetY } = getCoordinates(e);
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  // Make sure we reset the composite operation when stopping drawing
  const stopDrawing = () => {
    if (isDrawing) {
      context.closePath();
      setIsDrawing(false);
      // Reset composite operation to default when done
      context.globalCompositeOperation = "source-over";
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
