import axios from "axios";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

export const generateContent = async (prompt) => {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Extract text from the response
    if (
      response.data &&
      response.data.candidates &&
      response.data.candidates[0] &&
      response.data.candidates[0].content &&
      response.data.candidates[0].content.parts &&
      response.data.candidates[0].content.parts[0]
    ) {
      return response.data.candidates[0].content.parts[0].text;
    }

    return "Sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Error generating content. Please try again.";
  }
};
