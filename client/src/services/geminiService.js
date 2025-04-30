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