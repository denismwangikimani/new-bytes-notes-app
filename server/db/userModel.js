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
    unique: [true, "Username already exists!"],
  },
  password: {
    type: String,
    required: [true, "Please provide a Password!"],
    unique: false,
  },
  // New payment fields
  isPaid: { type: Boolean, default: false },
  paymentDate: { type: Date },
  stripeCustomerId: { type: String },
});

//export the user schema model
module.exports = mongoose.model.Users || mongoose.model("User", userSchema);
