import axios from "axios";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const API_BASE_URL = "https://new-bytes-notes-backend.onrender.com";

// Check if API_KEY is defined
if (!API_KEY) {
  console.error(
    "Gemini API Key is missing! Make sure REACT_APP_GEMINI_API_KEY is set in your .env file"
  );
}

// Add a new function to handle file uploads to Gemini
const uploadFileToGemini = async (fileUrl) => {
  try {
    console.log("Uploading file to Gemini API:", fileUrl.split("/").pop());

    // Check if fileUrl is a full URL or a relative path
    const fullUrl = fileUrl.startsWith("http")
      ? fileUrl
      : `${API_BASE_URL}${fileUrl}`;

    // First, fetch the file from your server
    const response = await fetch(fullUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch file: ${response.status} ${response.statusText}`
      );
    }

    // Get the file as blob
    const fileBlob = await response.blob();

    // Get the file name from the URL
    const fileName = fileUrl.split("/").pop() || "document.pdf";

    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append("file", fileBlob, fileName);

    // Upload to your backend proxy that will handle the actual Gemini upload
    const uploadResponse = await axios.post(
      `${API_BASE_URL}/api/gemini/upload-file`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    // Return the file reference data from your backend
    return uploadResponse.data;
  } catch (error) {
    console.error("Error uploading file to Gemini:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

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

// // Helper function to fetch and convert file to base64
// const fetchFileAsBase64 = async (fileUrl) => {
//   try {
//     // Check if fileUrl is a full URL or a relative path
//     const fullUrl = fileUrl.startsWith("http")
//       ? fileUrl
//       : `${API_BASE_URL}${fileUrl}`;

//     const response = await fetch(fullUrl);

//     if (!response.ok) {
//       throw new Error(
//         `Failed to fetch file: ${response.status} ${response.statusText}`
//       );
//     }

//     const arrayBuffer = await response.arrayBuffer();

//     // Check file size - Gemini has a limit of approximately 20MB for inline data
//     const fileSizeInMB = arrayBuffer.byteLength / (1024 * 1024);

//     if (fileSizeInMB > 5) {
//       throw new Error(
//         `File is too large (${fileSizeInMB.toFixed(
//           2
//         )}MB). Maximum size for processing is 5MB.`
//       );
//     }

//     // Convert ArrayBuffer to base64 string using browser APIs
//     const bytes = new Uint8Array(arrayBuffer);
//     let binary = "";
//     for (let i = 0; i < bytes.byteLength; i++) {
//       binary += String.fromCharCode(bytes[i]);
//     }
//     return window.btoa(binary);
//   } catch (error) {
//     console.error("Error fetching file:", error);
//     throw error; // Propagate the specific error
//   }
// };

// Function to summarize a document
export const summarizeDocument = async (fileUrl) => {
  try {
    console.log(`Summarizing document: ${fileUrl.split("/").pop()}`);

    // Upload the file to get a file reference
    const fileData = await uploadFileToGemini(fileUrl);

    // Use the file reference to generate a summary
    const response = await axios.post(
      `${API_BASE_URL}/api/gemini/process-file`,
      {
        fileUri: fileData.fileUri,
        mimeType: fileData.mimeType,
        prompt:
          "Please provide a concise summary of this document, highlighting the key points and main conclusions.",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    return response.data.text;
  } catch (error) {
    console.error("Error summarizing document:", error);
    throw new Error("Failed to summarize document. Please try again.");
  }
};

// // Add a function to handle large documents
// const processLargeDocument = async (fileUrl, promptText) => {
//   try {
//     // Check if fileUrl is a full URL or a relative path
//     const fullUrl = fileUrl.startsWith("http")
//       ? fileUrl
//       : `${API_BASE_URL}${fileUrl}`;

//     // For large documents, we'll process them differently
//     // Use a more direct prompt without including the full document
//     return await generateContent(
//       `${promptText} for the document at ${fullUrl.split("/").pop()}`
//     );
//   } catch (error) {
//     console.error("Error in large document processing:", error);
//     throw new Error(
//       "Could not process large document. Please try with a smaller file."
//     );
//   }
// };

// Function to explain a document
export const explainDocument = async (fileUrl) => {
  try {
    console.log(`Explaining document: ${fileUrl.split("/").pop()}`);

    // Upload the file to get a file reference
    const fileData = await uploadFileToGemini(fileUrl);

    // Use the file reference to generate an explanation
    const response = await axios.post(
      `${API_BASE_URL}/api/gemini/process-file`,
      {
        fileUri: fileData.fileUri,
        mimeType: fileData.mimeType,
        prompt:
          "Please explain this document in simple, clear terms. Break down any complex concepts, identify the main topics covered, and explain the significance of the content.",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    return response.data.text;
  } catch (error) {
    console.error("Error explaining document:", error);
    throw new Error("Failed to explain document. Please try again.");
  }
};

// Function to ask a question about a document
export const askDocumentQuestion = async (fileUrl, question) => {
  try {
    console.log(`Asking question about document: ${fileUrl.split("/").pop()}`);

    // Upload the file to get a file reference
    const fileData = await uploadFileToGemini(fileUrl);

    // Use the file reference to ask a question
    const response = await axios.post(
      `${API_BASE_URL}/api/gemini/process-file`,
      {
        fileUri: fileData.fileUri,
        mimeType: fileData.mimeType,
        prompt: `Please answer this question about the document: ${question}`,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    return response.data.text;
  } catch (error) {
    console.error("Error asking question about document:", error);
    throw new Error("Failed to answer question. Please try again.");
  }
};

// For audio overview, we'll need to generate text first, then convert to audio
// using a text-to-speech service (we'll need to implement this in the backend)
export const generateAudioOverview = async (fileUrl) => {
  try {
    console.log(
      `Generating audio overview for document: ${fileUrl.split("/").pop()}`
    );

    // Upload the file to get a file reference
    const fileData = await uploadFileToGemini(fileUrl);

    // Use the file reference to generate a detailed overview
    const textResponse = await axios.post(
      `${API_BASE_URL}/api/gemini/process-file`,
      {
        fileUri: fileData.fileUri,
        mimeType: fileData.mimeType,
        prompt:
          "Please provide a detailed overview of this document that would be suitable for a verbal presentation. Include all key points, significant findings, methodologies, and conclusions in a well-structured format. Make it conversational but informative, as it will be read aloud.",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    const detailedSummary = textResponse.data.text;

    // Convert the text to audio using the existing endpoint
    const audioResponse = await axios.post(
      `${API_BASE_URL}/api/text-to-speech`,
      { text: detailedSummary },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    return {
      text: detailedSummary,
      audioUrl: audioResponse.data.audioUrl,
    };
  } catch (error) {
    console.error("Error generating audio overview:", error);

    if (error.response?.data?.text) {
      return {
        text: error.response.data.text,
        audioUrl: null,
        error: "Text summary generated, but audio conversion failed.",
      };
    }

    throw new Error("Failed to generate audio overview. Please try again.");
  }
};

// // Helper function to generate a more detailed summary for audio overview
// const generateDetailedSummary = async (fileUrl) => {
//   try {
//     // Get file MIME type based on URL extension
//     const mimeType = fileUrl.toLowerCase().endsWith(".pdf")
//       ? "application/pdf"
//       : "application/octet-stream";

//     // Fetch file and convert to base64
//     const fileBase64 = await fetchFileAsBase64(fileUrl);

//     // Call Gemini API with the document
//     const response = await axios.post(
//       `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
//       {
//         contents: [
//           {
//             parts: [
//               {
//                 text: "Please provide a detailed overview of this document that would be suitable for a verbal presentation. Include all key points, significant findings, methodologies, and conclusions in a well-structured format. Make it conversational but informative, as it will be read aloud:",
//               },
//               {
//                 inlineData: {
//                   mimeType: mimeType,
//                   data: fileBase64,
//                 },
//               },
//             ],
//           },
//         ],
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     // Extract and return the detailed summary text
//     if (
//       response.data &&
//       response.data.candidates &&
//       response.data.candidates[0] &&
//       response.data.candidates[0].content &&
//       response.data.candidates[0].content.parts &&
//       response.data.candidates[0].content.parts[0]
//     ) {
//       return response.data.candidates[0].content.parts[0].text;
//     }

//     throw new Error("Could not generate detailed summary.");
//   } catch (error) {
//     console.error("Error generating detailed summary:", error);
//     throw new Error("Failed to generate detailed summary.");
//   }
// };

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

export const generateFlashcards = async (noteContent) => {
  if (!noteContent || !noteContent.trim()) {
    console.error("Empty content provided for flashcard generation");
    return { error: "No content provided for generating flashcards." };
  }

  console.log("Generating flashcards for content length:", noteContent.length);

  // Prompt engineering for better flashcard generation
  const prompt = `
  Generate 5 multiple-choice quiz questions based on the following notes content. 
  For each question:
  1. Create a clear, specific question
  2. Provide exactly 4 answer choices labeled A, B, C, and D
  3. Indicate which answer is correct
  4. Include a brief explanation of why the correct answer is right
  
  Format the output as a JSON array with this structure:
  [
    {
      "question": "Question text here?",
      "options": [
        {"id": "A", "text": "First option"},
        {"id": "B", "text": "Second option"},
        {"id": "C", "text": "Third option"},
        {"id": "D", "text": "Fourth option"}
      ],
      "correctAnswer": "B",
      "explanation": "Explanation of why B is correct"
    },
    // more questions...
  ]
  
  Here is the notes content:
  ${noteContent.substring(0, 6000)}
  `;

  try {
    const response = await generateContent(prompt);

    // Extract the JSON part from the response
    const jsonMatch = response.match(/\[\s*\{.*\}\s*\]/s);

    if (jsonMatch) {
      try {
        const flashcards = JSON.parse(jsonMatch[0]);
        console.log("Generated flashcards:", flashcards.length);
        return flashcards;
      } catch (parseError) {
        console.error("Error parsing flashcards JSON:", parseError);
        return { error: "Generated flashcards were not in valid format." };
      }
    } else {
      console.error("Could not extract JSON from response");
      return { error: "Failed to generate flashcards in the correct format." };
    }
  } catch (error) {
    console.error("Error generating flashcards:", error);
    return { error: "Error generating flashcards. Please try again." };
  }
};
