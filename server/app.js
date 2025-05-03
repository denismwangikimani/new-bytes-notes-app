// external imports
const express = require("express");
const multer = require("multer");
const dbConnect = require("./db/dbConnect");
const User = require("./db/userModel");
const Note = require("./db/noteModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("./auth");
const Group = require("./db/groupModel");
const File = require("./db/fileModel");
const textToSpeech = require("@google-cloud/text-to-speech");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

// Load environment variables from .env file
require("dotenv").config();

// initialize express app
const app = express();

// Connect to MongoDB
dbConnect();

// Curb Cores Error by adding a header here
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content, Accept, Content-Type, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  next();
});

// Middleware to parse JSON
app.use(express.json());

// Registration endpoint
app.post("/register", async (req, res) => {
  const { email, username, password } = req.body;

  // Validate request data
  if (!email || !username || !password) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    // Check if the user already exists and return an error message if the user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User with this email already exists!" });
    }

    //hash the password using bcryptjs by passing the password and the number of rounds to hash the password(salt)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user to save in the database, by passing the email, username and hashed password
    const newUser = new User({ email, username, password: hashedPassword });
    await newUser.save();

    // Respond with success message if user is created successfully
    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Validate request data
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and Password are required!" });
  }

  try {
    // Check if the user exists and return an error message if the user does not exist
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // Compare the password provided with the hashed password in the database
    const isPasswordMatching = await bcrypt.compare(password, user.password);

    // Return an error message if the password is incorrect
    if (!isPasswordMatching) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    // Create a JWT token if the password is correct
    const token = jwt.sign(
      { email: user.email, userId: user._id.toString() },
      "secret",
      {
        expiresIn: "24h",
      }
    );

    // Respond with the token if the user is logged in successfully
    res.status(200).json({ message: "Login successful!", token: token });
  } catch (error) {
    res.status(500).json({ message: "Error logging in user", error });
  }
});

// Protect the notes route
// app.get("/notes", auth, (req, res) => {
//   res.json({ message: "Here are your notes..." });
// });

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

//get all notes saved by the user
//get all notes saved by the user
app.get("/notes", auth, async (req, res) => {
  try {
    // Get the user's ID from the decoded token
    const userId = req.user.userId;

    // Parse query parameters for search and filtering
    const {
      search,
      createdAtStart,
      createdAtEnd,
      updatedAtStart,
      updatedAtEnd,
    } = req.query;
    const filterQuery = { user: userId };

    // Apply search filter if provided
    if (search) {
      filterQuery.$text = { $search: search };
    }

    // Apply date range filters if provided
    if (createdAtStart) {
      filterQuery.createdAt = { $gte: new Date(createdAtStart) };
    }
    if (createdAtEnd) {
      filterQuery.createdAt = {
        ...(filterQuery.createdAt || {}),
        $lte: new Date(createdAtEnd),
      };
    }
    if (updatedAtStart) {
      filterQuery.updatedAt = { $gte: new Date(updatedAtStart) };
    }
    if (updatedAtEnd) {
      filterQuery.updatedAt = {
        ...(filterQuery.updatedAt || {}),
        $lte: new Date(updatedAtEnd),
      };
    }

    // Find all notes that match the filter
    const notes = await Note.find(filterQuery);
    res.json({ notes });
  } catch (error) {
    res.status(500).json({ message: "Error getting notes", error });
  }
});

//create a new note
app.post("/notes", auth, async (req, res) => {
  let { title, content } = req.body;

  // If title or content is blank, assign a default value or return an error
  if (!title) title = "Untitled Note";
  if (!content) content = "";

  try {
    // Get the user's ID from the decoded token
    const userId = req.user.userId;

    // Return an error message if the user ID is not found in the token
    if (!userId) {
      return res.status(401).json({ message: "User ID not found in token" });
    }
    // Create a new note to save in the database, by passing the title, content and the user id
    const newNote = new Note({
      title,
      content,
      user: userId,
    });
    await newNote.save();

    // Respond with success message if note is created successfully
    res
      .status(201)
      .json({ message: "Note created successfully!", note: newNote });
  } catch (error) {
    res.status(500).json({ message: "Error creating note", error });
  }
});

//update a note by id
app.put("/notes/:id", auth, async (req, res) => {
  const { title, content } = req.body;

  // Validate request data
  try {
    // Get the user's ID from the decoded token
    const userId = req.user.userId;
    // Find the note by id and update it
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { title, content },
      { new: true }
    );
    // Respond with success message if note is updated successfully
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.status(200).json({ message: "Note updated successfully", note });
    // Respond with error message if note is not updated successfully
  } catch (error) {
    res.status(500).json({ message: "Error updating note", error });
  }
});

//delete a note by id
app.delete("/notes/:id", auth, async (req, res) => {
  try {
    // Get the user's ID from the decoded token
    const userId = req.user.userId;
    // Find the note by id and delete it
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      user: userId,
    });
    //Respond with error message if note is not deleted successfully
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    //Respond with success message if note is deleted successfully
    res.status(200).json({ message: "Note deleted successfully" });
  } catch (error) {
    //Respond with error message if note is not deleted successfully
    res.status(500).json({ message: "Error deleting note", error });
  }
});

// Get all groups for a user
app.get("/groups", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const groups = await Group.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json({ groups });
  } catch (error) {
    res.status(500).json({ message: "Error fetching groups", error });
  }
});

// Create a new group
app.post("/groups", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, color } = req.body;

    const newGroup = new Group({
      name,
      color,
      user: userId,
    });

    await newGroup.save();
    res
      .status(201)
      .json({ message: "Group created successfully", group: newGroup });
  } catch (error) {
    res.status(500).json({ message: "Error creating group", error });
  }
});

// Delete a group
app.delete("/groups/:id", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const groupId = req.params.id;

    // Delete the group
    const deletedGroup = await Group.findOneAndDelete({
      _id: groupId,
      user: userId,
    });
    if (!deletedGroup) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Update all notes in this group to have no group
    await Note.updateMany(
      { groupId: groupId, user: userId },
      { $set: { groupId: null } }
    );

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting group", error });
  }
});

// Move a note to a group
app.put("/notes/:id/move", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const noteId = req.params.id;
    const { groupId } = req.body;

    // Verify the group exists (if not null)
    if (groupId) {
      const group = await Group.findOne({ _id: groupId, user: userId });
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
    }

    // Update the note
    const updatedNote = await Note.findOneAndUpdate(
      { _id: noteId, user: userId },
      { groupId: groupId },
      { new: true }
    );

    if (!updatedNote) {
      return res.status(404).json({ message: "Note not found" });
    }

    res
      .status(200)
      .json({ message: "Note moved successfully", note: updatedNote });
  } catch (error) {
    res.status(500).json({ message: "Error moving note", error });
  }
});

// Set up multer storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB limit
  },
});

// File upload endpoint
app.post("/api/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    const userId = req.user.userId;

    // Validate file size based on type
    const isImage = mimetype.startsWith("image/");
    const maxSize = isImage ? 5 * 1024 * 1024 : 16 * 1024 * 1024; // 5MB for images, 16MB for others

    if (size > maxSize) {
      return res.status(400).json({
        message: `File size exceeds the limit (${isImage ? "5MB" : "16MB"})`,
      });
    }

    // Create a new file document
    const newFile = new File({
      user: userId,
      filename: originalname,
      contentType: mimetype,
      size: size,
      data: buffer,
    });

    await newFile.save();

    // Return the file URL
    const fileUrl = `/api/files/${newFile._id}`;

    res.status(201).json({
      message: "File uploaded successfully",
      url: fileUrl,
      filename: originalname,
      contentType: mimetype,
      size: size,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ message: "Error uploading file", error });
  }
});

// File retrieval endpoint
app.get("/api/files/:id", async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    res.set({
      "Content-Type": file.contentType,
      "Content-Length": file.size,
      "Content-Disposition": `inline; filename="${file.filename}"`,
    });

    res.send(file.data);
  } catch (error) {
    console.error("Error retrieving file:", error);
    res.status(500).json({ message: "Error retrieving file", error });
  }
});

// Add this endpoint to delete files
app.delete("/api/files/:id", auth, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.userId;

    // Ensure the file belongs to the current user
    const file = await File.findOne({ _id: fileId, user: userId });

    if (!file) {
      return res.status(404).json({
        message: "File not found or you don't have permission to delete it",
      });
    }

    // Delete the file
    await File.findByIdAndDelete(fileId);

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ message: "Error deleting file", error });
  }
});

// Text-to-speech endpoint
app.post("/api/text-to-speech", auth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.length === 0) {
      return res.status(400).json({ message: "Text is required" });
    }

    // Initialize the Text-to-Speech client
    const client = new textToSpeech.TextToSpeechClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // Perform the text-to-speech request
    const [response] = await client.synthesizeSpeech({
      input: { text: text },
      voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
      audioConfig: { audioEncoding: "MP3" },
    });

    // Generate a unique filename
    const fileName = `tts-${uuidv4()}.mp3`;
    const filePath = path.join(uploadsDir, fileName);

    // Write the audio content to file
    fs.writeFileSync(filePath, response.audioContent, "binary");

    // Create a new file record in the database
    const newFile = new File({
      user: req.user.userId,
      filename: fileName,
      contentType: "audio/mpeg",
      size: response.audioContent.length,
      data: response.audioContent,
    });

    await newFile.save();

    // Return the file URL
    const audioUrl = `/api/files/${newFile._id}`;
    res.status(200).json({ audioUrl, message: "Audio generated successfully" });
  } catch (error) {
    console.error("Error generating speech:", error);
    res.status(500).json({ message: "Error generating speech", error });
  }
});

// Upload file to Gemini API
app.post(
  "/api/gemini/upload-file",
  auth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Before uploading to Gemini
      console.log("About to upload to Gemini API:", req.file.originalname);
      console.log("File size:", req.file.size, "bytes");
      console.log("File type:", req.file.mimetype);

      // Get a Gemini API key
      const geminiApiKey = process.env.GEMINI_API_KEY;
      console.log("GEMINI_API_KEY loaded:", geminiApiKey ? "Yes" : "NO!!!"); // Add this line
      if (!geminiApiKey) {
        console.error("Gemini API key is missing from environment variables"); // Added log
        return res
          .status(500)
          .json({ message: "Gemini API key is not configured" });
      }

      // Create FormData for the Gemini File API request
      const formData = new FormData();
      formData.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      // Upload to Gemini File API
      const geminiUploadResponse = await axios.post(
        "https://generativelanguage.googleapis.com/v1beta/files",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            "x-goog-api-key": geminiApiKey,
          },
        }
      );

      console.log("Successfully uploaded to Gemini:", geminiUploadResponse.data.name);

      // Check if file was uploaded successfully
      if (!geminiUploadResponse.data || !geminiUploadResponse.data.name) {
        return res
          .status(500)
          .json({ message: "Failed to upload file to Gemini API" });
      }

      // Wait for the file to be processed
      const fileName = geminiUploadResponse.data.name;
      let fileProcessed = false;
      let fileData = null;
      let retries = 0;
      const maxRetries = 10;

      while (!fileProcessed && retries < maxRetries) {
        const fileCheckResponse = await axios.get(
          `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${geminiApiKey}`
        );

        fileData = fileCheckResponse.data;

        if (fileData.state === "PROCESSED") {
          fileProcessed = true;
        } else if (fileData.state === "FAILED") {
          return res
            .status(500)
            .json({ message: "File processing failed in Gemini API" });
        } else {
          // Wait 2 seconds before checking again
          await new Promise((resolve) => setTimeout(resolve, 2000));
          retries++;
        }
      }

      if (!fileProcessed) {
        return res.status(500).json({ message: "File processing timed out" });
      }

      // Return the file information
      res.status(200).json({
        message: "File uploaded successfully to Gemini API",
        fileUri: fileData.uri,
        mimeType: fileData.mimeType,
        name: fileName,
      });
    } catch (error) {
      console.error("Error uploading file to Gemini:", error);
      res.status(500).json({
        message: "Error uploading file to Gemini API",
        error: error.message,
      });
    }
  }
);

// Process file with Gemini API
app.post("/api/gemini/process-file", auth, async (req, res) => {
  try {
    const { fileUri, mimeType, prompt } = req.body;

    if (!fileUri || !mimeType || !prompt) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    // Get a Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res
        .status(500)
        .json({ message: "Gemini API key is not configured" });
    }

    // Create the file part
    const filePart = {
      fileData: {
        mimeType: mimeType,
        fileUri: fileUri,
      },
    };

    // Process with Gemini API
    const processResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiApiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }, filePart],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Extract the response text
    let responseText = "No response generated";

    if (
      processResponse.data &&
      processResponse.data.candidates &&
      processResponse.data.candidates[0] &&
      processResponse.data.candidates[0].content &&
      processResponse.data.candidates[0].content.parts &&
      processResponse.data.candidates[0].content.parts[0]
    ) {
      responseText = processResponse.data.candidates[0].content.parts[0].text;
    }

    res.status(200).json({
      text: responseText,
    });
  } catch (error) {
    console.error("Error processing file with Gemini:", error);
    res.status(500).json({
      message: "Error processing file with Gemini API",
      error: error.message,
    });
  }
});

module.exports = app;
