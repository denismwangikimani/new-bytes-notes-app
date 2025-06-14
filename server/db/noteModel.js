const mongoose = require("mongoose");

// Create a schema for the note model, that will have a user, title, content, createdAt
const noteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: false,
      text: true,
    },
    content: {
      type: String,
      required: false,
      text: true,
    },
    canvasData: {
      type: String,
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    canvasData: {
      type: String,
      required: false,
    },
    lastCalculation: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    variables: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      required: false,
    },
  },
  {
    timestamps: true,
    indexes: [{ createdAt: 1 }, { updatedAt: 1 }],
  }
);

module.exports = mongoose.model("Note", noteSchema);
