const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    contentType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    // New fields for disk storage
    storagePath: { type: String }, // Full path to file on disk
    diskFilename: { type: String }, // Generated filename on disk
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("File", fileSchema);
