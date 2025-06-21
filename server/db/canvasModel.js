const noteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: false, text: true },
    content: { type: String, required: false, text: true },
    canvasImage: { type: String, default: "" }, // <-- Add this line
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
  },
  {
    timestamps: true,
    indexes: [{ createdAt: 1 }, { updatedAt: 1 }],
  }
);
