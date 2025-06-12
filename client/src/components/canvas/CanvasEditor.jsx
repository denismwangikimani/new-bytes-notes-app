/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { RefreshCw, Eraser, Pen, Calculator } from "lucide-react";
import "./CanvasEditor.css";
import { hasEquationChanged } from "../../services/canvasMathService";

const CanvasEditor = ({
  onSwitchMode,
  noteId,
  onUpdateCanvas,
  initialData,
}) => {
  // Canvas refs and state variables
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const sendCanvasDataTimeoutRef = useRef(null);
  const analyzeTimeoutRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [thickness, setThickness] = useState(2);
  const [context, setContext] = useState(null);
  const [variables, setVariables] = useState({});
  const devicePixelRatioRef = useRef(window.devicePixelRatio || 1);

  // Math calculation states
  const [lastCanvasData, setLastCanvasData] = useState("");
  const [calculationResults, setCalculationResults] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [cleanCanvasData, setCleanCanvasData] = useState("");
  const saveTimeoutRef = useRef(null);

  // Available pen colors
  const colors = [
    { name: "Black", value: "#000000" },
    { name: "Red", value: "#FF0000" },
    { name: "Blue", value: "#0000FF" },
    { name: "Green", value: "#008000" },
    { name: "Purple", value: "#800080" },
    { name: "Orange", value: "#FFA500" },
    { name: "Yellow", value: "#FFFF00" },
    { name: "Gray", value: "#808080" },
    { name: "White", value: "#FFFFFF" },
  ];

  // Draw the calculation results on the canvas
  const drawResults = useCallback(
    (results) => {
      if (
        !context ||
        !canvasRef.current ||
        results.length === 0 ||
        !cleanCanvasData
      )
        return;

      const canvas = canvasRef.current;
      const img = new Image();

      img.onload = () => {
        // Clear the canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the original clean drawing
        context.drawImage(img, 0, 0);

        // Prepare the result area
        const padding = 10;
        const resultY = canvas.height / devicePixelRatioRef.current - 40;

        // Draw a subtle background
        context.save();
        context.fillStyle = "rgba(245, 247, 250, 0.85)";
        context.fillRect(
          0,
          resultY - padding,
          canvas.width / devicePixelRatioRef.current,
          50
        );

        // Draw a separator line
        context.strokeStyle = "#e5e7eb";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, resultY - padding);
        context.lineTo(
          canvas.width / devicePixelRatioRef.current,
          resultY - padding
        );
        context.stroke();

        // Set text style
        context.font = "18px Arial";
        context.fillStyle = "#4f46e5";

        // Format and draw results
        const resultStrings = results.map(
          (result) =>
            `${result.assign ? `${result.expr} = ` : ""}${result.result}`
        );

        let x = padding;
        for (const resultString of resultStrings) {
          context.fillText(resultString, x, resultY + 20);
          x += context.measureText(resultString).width + 20; // Add spacing between results
        }

        context.restore();

        // Save the combined canvas with results
        const canvasDataWithResults = canvas.toDataURL("image/png", 1.0);
        onUpdateCanvas(canvasDataWithResults);
      };

      img.src = cleanCanvasData;
    },
    [context, onUpdateCanvas, cleanCanvasData]
  );

  // Initialize canvas and WebSocket connection
  useEffect(() => {
    // Canvas initialization
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      devicePixelRatioRef.current = dpr;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;
      canvas.width = Math.floor(containerWidth * dpr);
      canvas.height = Math.floor(containerHeight * dpr);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.miterLimit = 2;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    setContext(ctx);

    // Load initial canvas data if available
    if (initialData) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setCleanCanvasData(initialData);
      };
      img.src = initialData;
    }

    // Initialize WebSocket connection
    socketRef.current = io(
      process.env.REACT_APP_API_URL || "http://localhost:3000"
    );

    // Set up WebSocket event listeners
    socketRef.current.on("calculation_result", (result) => {
      if (result.results && result.results.length > 0) {
        setCalculationResults(result.results);
        drawResults(result.results);

        // Update variables if needed
        if (result.variables) {
          setVariables(result.variables);
        }
      }
      setIsCalculating(false);
    });

    socketRef.current.on("calculation_error", (error) => {
      console.error("Calculation error:", error);
      setIsCalculating(false);
    });

    // Load variables for this note
    if (noteId) {
      axios
        .get(`/api/notes/${noteId}/variables`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        })
        .then((response) => {
          if (response.data && response.data.variables) {
            setVariables(response.data.variables);
          }
        })
        .catch((error) =>
          console.error("Failed to load note variables:", error)
        );
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
      if (sendCanvasDataTimeoutRef.current)
        clearTimeout(sendCanvasDataTimeoutRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [initialData, noteId, drawResults]);

  // Save clean canvas data
  const saveCleanCanvasData = () => {
    if (!canvasRef.current || !context) return "";
    const canvas = canvasRef.current;
    const cleanData = canvas.toDataURL("image/png");
    setCleanCanvasData(cleanData);
    return cleanData;
  };

  // Drawing functions
  const startDrawing = (e) => {
    if (!context) return;

    const { offsetX, offsetY } = getCoordinates(e);
    context.beginPath();
    context.moveTo(offsetX, offsetY);

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
    if (!isDrawing || !context) return;

    context.closePath();
    setIsDrawing(false);

    // Save clean canvas data and trigger analysis
    const cleanData = saveCleanCanvasData();

    // Debounce sending to WebSocket
    if (sendCanvasDataTimeoutRef.current) {
      clearTimeout(sendCanvasDataTimeoutRef.current);
    }

    sendCanvasDataTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && cleanData) {
        // Send canvas data for analysis through WebSocket
        socketRef.current.emit("canvas_data", {
          canvasData: cleanData,
          userId: localStorage.getItem("userId"),
          noteId: noteId,
          variables: variables,
        });

        // Also send via HTTP for more reliable processing
        checkForMathExpression(cleanData);
      }
    }, 800);
  };

  // Helper function to get coordinates from mouse or touch event
  const getCoordinates = (event) => {
    if (!canvasRef.current) return { offsetX: 0, offsetY: 0 };

    const rect = canvasRef.current.getBoundingClientRect();

    if (event.touches) {
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

  // Prevent default on touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventDefaultTouch = (e) => e.preventDefault();

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
  }, []);

  // Function to check for math expressions in canvas
  const checkForMathExpression = useCallback(
    async (canvasData) => {
      if (!canvasData || isCalculating) return;

      // Only analyze if data has changed significantly
      if (!hasEquationChanged(lastCanvasData, canvasData)) return;

      setLastCanvasData(canvasData);

      // Clear existing timeout
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
      }

      // Set a delay before analyzing to avoid too many API calls
      analyzeTimeoutRef.current = setTimeout(async () => {
        try {
          setIsCalculating(true);

          // Make API call to analyze math expression
          const response = await axios.post(
            "/api/analyze-math",
            {
              canvasData,
              noteId,
              variables,
            },
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            }
          );

          // Process results
          const { results, variables: newVariables } = response.data;

          if (results && results.length > 0) {
            setCalculationResults(results);

            // Update variables if returned
            if (newVariables) {
              setVariables(newVariables);
            }

            // Draw results on canvas
            drawResults(results);
          }
        } catch (error) {
          console.error("Error analyzing math expression:", error);
        } finally {
          setIsCalculating(false);
        }
      }, 1000);
    },
    [lastCanvasData, isCalculating, variables, noteId, drawResults]
  );

  // Handle calculate button click
  const handleCalculate = useCallback(async () => {
    if (!canvasRef.current || isCalculating) return;

    setIsCalculating(true);
    try {
      const canvas = canvasRef.current;
      const canvasData = canvas.toDataURL("image/jpeg", 0.7);

      // Save clean data
      setCleanCanvasData(canvasData);

      // Send canvas data for analysis
      checkForMathExpression(canvasData);
    } catch (error) {
      console.error("Error calculating result:", error);
      setIsCalculating(false);
    }
  }, [isCalculating, checkForMathExpression]);

  // Handle canvas reset
  const handleReset = () => {
    if (window.confirm("Are you sure you want to clear the canvas?")) {
      if (!context || !canvasRef.current) return;

      const canvas = canvasRef.current;
      context.clearRect(0, 0, canvas.width, canvas.height);
      onUpdateCanvas("");

      // Reset calculation state
      setLastCanvasData("");
      setCleanCanvasData("");
      setCalculationResults([]);
    }
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
            disabled={isCalculating}
          >
            <Calculator size={18} />
            <span className="button-text">
              {isCalculating ? "Calculating..." : "Calculate"}
            </span>
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

        {/* Enhanced calculation results display */}
        {calculationResults.length > 0 && !isCalculating && (
          <div className="calculation-results">
            {calculationResults.map((result, index) => (
              <div key={index} className="calculation-result">
                <span className="expression">{result.expr}</span>
                <span className="equals">=</span>
                <span className="result">{result.result}</span>
                {result.assign && (
                  <span className="assigned">Variable assigned</span>
                )}
              </div>
            ))}
          </div>
        )}

        {isCalculating && (
          <div className="calculation-overlay">
            <div className="calculation-spinner"></div>
            <span>Calculating...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasEditor;
