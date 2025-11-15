// models/Message.js
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    // 🔹 여기! 원래 Number였던 걸 String으로 바꿈
    senderId: {
      type: String, // 마리아DB user_id를 문자열로 저장
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);
