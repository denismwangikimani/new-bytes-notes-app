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
const { OAuth2Client } = require("google-auth-library");
const textToSpeech = require("@google-cloud/text-to-speech");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const { Server } = require("socket.io");
const http = require("http");

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
    "https://bytenotesapp.netlify.app",
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

// Increase the body size limit for JSON requests
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Create HTTP server (if not already done)
const server = http.createServer(app);

// Set up Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://new-bytes-notes-app.onrender.com",
      "https://bytenotesapp.netlify.app",
    ],
    methods: ["GET", "POST"],
  },
});

// Connect to MongoDB and then set up Change Streams
// This is moved to AFTER io is initialized
dbConnect()
  .then(() => {
    console.log("Connected to MongoDB");
    setupChangeStreams(io); // Pass the io instance
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
  });

// This sets up change streams to watch for changes to the notes collection
async function setupChangeStreams(socketIoInstance) {
  // Accept io instance as a parameter
  try {
    console.log("Setting up Change Streams...");

    // Use Mongoose Model's watch() method
    const notesChangeStream = Note.watch([], {
      fullDocument: "updateLookup", // Correct option for Mongoose
    });

    // Listen for 'change' events on the stream
    notesChangeStream.on("change", (change) => {
      if (
        change.operationType === "insert" ||
        change.operationType === "update"
      ) {
        const note = change.fullDocument;
        if (note) {
          socketIoInstance.emit("note_updated", {
            // Use the passed io instance
            noteId: note._id.toString(),
            title: note.title,
            content: note.content,
            canvasData: note.canvasData,
            updatedAt: note.updatedAt,
          });
        }
      } else if (change.operationType === "delete") {
        // Handle deletion events
        const noteId = change.documentKey._id.toString();
        socketIoInstance.emit("note_deleted", { noteId }); // Use the passed io instance
      }
    });

    notesChangeStream.on("error", (error) => {
      // Handle errors from the change stream itself
      console.error("Change Stream error:", error);
    });

    console.log("Change Streams set up successfully");
  } catch (error) {
    // This catch block handles errors during the initial setup of the stream
    console.error("Failed to set up Change Streams:", error);
  }
}

// Helper function (you might want to move this to a shared utility or import if buildPrompt is complex)
function buildCanvasMathPrompt(variables) {
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
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("canvas_data", async (data) => {
    try {
      const { canvasData, userId, noteId, variables = {} } = data;

      if (!canvasData || !noteId) {
        // Optionally emit an error back to the client
        // socket.emit("calculation_error", { message: "Canvas data or Note ID missing" });
        return;
      }

      const geminiPrompt = buildCanvasMathPrompt(variables);

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [
                { text: geminiPrompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg", // Assuming JPEG, adjust if PNG from client
                    data: canvasData.split(",")[1] || canvasData,
                  },
                },
              ],
            },
          ],
          generation_config: { temperature: 0.1, max_output_tokens: 1024 }, // Adjusted max_output_tokens
        }
      );

      let results = [];
      let newVariables = { ...variables };
      let responseText = "";

      if (
        response.data.candidates &&
        response.data.candidates.length > 0 &&
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts &&
        response.data.candidates[0].content.parts.length > 0
      ) {
        responseText = response.data.candidates[0].content.parts[0].text;
        try {
          const match = responseText.match(/(\[[\s\S]*\])/);
          if (match && match[0]) {
            results = JSON.parse(match[0]);
            // Normalize results and extract variables
            results = results.map((item) => ({
              expr: item.expr || "",
              result: item.result,
              assign: item.assign === true,
            }));
            results.forEach((result) => {
              if (result.assign && result.expr) {
                newVariables[result.expr] = result.result;
              }
            });
          } else {
            console.warn(
              "No JSON array found in Gemini response via WebSocket:",
              responseText
            );
          }
        } catch (parseError) {
          console.error(
            "Error parsing Gemini response via WebSocket:",
            parseError,
            responseText
          );
        }
      } else {
        console.warn(
          "Unexpected Gemini response structure via WebSocket:",
          response.data
        );
      }

      // Update note in DB
      const updatedNote = await Note.findByIdAndUpdate(
        noteId,
        {
          // canvasData: canvasData, // The raw canvas data is already saved by client call
          lastCalculation: {
            results,
            timestamp: new Date(),
            rawResponse: responseText,
          },
          variables: newVariables,
        },
        { new: true }
      );

      // Emit structured result back to the specific client
      socket.emit("calculation_result", { results, variables: newVariables });
    } catch (error) {
      console.error(
        "Error processing canvas data via WebSocket:",
        error.message
      );
      // Potentially emit an error back to the client
      socket.emit("calculation_error", {
        message: "Failed to process calculation via WebSocket",
        error: error.message,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

//stripe connect
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//google connect
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Health check endpoint
app.get("/healthz", (req, res) => {
  res.sendStatus(200); // Simply send 200 OK if the server is running
});

// NEW: Step 1 (Email): Initiate Email Signup
app.post("/initiate-email-signup", async (req, res) => {
  const { email, username, password: tempPassword } = req.body; // Client sends password, but we don't save it yet

  if (!email || !username || !tempPassword) {
    return res
      .status(400)
      .json({ message: "Email, username, and password are required." });
  }
  if (tempPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters long." });
  }

  try {
    let user = await User.findOne({ email });
    if (user && user.isPaid) {
      return res
        .status(400)
        .json({ message: "Email already registered and paid." });
    }
    // If user exists but is not paid, we can allow them to retry payment with new details,
    // or overwrite. For simplicity, let's assume a new attempt might mean new temp user or update existing.
    // For now, let's prevent duplicate unpaid accounts with the same email.
    if (user && !user.isPaid) {
      // Optionally, delete the old unpaid user or update them.
      // For this example, we'll just use the existing unpaid user.
      // Or, to ensure clean state for this flow:
      // await User.deleteOne({ email, isPaid: false });
      // For now, let's prevent creating a new one if an unpaid one exists.
      return res.status(400).json({
        message:
          "An unpaid account with this email already exists. Try logging in or contacting support.",
      });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername && existingUsername.isPaid) {
      return res.status(400).json({ message: "Username already taken." });
    }
    if (existingUsername && !existingUsername.isPaid) {
      // Similar to email, handle existing unpaid username
      return res.status(400).json({
        message: "An unpaid account with this username already exists.",
      });
    }

    // Create a preliminary user record (password is not hashed or stored yet)
    // The client will hold the password and send it again at the /complete-payment step
    const preliminaryUser = new User({
      email,
      username,
      isPaid: false,
      // password will be set upon successful payment completion
    });
    await preliminaryUser.save();

    res.status(200).json({
      message: "Signup initiated. Proceed to payment.",
      tempUserId: preliminaryUser._id.toString(),
    });
  } catch (error) {
    console.error("Error initiating email signup:", error);
    res
      .status(500)
      .json({ message: "Error initiating signup", error: error.toString() });
  }
});

// MODIFIED: /auth/google to become /google/initiate-signup
app.post("/google/initiate-signup", async (req, res) => {
  const { tokenId } = req.body;
  try {
    const ticket = await googleAuthClient.verifyIdToken({
      idToken: tokenId,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified, given_name } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: "Google email not verified." });
    }

    let user = await User.findOne({ googleId });

    if (user && user.isPaid) {
      // User exists with Google ID and is paid, log them in
      const token = jwt.sign(
        { email: user.email, userId: user._id.toString(), isPaid: user.isPaid },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "24h" }
      );
      return res
        .status(200)
        .json({ message: "Google login successful!", token });
    }

    if (!user) {
      // No user with this googleId, check by email
      user = await User.findOne({ email });
      if (user) {
        // User exists with this email
        if (user.isPaid) {
          // Email is registered and paid, but not linked to this Google ID.
          // This could be a conflict. For now, error.
          return res.status(400).json({
            message:
              "This email is already registered. Please log in with your password or existing Google account.",
          });
        } else {
          // User exists with this email but is unpaid. Link Google ID.
          user.googleId = googleId;
          if (!user.username && (name || given_name)) {
            user.username = name || given_name;
          }
          // Ensure username uniqueness if updated
          if (user.isModified("username") || user.isModified("googleId")) {
            const existingUsernameCheck = await User.findOne({
              username: user.username,
              _id: { $ne: user._id },
            });
            if (existingUsernameCheck)
              user.username = `${user.username}_${Date.now()
                .toString()
                .slice(-4)}`;
            await user.save();
          }
        }
      } else {
        // New user via Google
        let newUsername = name || given_name || email.split("@")[0];
        const existingUsernameCheck = await User.findOne({
          username: newUsername,
        });
        if (existingUsernameCheck) {
          newUsername = `${newUsername}_${Date.now().toString().slice(-4)}`;
        }
        user = new User({
          googleId,
          email,
          username: newUsername,
          isPaid: false,
        });
        await user.save();
      }
    }
    // At this point, 'user' is either a new user, an existing unpaid user now linked with Google,
    // or an existing unpaid Google user. All need to pay.
    res.status(200).json({
      message: "Google authentication successful, payment required.",
      tempUserId: user._id.toString(),
      email: user.email,
      username: user.username,
      isPaid: false,
    });
  } catch (error) {
    console.error("Google initiate signup error:", error);
    res.status(500).json({
      message: "Google authentication failed.",
      error: error.toString(),
    });
  }
});

// NEW: Step 2 (All signups): Create Payment Session (replaces /create-payment-intent)
app.post("/create-payment-session", async (req, res) => {
  const { tempUserId, email } = req.body; // email is for Stripe customer

  if (!tempUserId || !email) {
    return res
      .status(400)
      .json({ message: "Temporary User ID and email are required." });
  }

  try {
    const user = await User.findById(tempUserId);
    if (!user || user.isPaid) {
      return res
        .status(404)
        .json({ message: "Valid unpaid user not found or already paid." });
    }

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: email,
        metadata: {
          userId: tempUserId, // Link Stripe customer to our temp user ID
        },
      });
      stripeCustomerId = customer.id;
      user.stripeCustomerId = stripeCustomerId; // Save it for later
      await user.save();
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1800, // $18.00 in cents
      currency: "usd",
      customer: stripeCustomerId,
      receipt_email: email,
      description: "Byte-Notes Lifetime Access - One Time Payment",
      metadata: {
        userId: tempUserId, // IMPORTANT: Link PaymentIntent to our temp user ID
      },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Error creating payment session:", error);
    res
      .status(500)
      .json({ message: "Error processing payment", error: error.message });
  }
});

// NEW: Step 3 (All signups): Complete Payment and Finalize Registration
// (replaces /register/complete and /auth/google/complete-payment)
app.post("/complete-payment", async (req, res) => {
  const {
    paymentIntentId,
    signupMethod,
    email,
    username,
    password,
    tempUserId: tempUserIdFromGoogleFlow,
  } = req.body;

  if (!paymentIntentId || !signupMethod) {
    return res
      .status(400)
      .json({ message: "Payment Intent ID and signup method are required." });
  }
  if (signupMethod === "email" && (!email || !username || !password)) {
    return res.status(400).json({
      message:
        "Email, username, and password are required for email signup completion.",
    });
  }
  if (signupMethod === "google" && !tempUserIdFromGoogleFlow) {
    return res.status(400).json({
      message: "Temporary User ID is required for Google signup completion.",
    });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ message: "Payment not successful." });
    }
    if (paymentIntent.amount !== 1800) {
      return res.status(400).json({ message: "Payment amount incorrect." });
    }

    const userIdFromPaymentMeta = paymentIntent.metadata.userId;
    if (!userIdFromPaymentMeta) {
      return res
        .status(400)
        .json({ message: "User ID missing from payment metadata." });
    }

    // For Google flow, ensure the tempUserId from client matches payment metadata
    if (
      signupMethod === "google" &&
      tempUserIdFromGoogleFlow !== userIdFromPaymentMeta
    ) {
      console.error(
        "Mismatch in tempUserId for Google flow:",
        tempUserIdFromGoogleFlow,
        userIdFromPaymentMeta
      );
      return res.status(400).json({
        message: "User ID mismatch during Google payment completion.",
      });
    }

    const user = await User.findById(userIdFromPaymentMeta);
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found for payment completion." });
    }
    if (user.isPaid) {
      // Should ideally not happen if logic is correct, but good to check.
      // If already paid, just generate token.
      const token = jwt.sign(
        { userId: user._id.toString(), email: user.email, isPaid: user.isPaid },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "24h" }
      );
      return res
        .status(200)
        .json({ message: "Account already active.", token });
    }

    // Finalize user based on signup method
    if (signupMethod === "email") {
      // Ensure the email and username from client match the preliminary user record
      if (user.email !== email || user.username !== username) {
        console.error(
          "Data mismatch for email user:",
          { dbEmail: user.email, clientEmail: email },
          { dbUser: user.username, clientUser: username }
        );
        return res.status(400).json({
          message: "User data mismatch during email payment completion.",
        });
      }
      user.password = await bcrypt.hash(password, 10);
    }
    // For Google signup, email, username, googleId are already set.

    user.isPaid = true;
    user.paymentDate = new Date();
    user.stripeCustomerId = paymentIntent.customer; // Ensure Stripe Customer ID is stored/updated.
    // user.status = 'active'; // If you use a status field

    await user.save();

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, isPaid: user.isPaid },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Payment successful and registration complete!",
      token,
    });
  } catch (error) {
    console.error("Error completing payment:", error);
    res
      .status(500)
      .json({ message: "Error completing payment", error: error.toString() });
  }
});

// Login endpoint (remains largely the same, but ensure it checks isPaid)
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and Password are required!" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // For users who might have initiated signup but not paid (e.g. email signup)
    // they won't have a password set yet.
    if (!user.password && !user.googleId) {
      // No password and not a Google user
      return res.status(401).json({
        message:
          "Account setup incomplete. Please complete payment or signup again.",
      });
    }
    // If it's a Google user trying to log in with email/password, and they never set one
    if (user.googleId && !user.password) {
      return res
        .status(401)
        .json({ message: "Please log in using your Google account." });
    }

    const isPasswordMatching = await bcrypt.compare(password, user.password);
    if (!isPasswordMatching) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    if (!user.isPaid) {
      // This case should ideally be handled by the signup flow redirecting to payment.
      // But if they try to log in directly:
      return res.status(403).json({
        message: "Account not activated. Payment required.",
        paymentRequired: true,
        tempUserId: user._id.toString(),
        email: user.email,
      });
    }

    const token = jwt.sign(
      { email: user.email, userId: user._id.toString(), isPaid: user.isPaid },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" }
    );
    res.status(200).json({ message: "Login successful!", token: token });
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json({ message: "Error logging in user", error: error.toString() });
  }
});

// GOOGLE AUTH ROUTE
app.post("/auth/google", async (req, res) => {
  const { tokenId } = req.body;
  try {
    const ticket = await googleAuthClient.verifyIdToken({
      idToken: tokenId,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const {
      sub: googleId,
      email,
      name,
      email_verified,
      given_name,
      family_name,
    } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: "Google email not verified." });
    }

    let user = await User.findOne({ googleId });
    let isNewUserOrUnpaid = false;

    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        // User exists with this email, link Google ID
        if (!user.googleId) user.googleId = googleId;
        if (!user.isPaid) isNewUserOrUnpaid = true;
        // Update username if not set and Google provides one
        if (!user.username && name) user.username = name;
        else if (!user.username && given_name) user.username = given_name;
        if (user.isModified("username")) {
          const existingUsername = await User.findOne({
            username: user.username,
            _id: { $ne: user._id },
          });
          if (existingUsername) {
            user.username = `${user.username}_${Date.now()
              .toString()
              .slice(-4)}`;
          }
        }
        await user.save();
      } else {
        // New user via Google
        isNewUserOrUnpaid = true;
        let newUsername = name || given_name || email.split("@")[0];
        const existingUsername = await User.findOne({ username: newUsername });
        if (existingUsername) {
          newUsername = `${newUsername}_${Date.now().toString().slice(-4)}`;
        }
        user = new User({
          googleId,
          email,
          username: newUsername,
          isPaid: false, // Will be set to true after payment
          // paymentDate will be set after payment
        });
        await user.save();
      }
    } else {
      // User found by googleId
      if (!user.isPaid) isNewUserOrUnpaid = true;
    }

    if (isNewUserOrUnpaid && !user.isPaid) {
      // Check user.isPaid again in case an existing user was already paid
      // User needs to pay
      return res.status(200).json({
        message: "Google authentication successful, payment required.",
        email: user.email,
        tempUserId: user._id.toString(), // Send temp ID to link payment
        isPaid: false,
        username: user.username, // Send username if available
      });
    }

    // User is already paid, generate JWT token
    const token = jwt.sign(
      { email: user.email, userId: user._id.toString(), isPaid: user.isPaid },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Google authentication successful!",
      token,
      user: {
        email: user.email,
        username: user.username,
        isPaid: user.isPaid,
        userId: user._id,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({
      message: "Google authentication failed.",
      error: error.toString(),
    });
  }
});

// Modify or create a new endpoint for completing Google registration after payment
// This is similar to /register/complete but might only need paymentIntentId and tempUserId
app.post("/auth/google/complete-payment", async (req, res) => {
  const { paymentIntentId, tempUserId, email, username } = req.body; // email and username might be needed if not stored with tempUserId

  console.log("Google complete payment request:", {
    paymentIntentId,
    tempUserId,
    email,
    username,
  });

  if (!paymentIntentId || !tempUserId) {
    return res
      .status(400)
      .json({ message: "Payment Intent ID and User ID are required." });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return res
        .status(400)
        .json({ message: "Payment not completed successfully." });
    }

    const user = await User.findById(tempUserId);
    if (!user) {
      // This case should ideally not happen if tempUserId is valid
      // Fallback: try to find by email if user somehow wasn't created with tempUserId
      // const userByEmail = await User.findOne({ email });
      // if (!userByEmail) return res.status(404).json({ message: "User not found." });
      // user = userByEmail;
      return res
        .status(404)
        .json({ message: "User not found with tempUserId." });
    }

    user.isPaid = true;
    user.paymentDate = new Date();
    user.stripeCustomerId = paymentIntent.customer; // Store Stripe Customer ID
    // Ensure username is set if it wasn't during initial Google auth step
    if (!user.username && username) user.username = username;
    else if (!user.username && paymentIntent.metadata.email)
      user.username = paymentIntent.metadata.email.split("@")[0];

    await user.save();

    const token = jwt.sign(
      { email: user.email, userId: user._id.toString(), isPaid: user.isPaid },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Google registration and payment successful!",
      token,
      user: {
        email: user.email,
        username: user.username,
        isPaid: user.isPaid,
        userId: user._id,
      },
    });
  } catch (error) {
    console.error("Error completing Google payment registration:", error);
    res.status(500).json({
      message: "Error completing registration after Google payment.",
      error: error.toString(),
    });
  }
});

// ... (existing middleware and routes)

// --- USER PROFILE AND SETTINGS ROUTES ---

// GET User Profile
app.get("/api/user/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("username email");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user profile",
      error: error.toString(),
    });
  }
});

// PUT Update Username
app.put("/api/user/update-username", auth, async (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "") {
    return res.status(400).json({ message: "Username cannot be empty" });
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { username: username.trim() },
      { new: true, runValidators: true }
    ).select("username email");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "Username updated successfully", user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating username", error: error.toString() });
  }
});

// PUT Change Password
app.put("/api/user/change-password", auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Current and new passwords are required" });
  }
  if (newPassword.length < 6) {
    // Consistent with client-side validation
    return res
      .status(400)
      .json({ message: "New password must be at least 6 characters long" });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordMatching = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordMatching) {
      return res.status(401).json({ message: "Incorrect current password" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error changing password", error: error.toString() });
  }
});

// DELETE User Account
app.delete("/api/user/delete-account", auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Delete user's notes
    await Note.deleteMany({ user: userId });

    // 2. Delete user's groups
    await Group.deleteMany({ user: userId });

    // 3. Delete user's files (from DB and potentially storage if not just DB)
    //    If files are stored on disk, you'd need to fs.unlink them here.
    //    The current setup stores file data in MongoDB.
    await File.deleteMany({ user: userId });

    // 4. Delete the user
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Optional: If you have Stripe customer IDs stored and want to delete them from Stripe:
    // if (deletedUser.stripeCustomerId) {
    //   try {
    //     await stripe.customers.del(deletedUser.stripeCustomerId);
    //   } catch (stripeError) {
    //     console.error("Error deleting Stripe customer:", stripeError);
    //     // Don't let Stripe error block account deletion, but log it.
    //   }
    // }

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res
      .status(500)
      .json({ message: "Error deleting account", error: error.toString() });
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
  let { title, content, canvasData } = req.body; // Add canvasData parameter

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
    // Create a new note to save in the database
    const newNote = new Note({
      title,
      content,
      canvasData, // Include canvasData field
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
  const { title, content, canvasData } = req.body; // Add canvasData parameter

  // Validate request data
  try {
    // Get the user's ID from the decoded token
    const userId = req.user.userId;
    // Find the note by id and update it
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      {
        // Only update fields that are provided in the request
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(canvasData !== undefined && { canvasData }),
      },
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

// File upload setup
const storage = multer.memoryStorage();

// Keep the existing multer setup with size limits
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

    const { originalname, mimetype, size, buffer } = req.file; // Use buffer instead of path
    const userId = req.user.userId;

    // Validate file size based on type
    const isImage = mimetype.startsWith("image/");
    const maxSize = isImage ? 5 * 1024 * 1024 : 16 * 1024 * 1024; // 5MB for images, 16MB for others

    if (size > maxSize) {
      return res.status(400).json({
        message: `File size exceeds the limit (${isImage ? "5MB" : "16MB"})`,
      });
    }

    // Create a new file document with file data in MongoDB
    const newFile = new File({
      user: userId,
      filename: originalname,
      contentType: mimetype,
      size: size,
      data: buffer, // Store the binary data directly in MongoDB
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
    res
      .status(500)
      .json({ message: "Error uploading file", error: error.toString() });
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

    // Send the binary data
    return res.send(file.data);
  } catch (error) {
    console.error("Error retrieving file:", error);
    res
      .status(500)
      .json({ message: "Error retrieving file", error: error.toString() });
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

// Endpoint to analyze math expressions
app.post("/api/analyze-math", auth, async (req, res) => {
  try {
    const { canvasData, noteId, variables = {} } = req.body;

    if (!canvasData) {
      return res.status(400).json({ message: "Canvas data is required" });
    }

    // Call the Gemini API for analysis
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Analyze this image for mathematical expressions. 
                Look for: 
                1. Equations with equals sign (=)
                2. Vertical calculations with numbers stacked and a line underneath (___ or ——)
                
                For vertical calculations like:
                8
                8+
                ___
                
                Interpret as 8+8=16.
                
                Return results as JSON array: 
                [{"expr": "expression", "result": value, "assign": boolean}]
                
                If variables are used, apply these values: ${JSON.stringify(
                  variables
                )}`,
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: canvasData.split(",")[1] || canvasData,
                },
              },
            ],
          },
        ],
        generation_config: { temperature: 0.1, max_output_tokens: 256 },
      }
    );

    // Parse response
    const responseText = response.data.candidates[0].content.parts[0].text;
    let results = [];

    try {
      // Try to extract JSON array from response
      const match = responseText.match(/\[.*\]/s);
      if (match) {
        results = JSON.parse(match[0]);
      }
    } catch (parseError) {
      console.error("Error parsing math results:", parseError);
      return res.status(500).json({ message: "Error parsing math results" });
    }

    // Update note if noteId is provided
    if (noteId) {
      // Extract variables from results
      const newVariables = { ...variables };
      results.forEach((result) => {
        if (result.assign && result.expr) {
          newVariables[result.expr] = result.result;
        }
      });

      await Note.findByIdAndUpdate(noteId, {
        lastCalculation: { results, timestamp: new Date() },
        variables: newVariables,
      });
    }

    res.status(200).json({ results, variables: newVariables });
  } catch (error) {
    console.error("Error analyzing math expression:", error);
    res.status(500).json({ message: "Error analyzing math expression" });
  }
});

// Endpoint to get/update note variables
app
  .route("/api/notes/:id/variables")
  .get(auth, async (req, res) => {
    try {
      const note = await Note.findOne({
        _id: req.params.id,
        user: req.user.userId,
      });

      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      res.status(200).json({ variables: note.variables || {} });
    } catch (error) {
      res.status(500).json({ message: "Error fetching variables" });
    }
  })
  .put(auth, async (req, res) => {
    try {
      const { variables } = req.body;

      if (!variables || typeof variables !== "object") {
        return res.status(400).json({ message: "Invalid variables format" });
      }

      const note = await Note.findOneAndUpdate(
        { _id: req.params.id, user: req.user.userId },
        { variables },
        { new: true }
      );

      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      res
        .status(200)
        .json({ message: "Variables updated", variables: note.variables });
    } catch (error) {
      res.status(500).json({ message: "Error updating variables" });
    }
  });

module.exports = { app, server };
