// models/Message.js
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    senderId: {
      type: String,   // 문자열로 고정
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "system"],
      default: "text",
    },
  },
  { timestamps: true }
);

// 이미 컴파일된 모델이 있으면 재사용 (OverwriteModelError 방지)
module.exports = mongoose.models.Message || mongoose.model("Message", MessageSchema);

MessageSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $exists: true } } }
);

