// external imports
const express = require("express");
const dbConnect = require("./db/dbConnect");
const User = require("./db/userModel");
const Note = require("./db/noteModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("./auth");

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

//get all notes saved by the user
app.get("/notes", auth, async (req, res) => {
  try {
    // Get the user's ID from the decoded token
    const userId = req.user.userId;
    // Find all notes saved by the user
    const notes = await Note.find({ user: userId });
    res.json({ notes });
  } catch (error) {
    res.status(500).json({ message: "Error getting notes", error });
  }
});

//create a new note
app.post("/notes", auth, async (req, res) => {
  const { title, content } = req.body;

  // Validate request data
  if (!title || !content) {
    return res.status(400).json({ message: "Title and Content are required!" });
  }

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

module.exports = app;
