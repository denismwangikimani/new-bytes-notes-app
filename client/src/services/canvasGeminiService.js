import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Send canvas image to backend, get Gemini answer
export async function sendCanvasToGemini(imageDataUrl, noteId) {
  try {
    const token = localStorage.getItem("token");
    const response = await axios.post(
      `${API_BASE_URL}/canvas-calculate`, // You will create this route in your Express backend
      {
        image: imageDataUrl,
        noteId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data.result || response.data.data || response.data;
  } catch (err) {
    return "Error: " + (err.response?.data?.message || err.message);
  }
}
