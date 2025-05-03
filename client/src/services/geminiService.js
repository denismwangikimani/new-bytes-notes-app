import axios from "axios";
import { GoogleGenAI } from "@google/genai";

// API key should be in your client .env file as REACT_APP_GEMINI_API_KEY
const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const API_BASE_URL = "https://new-bytes-notes-backend.onrender.com";

// Initialize the Google GenAI client
const genAI = new GoogleGenAI({ apiKey: API_KEY });

const processDocumentInline = async (fileUrl, prompt) => {
  try {
    console.log(`Processing document inline: ${fileUrl.split("/").pop()}`);

    // Fetch the file from the server with CORS handling
    const fullUrl = fileUrl.startsWith("http")
      ? fileUrl
      : `${API_BASE_URL}${fileUrl}`;

    // Try with normal fetch first
    try {
      const fileResponse = await fetch(fullUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.status}`);
      }

      // Continue with processing if fetch is successful
      const arrayBuffer = await fileResponse.arrayBuffer();
      const base64Data = arrayBufferToBase64(arrayBuffer);
      const mimeType = getMimeType(fileUrl);

      // Rest of your processing code...
      const contents = [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
      ];

      // Process with Gemini API...
      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      });

      // Extract text from response...
      if (result.response && typeof result.response.text === "function") {
        return result.response.text();
      } else if (result.text && typeof result.text === "function") {
        return result.text();
      } else if (result.candidates && result.candidates[0]?.content?.parts) {
        return result.candidates[0].content.parts[0].text || "";
      } else {
        console.log("Unexpected response format:", result);
        return JSON.stringify(result);
      }
    } catch (fetchError) {
      // If normal fetch fails, try with a proxy or alternative approach
      console.warn(
        "Direct fetch failed, trying alternative method:",
        fetchError
      );

      // Try to use a proxy or fallback method
      // Option 1: Use a CORS proxy (example only - you should use a reliable proxy)
      // const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(fullUrl)}`;

      // Option 2: In development environment, you can tell the user about the CORS issue
      if (window.location.hostname === "localhost") {
        return `Sorry, I can't access the file directly due to CORS restrictions. 

This is a development issue that occurs when running on localhost. In production, this should work normally.

You can fix this by:
1. Making sure your server has proper CORS headers
2. Using a CORS proxy for development
3. Testing in the production environment where CORS is correctly configured`;
      }

      // Option 3: Fall back to a simplified prompt without the document
      const simplifiedResult = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          {
            text: `${prompt} (Note: I couldn't access the document contents due to technical limitations, but I can still provide general guidance on this topic.)`,
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      });

      // Extract response text
      if (
        simplifiedResult.response &&
        typeof simplifiedResult.response.text === "function"
      ) {
        return simplifiedResult.response.text();
      } else if (
        simplifiedResult.candidates &&
        simplifiedResult.candidates[0]?.content?.parts
      ) {
        return simplifiedResult.candidates[0].content.parts[0].text || "";
      } else {
        throw new Error("Failed to process document");
      }
    }
  } catch (error) {
    console.error("Error processing document inline:", error);
    throw new Error(`Inline processing failed: ${error.message}`);
  }
};

// Process a document using the Gemini Files API for larger files
const processDocumentWithFilesAPI = async (fileUrl, prompt) => {
  try {
    console.log(
      `Processing document with Files API: ${fileUrl.split("/").pop()}`
    );

    // Fetch the file from the server with CORS handling
    const fullUrl = fileUrl.startsWith("http")
      ? fileUrl
      : `${API_BASE_URL}${fileUrl}`;

    try {
      const response = await fetch(fullUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      // Continue with normal processing...
      const fileBlob = await response.blob();
      //const mimeType = getMimeType(fileUrl);

      // Upload file using the Gemini Files API - updated API method
      const file = await genAI.files.upload({
        file: fileBlob,
        config: {
          displayName: fileUrl.split("/").pop() || "document.pdf",
        },
      });

      // Wait for file processing
      let processedFile = file;
      let attempts = 0;
      const maxAttempts = 20; // Increase max attempts

      console.log("Initial file state:", processedFile.state);

      // Check if the file is already in a terminal state
      if (processedFile.state === "PROCESSED") {
        console.log("File is already processed");
      } else {
        // Wait for processing to complete
        while (
          (processedFile.state === "PROCESSING" ||
            processedFile.state === "ACTIVE") &&
          attempts < maxAttempts
        ) {
          await new Promise((resolve) => setTimeout(resolve, 3000)); // Increase wait time
          try {
            processedFile = await genAI.files.get({ name: processedFile.name });
            attempts++;
            console.log(
              `File processing attempt ${attempts}, state: ${processedFile.state}`
            );
          } catch (getError) {
            console.error("Error checking file state:", getError);
            attempts++;
          }
        }
      }

      // Some implementations use ACTIVE as a valid state to proceed
      if (
        processedFile.state !== "PROCESSED" &&
        processedFile.state !== "ACTIVE"
      ) {
        throw new Error(
          `File processing failed or timed out: ${processedFile.state}`
        );
      }

      // Create content with the file reference - updated API method
      const content = [{ text: prompt }];

      if (processedFile.uri && processedFile.mimeType) {
        const { createPartFromUri } = await import("@google/genai");
        const fileContent = createPartFromUri(
          processedFile.uri,
          processedFile.mimeType
        );
        content.push(fileContent);
      }

      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: content,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      });

      // Get the text from the result - handle different response structures
      if (result.response && typeof result.response.text === "function") {
        return result.response.text();
      } else if (result.text && typeof result.text === "function") {
        return result.text();
      } else if (result.candidates && result.candidates[0]?.content?.parts) {
        // For REST API style response
        return result.candidates[0].content.parts[0].text || "";
      } else {
        // If we can't find text in expected places, try to stringify the entire response
        console.log("Unexpected response format:", result);
        return JSON.stringify(result);
      }
    } catch (fetchError) {
      console.warn("Direct fetch failed in Files API method:", fetchError);

      // Similar fallback as in the inline method
      if (window.location.hostname === "localhost") {
        return `Sorry, I can't access the file directly due to CORS restrictions in development mode. The audio overview feature requires proper CORS configuration.`;
      }

      // Simplified fallback
      const simplifiedResult = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          {
            text: `${prompt} (Note: I couldn't access the document contents due to technical limitations, but I can still provide general guidance.)`,
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      });

      // Extract response text
      if (
        simplifiedResult.response &&
        typeof simplifiedResult.response.text === "function"
      ) {
        return simplifiedResult.response.text();
      } else if (
        simplifiedResult.candidates &&
        simplifiedResult.candidates[0]?.content?.parts
      ) {
        return simplifiedResult.candidates[0].content.parts[0].text || "";
      } else {
        throw new Error("Failed to process document with Files API");
      }
    }
  } catch (error) {
    console.error("Error processing document with Files API:", error);
    throw new Error(`Files API processing failed: ${error.message}`);
  }
};

// Helper function to convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Helper function to get MIME type from URL
const getMimeType = (fileUrl) => {
  const extension = fileUrl.split(".").pop().toLowerCase();

  const mimeTypes = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    html: "text/html",
    csv: "text/csv",
    md: "text/markdown",
    xml: "text/xml",
    rtf: "text/rtf",
  };

  return mimeTypes[extension] || "application/pdf";
};

// Function to process a document based on file size
export const processDocument = async (fileUrl, prompt) => {
  try {
    // Try the inline approach first for smaller files
    try {
      return await processDocumentInline(fileUrl, prompt);
    } catch (inlineError) {
      console.log(
        "Inline processing failed, trying Files API:",
        inlineError.message
      );
      return await processDocumentWithFilesAPI(fileUrl, prompt);
    }
  } catch (error) {
    console.error("All document processing methods failed:", error);
    throw new Error(`Document processing failed: ${error.message}`);
  }
};

// Export functions that use the new processDocument function
export const summarizeDocument = async (fileUrl) => {
  try {
    return await processDocument(
      fileUrl,
      "Please provide a concise summary of this document, highlighting the key points and main conclusions."
    );
  } catch (error) {
    console.error("Error summarizing document:", error);
    throw new Error("Failed to summarize document. Please try again.");
  }
};

export const explainDocument = async (fileUrl) => {
  try {
    return await processDocument(
      fileUrl,
      "Please explain this document in simple, clear terms. Break down any complex concepts, identify the main topics covered, and explain the significance of the content."
    );
  } catch (error) {
    console.error("Error explaining document:", error);
    throw new Error("Failed to explain document. Please try again.");
  }
};

export const askDocumentQuestion = async (fileUrl, question) => {
  try {
    return await processDocument(
      fileUrl,
      `Please answer this question about the document: ${question}`
    );
  } catch (error) {
    console.error("Error asking question about document:", error);
    throw new Error("Failed to answer question. Please try again.");
  }
};

export const generateAudioOverview = async (fileUrl) => {
  try {
    // Generate the text summary using Gemini
    const detailedSummary = await processDocument(
      fileUrl,
      "Please provide a detailed overview of this document that would be suitable for a verbal presentation. Include all key points, significant findings, methodologies, and conclusions in a well-structured format. Make it conversational but informative, as it will be read aloud."
    );

    // Try using browser's built-in speech synthesis as fallback
    // This is more reliable than depending on the server endpoint
    try {
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
        usedBrowserSpeech: false,
      };
    } catch (audioError) {
      console.log(
        "Server audio generation failed, using browser speech synthesis:",
        audioError
      );

      // Use the browser's built-in speech synthesis API as fallback
      // Generate a blob URL that can be used in an audio element
      const audioBlob = await generateAudioBlobFromText(detailedSummary);
      const audioBlobUrl = URL.createObjectURL(audioBlob);

      return {
        text: detailedSummary,
        audioUrl: audioBlobUrl,
        usedBrowserSpeech: true,
      };
    }
  } catch (error) {
    console.error("Error generating audio overview:", error);
    throw new Error("Failed to generate audio overview. Please try again.");
  }
};

// Helper function to generate speech using the browser's Web Speech API
const generateAudioBlobFromText = (text) => {
  return new Promise((resolve, reject) => {
    // Check if browser supports speech synthesis
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      reject(new Error("Browser doesn't support speech synthesis"));
      return;
    }

    // Set up audio context and processor
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const chunks = [];

    // Create media recorder to capture audio
    const destination = audioContext.createMediaStreamDestination();
    const mediaRecorder = new MediaRecorder(destination.stream);

    mediaRecorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/mp3" });
      resolve(blob);
      processor.disconnect();
      audioContext.close();
    };

    // Split text into manageable chunks to prevent timeouts
    const textChunks = chunkText(text, 200); // Split by ~200 words

    let utteranceIndex = 0;

    // Start recording
    mediaRecorder.start();

    // Function to process each chunk
    const processNextChunk = () => {
      if (utteranceIndex >= textChunks.length) {
        // All chunks processed, stop recording
        setTimeout(() => mediaRecorder.stop(), 1000); // Give a second for last audio to finish
        return;
      }

      const utterance = new SpeechSynthesisUtterance(
        textChunks[utteranceIndex]
      );
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Find a good voice - prefer female English voice if available
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter((v) => v.lang.includes("en-"));
      if (englishVoices.length > 0) {
        // Try to find a female voice first
        const femaleVoice = englishVoices.find(
          (v) => v.name.includes("Female") || v.name.includes("female")
        );
        utterance.voice = femaleVoice || englishVoices[0];
      }

      utterance.onend = () => {
        utteranceIndex++;
        processNextChunk();
      };

      window.speechSynthesis.speak(utterance);
    };

    // Initialize voices if needed and start processing
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        processNextChunk();
      };
    } else {
      processNextChunk();
    }
  });
};

// Helper function to chunk text into smaller pieces
const chunkText = (text, wordCount) => {
  const words = text.split(" ");
  const chunks = [];

  for (let i = 0; i < words.length; i += wordCount) {
    chunks.push(words.slice(i, i + wordCount).join(" "));
  }

  return chunks;
};

// Keep the existing content generation function but update it
export const generateContent = async (prompt) => {
  try {
    // Updated API method
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    // Handle different response structures
    if (result.response && typeof result.response.text === "function") {
      return result.response.text();
    } else if (result.text && typeof result.text === "function") {
      return result.text();
    } else if (result.candidates && result.candidates[0]?.content?.parts) {
      // For REST API style response
      return result.candidates[0].content.parts[0].text || "";
    } else {
      // If we can't find text in expected places, try to stringify the entire response
      console.log("Unexpected response format:", result);
      return "Response could not be processed. Check console for details.";
    }
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
