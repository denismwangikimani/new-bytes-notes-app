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
const router = express.Router();
const { GoogleGenAI } = require("@google/genai");
const { JWT_SECRET, GEMINI_API_KEY } = process.env;

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

// Middleware to parse JSON
app.use(express.json());

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
  const { title, content, canvasImage } = req.body;

  // Validate request data
  try {
    // Get the user's ID from the decoded token
    const userId = req.user.userId;
    // Find the note by id and update it
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { title, content, canvasImage },
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

app.post("/canvas-calculate", async (req, res) => {
  const { image, noteId, dict_of_vars = {} } = req.body;
  try {
    const genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Build the prompt exactly as in your Python code
    const dict_of_vars_str = JSON.stringify(dict_of_vars);
    const prompt = [
      {
        text:
          "You have been given an image with some mathematical expressions, equations, or graphical problems, and you need to solve them. " +
          "Note: Use the PEMDAS rule for solving mathematical expressions. PEMDAS stands for the Priority Order: Parentheses, Exponents, Multiplication and Division (from left to right), Addition and Subtraction (from left to right). Parentheses have the highest priority, followed by Exponents, then Multiplication and Division, and lastly Addition and Subtraction. " +
          "For example: " +
          "Q. 2 + 3 * 4 " +
          "(3 * 4) => 12, 2 + 12 = 14. " +
          "Q. 2 + 3 + 5 * 4 - 8 / 2 " +
          "5 * 4 => 20, 8 / 2 => 4, 2 + 3 => 5, 5 + 20 => 25, 25 - 4 => 21. " +
          "YOU CAN HAVE FIVE TYPES OF EQUATIONS/EXPRESSIONS IN THIS IMAGE, AND ONLY ONE CASE SHALL APPLY EVERY TIME: " +
          "Following are the cases: " +
          "1. Simple mathematical expressions like 2 + 2, 3 * 4, 5 / 6, 7 - 8, etc.: In this case, solve and return the answer in the format of a LIST OF ONE DICT [{'expr': given expression, 'result': calculated answer}]. " +
          "2. Set of Equations like x^2 + 2x + 1 = 0, 3y + 4x = 0, 5x^2 + 6y + 7 = 12, etc.: In this case, solve for the given variable, and the format should be a COMMA SEPARATED LIST OF DICTS, with dict 1 as {'expr': 'x', 'result': 2, 'assign': True} and dict 2 as {'expr': 'y', 'result': 5, 'assign': True}. This example assumes x was calculated as 2, and y as 5. Include as many dicts as there are variables. " +
          "3. Assigning values to variables like x = 4, y = 5, z = 6, etc.: In this case, assign values to variables and return another key in the dict called {'assign': True}, keeping the variable as 'expr' and the value as 'result' in the original dictionary. RETURN AS A LIST OF DICTS. " +
          "4. Analyzing Graphical Math problems, which are word problems represented in drawing form, such as cars colliding, trigonometric problems, problems on the Pythagorean theorem, adding runs from a cricket wagon wheel, etc. These will have a drawing representing some scenario and accompanying information with the image. PAY CLOSE ATTENTION TO DIFFERENT COLORS FOR THESE PROBLEMS. You need to return the answer in the format of a LIST OF ONE DICT [{'expr': given expression, 'result': calculated answer}]. " +
          "5. Detecting Abstract Concepts that a drawing might show, such as love, hate, jealousy, patriotism, or a historic reference to war, invention, discovery, quote, etc. USE THE SAME FORMAT AS OTHERS TO RETURN THE ANSWER, where 'expr' will be the explanation of the drawing, and 'result' will be the abstract concept. " +
          "IMPORTANT: If there are multiple equations or expressions, return each as a separate dictionary in the list. Do not combine them into a single expression. Leave enough vertical space between equations for best recognition." +
          "Analyze the equation or expression in this image and return the answer according to the given rules: " +
          "Make sure to use extra backslashes for escape characters like \\f -> \\\\f, \\n -> \\\\n, etc. " +
          `Here is a dictionary of user-assigned variables. If the given expression has any of these variables, use its actual value from this dictionary accordingly: ${dict_of_vars_str}. ` +
          "DO NOT USE BACKTICKS OR MARKDOWN FORMATTING. " +
          "PROPERLY QUOTE THE KEYS AND VALUES IN THE DICTIONARY FOR EASIER PARSING WITH Python's ast.literal_eval." +
          "For example, if you see '50 / 2', your answer should be '50/2=25'. " +
          "If there are multiple expressions, list each on a new line. " +
          "Use the PEMDAS rule for solving mathematical expressions. " +
          "DO NOT use JSON, backticks, or any other code formatting in your response. Just provide the plain text answer."
        },
    ];

    // Remove the data:image/png;base64, prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // Compose the Gemini contents array
    const contents = [
      ...prompt,
      {
        inlineData: {
          mimeType: "image/png",
          data: base64Data,
        },
      },
    ];

    // Call Gemini API
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    });

    // Extract the text from the response
    let responseText = "";
    if (result.response && typeof result.response.text === "function") {
      responseText = await result.response.text();
    } else if (result.candidates && result.candidates[0]?.content?.parts) {
      responseText = result.candidates[0].content.parts[0].text || "";
    } else {
      responseText = JSON.stringify(result);
    }

    // Optionally: Try to parse as JSON or Python dict if you want to process it further
    // For now, just return the raw text
    res.json({ result: responseText });
  } catch (err) {
    console.error("Gemini error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = app;
