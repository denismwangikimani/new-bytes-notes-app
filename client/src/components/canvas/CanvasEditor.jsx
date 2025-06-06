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
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [thickness, setThickness] = useState(2);
  const [context, setContext] = useState(null);
  const saveTimeoutRef = useRef(null);
  const devicePixelRatioRef = useRef(window.devicePixelRatio || 1);

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

  // Initialize canvas with improved sizing and scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Reset any previous context settings
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      const dpr = devicePixelRatioRef.current;

      // Get the container's full size
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Set canvas CSS size to 100% of container
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      // Set canvas actual dimensions accounting for pixel ratio
      canvas.width = containerWidth * dpr;
      canvas.height = containerHeight * dpr;

      // Reset the context transform and apply the scale once
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // Set up context for drawing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
    };

    // Initial resize
    resizeCanvas();

    // Handle window resizing
    window.addEventListener("resize", resizeCanvas);

    // Set the context for use in other functions
    setContext(ctx);

    // Load initial canvas data if available
    if (initialData) {
      const img = new Image();
      img.onload = () => {
        // Clear canvas before drawing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = initialData;
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [initialData]);

  // Optimize touch handling for mobile
  const getCoordinates = (event) => {
    if (!canvasRef.current) return { offsetX: 0, offsetY: 0 };

    const rect = canvasRef.current.getBoundingClientRect();
    //const dpr = devicePixelRatioRef.current;

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

  // Save canvas data when drawing stops - with debounce
  useEffect(() => {
    // Only save when user stops drawing
    if (!isDrawing && context) {
      // Clear any existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set a new timeout to save after 600ms of inactivity
      saveTimeoutRef.current = setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const canvasData = canvas.toDataURL("image/jpeg", 0.7);
          onUpdateCanvas(canvasData);
        }
      }, 600);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isDrawing, context, onUpdateCanvas]);

  const startDrawing = (e) => {
    if (!context) return;

    const { offsetX, offsetY } = getCoordinates(e);
    context.beginPath();
    context.moveTo(offsetX, offsetY);

    // Set drawing styles based on current tool
    if (tool === "pen") {
      context.strokeStyle = color;
      context.lineWidth = thickness;
      context.globalCompositeOperation = "source-over";
    } else if (tool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.lineWidth = thickness * 3;
    }

    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !context) return;

    const { offsetX, offsetY } = getCoordinates(e);
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && context) {
      context.closePath();
      setIsDrawing(false);
      // Don't reset composite operation here to avoid flicker
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to clear the canvas?")) {
      if (!context || !canvasRef.current) return;

      const canvas = canvasRef.current;
      context.clearRect(0, 0, canvas.width, canvas.height);
      onUpdateCanvas("");
    }
  };

  const handleCalculate = () => {
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
