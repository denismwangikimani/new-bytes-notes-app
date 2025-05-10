// external imports
const express = require("express");
const mongoose = require("mongoose");
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
  // Allow requests from both localhost and your production domain
  const allowedOrigins = [
    "http://localhost:3000",
    "https://new-bytes-notes-app.onrender.com",
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content, Accept, Content-Type, Authorization"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// Middleware to parse JSON
app.use(express.json());

//stripe connect
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Step 1: Initiate registration without creating a token
app.post("/register/initiate", async (req, res) => {
  const { email, username, password } = req.body;

  // Validate request data
  if (!email || !username || !password) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists!" });
    }

    // Create a temporary user ID that we'll use for payment
    // but don't save to the database yet
    const tempUserId = new mongoose.Types.ObjectId();

    return res.status(200).json({
      message: "Account details valid",
      userId: tempUserId,
    });
  } catch (error) {
    console.error("Registration initiation error:", error);
    return res.status(500).json({
      message: "Error initiating registration",
      error: error.toString(),
    });
  }
});

// Step 2: Create a payment intent
app.post("/create-payment-intent", async (req, res) => {
  const { email, amount, userId } = req.body;

  try {
    // Create a new Stripe customer
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        userId: userId.toString(),
      },
    });

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // amount in cents
      currency: "usd",
      customer: customer.id,
      metadata: {
        userId: userId.toString(),
        email: email,
      },
      receipt_email: email,
      description: "Byte-Notes Lifetime Access",
    });

    res.status(200).send({
      clientSecret: paymentIntent.client_secret,
      customerId: customer.id,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res
      .status(500)
      .json({ message: "Error processing payment", error: error.message });
  }
});

// Step 3: Complete registration after payment
app.post("/register/complete", async (req, res) => {
  const { email, paymentIntentId, username, password } = req.body;

  // First log all incoming data (except password)
  console.log("Register complete request:", {
    email,
    paymentIntentId,
    hasUsername: !!username,
    hasPassword: !!password,
  });

  try {
    // Verify the payment intent was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log("Payment intent status:", paymentIntent.status);
    console.log("Payment intent metadata:", paymentIntent.metadata);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    // Get the user details from metadata
    const userId = paymentIntent.metadata.userId;

    if (!userId) {
      return res
        .status(400)
        .json({ message: "User ID not found in payment metadata" });
    }

    // Ensure required fields are present
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    // Create a user
    const user = new User({
      _id: userId,
      email,
      username,
      password: await bcrypt.hash(password, 10),
      isPaid: true,
      paymentDate: new Date(),
    });

    await user.save();

    // Create and send token
    const token = jwt.sign(
      {
        userId: user._id,
        userEmail: user.email,
        isPaid: true,
      },
      "secret",
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Registration successful!",
      token,
    });
  } catch (error) {
    console.error("Error completing registration:", error);
    res.status(500).json({
      message: "Error completing registration",
      error: error.toString(),
      stack: error.stack,
    });
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

// Set up multer storage - use disk storage instead of memory storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use the existing uploads directory
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

// Set up upload middleware with size limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB limit for all files
  },
});

// File upload endpoint
app.post("/api/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { originalname, mimetype, size, filename, path: filePath } = req.file;
    const userId = req.user.userId;

    // Validate file size based on type
    const isImage = mimetype.startsWith("image/");
    const maxSize = isImage ? 5 * 1024 * 1024 : 16 * 1024 * 1024; // 5MB for images, 16MB for others

    if (size > maxSize) {
      // Delete the file if it exceeds the size limit
      fs.unlinkSync(filePath);
      return res.status(400).json({
        message: `File size exceeds the limit (${isImage ? "5MB" : "16MB"})`,
      });
    }

    // Create a new file document with file path instead of buffer
    const newFile = new File({
      user: userId,
      filename: originalname,
      contentType: mimetype,
      size: size,
      storagePath: filePath, // Store path instead of binary data
      diskFilename: filename,
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

// Update file retrieval endpoint to work with files on disk
app.get("/api/files/:id", async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Set appropriate headers
    res.set({
      "Content-Type": file.contentType,
      "Content-Length": file.size,
      "Content-Disposition": `inline; filename="${file.filename}"`,
    });

    // If we have a storagePath, send the file from disk
    if (file.storagePath && fs.existsSync(file.storagePath)) {
      return res.sendFile(file.storagePath);
    } else if (file.data) {
      // For backward compatibility with files stored in MongoDB
      return res.send(file.data);
    } else {
      return res.status(404).json({ message: "File content not found" });
    }
  } catch (error) {
    console.error("Error retrieving file:", error);
    res.status(500).json({ message: "Error retrieving file", error });
  }
});

// Update delete endpoint to handle files on disk
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

    // Delete the file from disk if it exists
    if (file.storagePath && fs.existsSync(file.storagePath)) {
      fs.unlinkSync(file.storagePath);
    }

    // Delete the file from the database
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

module.exports = app;
