import axios from "axios";

// API key should be from your .env file
const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

/**
 * Analyzes a canvas image with mathematical expressions and returns the calculated result
 * @param {string} imageData - Base64 encoded image data from canvas
 * @param {Object} variables - Dictionary of user-assigned variables (optional)
 * @returns {Promise<Array>} - Array of objects with expression and result
 */
export const analyzeMathExpression = async (imageData, variables = {}) => {
  try {
    // Remove the data:image/png;base64, prefix if present
    const base64Image = imageData.split(",")[1] || imageData;

    // Prepare the API request to Gemini
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: buildPrompt(variables),
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generation_config: {
          temperature: 0.2,
          max_output_tokens: 1024,
        },
      }
    );

    // Extract and parse the response
    const responseText = response.data.candidates[0].content.parts[0].text;
    console.log("Raw response from Gemini:", responseText);

    // Try to parse the response as JSON or array
    try {
      // First try direct JSON parse
      const parsedResult = JSON.parse(responseText);
      return normalizeResults(parsedResult);
    } catch (parseError) {
      // If that fails, try to extract array/object from text
      const match = responseText.match(/\[.*\]/s);
      if (match) {
        try {
          const extractedJson = match[0];
          const parsedResult = JSON.parse(extractedJson);
          return normalizeResults(parsedResult);
        } catch (extractError) {
          console.error("Error parsing extracted JSON:", extractError);
          return [{ expr: "Error parsing result", result: responseText }];
        }
      } else {
        return [{ expr: "Unable to extract result", result: responseText }];
      }
    }
  } catch (error) {
    console.error("Error analyzing math expression:", error);
    return [{ expr: "Error", result: error.message }];
  }
};

/**
 * Builds the prompt for the Gemini API
 * @param {Object} variables - Dictionary of user-assigned variables
 * @returns {string} - Prompt string
 */
const buildPrompt = (variables) => {
  const variablesStr = JSON.stringify(variables, null, 2);

  return `You have been given an image with some mathematical expressions or equations, and you need to solve them.

Note: Use the PEMDAS rule for solving mathematical expressions. PEMDAS stands for the Priority Order: Parentheses, Exponents, Multiplication and Division (from left to right), Addition and Subtraction (from left to right).

IMPORTANT: Only calculate and return an answer if ONE of these is true:
1. The image contains an equals sign (=)
2. The image shows a vertical calculation with a horizontal line (like ___ or ——) underneath numbers

For vertical calculations, be very attentive to these specific patterns:
- Numbers stacked with an operator (+, -, *, or /) either before or after the numbers
- A horizontal line underneath (like ___ or ——)
- Examples of vertical calculations to recognize:
  * "8" on one line, followed by "8+" on the next line, followed by "___" means 8+8 and should return 16
  * "8" on one line, followed by "*8" on the next line, followed by "___" means 8*8 and should return 64 
  * "8" on one line, followed by "8-" on the next line, followed by "___" means 8-8 and should return 0
  * "8" on one line, followed by "/2" on the next line, followed by "___" means 8/2 and should return 4
  * Also recognize if the numbers are aligned in a column for addition/subtraction

Pay careful attention to the arrangement and alignment of numbers and operators.

Return your answer in the format:
[{"expr": "given expression", "result": calculated answer}]

For variable assignments (like x = 5), return:
[{"expr": "x", "result": 5, "assign": true}]

Here is a dictionary of user-assigned variables to use: ${variablesStr}.

IMPORTANT: DO NOT calculate or return results if there is no equals sign or horizontal line indicating calculation should be performed.
RETURN ONLY THE JSON ARRAY WITH NO EXPLANATIONS.`;
};

/**
 * Normalizes the results to ensure they follow a consistent format
 * @param {Array|Object} results - The parsed results from Gemini
 * @returns {Array} - Normalized array of objects with expression and result
 */
const normalizeResults = (results) => {
  if (!results) {
    return [];
  }

  // If it's not an array, wrap it in an array
  if (!Array.isArray(results)) {
    results = [results];
  }

  // Ensure each result has consistent properties
  return results.map((item) => {
    return {
      expr: item.expr || "",
      result: item.result,
      assign: item.assign === true,
    };
  });
};

/**
 * Detects if an equation has changed significantly
 * @param {string} previousImage - Previous canvas image data
 * @param {string} currentImage - Current canvas image data
 * @returns {boolean} - True if the equation has changed significantly
 */
export const hasEquationChanged = (previousImage, currentImage) => {
  if (!previousImage) return true;

  // Only check a subset of the data to improve performance
  const sampleSize = 1000;
  const prevSample = previousImage.substring(0, sampleSize);
  const currSample = currentImage.substring(0, sampleSize);

  return prevSample !== currSample;
};
