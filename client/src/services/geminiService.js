import axios from "axios";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

export const generateContent = async (prompt) => {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
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

export const transformText = async (text, transformType) => {
  if (!text || !text.trim()) {
    console.error("Empty text provided for transformation");
    return "No text selected for transformation.";
  }

  console.log(
    `Transforming text (${transformType}): ${text.substring(0, 50)}...`
  );

  let prompt = "";

  switch (transformType) {
    case "summarize":
      prompt = `Summarize the following text concisely while preserving the key points:\n\n${text}`;
      break;
    case "explain":
      prompt = `Explain the following text in clear, simple terms while preserving the meaning:\n\n${text}`;
      break;
    case "shorten":
      prompt = `Shorten the following text to be more concise while maintaining the core message:\n\n${text}`;
      break;
    case "expand":
      prompt = `Expand upon the following text by adding more detail, examples, or explanations:\n\n${text}`;
      break;
    default:
      prompt = text;
  }

  try {
    console.log(
      "Sending prompt to generateContent:",
      prompt.substring(0, 50) + "..."
    );
    const result = await generateContent(prompt);
    console.log(
      "Transform result received, length:",
      result ? result.length : 0
    );
    return result;
  } catch (error) {
    console.error("Error in transformText:", error);
    // Return an error message instead of rethrowing to prevent UI from breaking
    return "Error processing your request. Please try again.";
  }
};
