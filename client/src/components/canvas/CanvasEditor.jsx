/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useState, useEffect, useCallback } from "react";
import { RefreshCw, Eraser, Pen, Calculator } from "lucide-react";
import "./CanvasEditor.css";
import {
  analyzeMathExpression,
  hasEquationChanged,
} from "../../services/canvasMathService";

const CanvasEditor = ({
  onSwitchMode,
  noteId,
  onUpdateCanvas,
  initialData,
}) => {
  // Existing state variables
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [thickness, setThickness] = useState(2);
  const [context, setContext] = useState(null);
  const saveTimeoutRef = useRef(null);
  const devicePixelRatioRef = useRef(window.devicePixelRatio || 1);

  // New state variables for math calculations
  const [lastCanvasData, setLastCanvasData] = useState("");
  const [calculationResults, setCalculationResults] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [variables, setVariables] = useState({});
  const analyzeTimeoutRef = useRef(null);

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
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
      }
    };
  }, [initialData]);

  // Detect equals sign and trigger calculation
  const checkForEqualsSign = useCallback(
    async (canvasData) => {
      if (!canvasData || isCalculating) return;

      // Check if the canvas data has changed enough to warrant recalculation
      if (!hasEquationChanged(lastCanvasData, canvasData)) return;

      setLastCanvasData(canvasData);

      // Clear any existing timeout to prevent multiple calculations
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
      }

      // Set a timeout to allow the user to finish drawing
      analyzeTimeoutRef.current = setTimeout(async () => {
        setIsCalculating(true);
        try {
          const results = await analyzeMathExpression(canvasData, variables);
          setCalculationResults(results);

          // Update variables if any assignments were made
          const newVars = { ...variables };
          let varsChanged = false;

          results.forEach((result) => {
            if (result.assign && result.expr && result.result !== undefined) {
              newVars[result.expr] = result.result;
              varsChanged = true;
            }
          });

          if (varsChanged) {
            setVariables(newVars);
          }

          // Draw the results on the canvas
          drawResults(results);
        } catch (error) {
          console.error("Error calculating result:", error);
        } finally {
          setIsCalculating(false);
        }
      }, 1000); // Wait 1 second after drawing stops
    },
    [lastCanvasData, isCalculating, variables]
  );

  // Draw the calculation results on the canvas
  const drawResults = useCallback(
    (results) => {
      if (!context || !canvasRef.current || results.length === 0) return;

      const canvas = canvasRef.current;

      // Save current context state
      context.save();

      // Set text style for results
      context.font = "22px Arial";
      context.fillStyle = "#4f46e5"; // Purple color for results

      // Find a good position to place the result
      // For now, we'll place it in the bottom right corner
      // In a real app, you'd want to analyze the equation's position
      let resultX = canvas.width / (devicePixelRatioRef.current * 2);
      let resultY = canvas.height / devicePixelRatioRef.current - 50;

      results.forEach((result) => {
        if (result.expr && result.result !== undefined) {
          const text = `${result.assign ? `${result.expr} = ` : ""}${
            result.result
          }`;
          context.fillText(text, resultX, resultY);
          resultY += 30; // Move down for multiple results
        }
      });

      // Restore context state
      context.restore();

      // Save the canvas with the results
      const canvasDataWithResults = canvas.toDataURL("image/jpeg", 0.7);
      onUpdateCanvas(canvasDataWithResults);
    },
    [context, onUpdateCanvas]
  );

  // Save canvas data when drawing stops - modified to include math detection
  useEffect(() => {
    if (!isDrawing && context) {
      // Clear any existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set a new timeout to save after drawing stops
      saveTimeoutRef.current = setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const canvasData = canvas.toDataURL("image/jpeg", 0.7);
          onUpdateCanvas(canvasData);

          // Check for equals sign or calculation after the user stops drawing
          checkForEqualsSign(canvasData);
        }
      }, 600);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isDrawing, context, onUpdateCanvas, checkForEqualsSign]);

  // Existing drawing functions
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
    }
  };

  // Optimize touch handling for mobile
  const getCoordinates = (event) => {
    if (!canvasRef.current) return { offsetX: 0, offsetY: 0 };

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
  }, [context]);

  // Handle calculate button
  const handleCalculate = useCallback(async () => {
    if (!canvasRef.current || isCalculating) return;

    setIsCalculating(true);
    try {
      const canvas = canvasRef.current;
      const canvasData = canvas.toDataURL("image/jpeg", 0.7);

      const results = await analyzeMathExpression(canvasData, variables);
      setCalculationResults(results);

      // Update variables if any assignments were made
      const newVars = { ...variables };
      let varsChanged = false;

      results.forEach((result) => {
        if (result.assign && result.expr && result.result !== undefined) {
          newVars[result.expr] = result.result;
          varsChanged = true;
        }
      });

      if (varsChanged) {
        setVariables(newVars);
      }

      // Draw the results on the canvas
      drawResults(results);
    } catch (error) {
      console.error("Error calculating result:", error);
    } finally {
      setIsCalculating(false);
    }
  }, [variables, isCalculating, drawResults, analyzeMathExpression]);

  const handleReset = () => {
    if (window.confirm("Are you sure you want to clear the canvas?")) {
      if (!context || !canvasRef.current) return;

      const canvas = canvasRef.current;
      context.clearRect(0, 0, canvas.width, canvas.height);
      onUpdateCanvas("");

      // Reset calculation state
      setLastCanvasData("");
      setCalculationResults([]);
      setVariables({});
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
