//require mongoose
const mongoose = require("mongoose");

//create a new user schema
const userSchema = new mongoose.Schema({
  //we will require email, username and password for user registration
  email: {
    type: String,
    required: [true, "Please provide an Email!"],
    unique: [true, "Email already exists!"],
  },
  username: {
    type: String,
    required: [true, "Please provide a Username!"],
    // Consider if username should be unique if Google provides a name that might not be.
    // For simplicity, keeping it unique. You might need a strategy for duplicate names from Google.
    unique: [true, "Username already exists!"],
  },
  password: {
    type: String,
    // required: [true, "Please provide a Password!"], // No longer strictly required here
    unique: false,
  },
  googleId: { // Add this field
    type: String,
    unique: true,
    sparse: true, // Allows multiple documents to have null for this field
  },
  // New payment fields
  isPaid: { type: Boolean, default: false },
  paymentDate: { type: Date },
  stripeCustomerId: { type: String },
});

//export the user schema model
module.exports = mongoose.model.Users || mongoose.model("User", userSchema);