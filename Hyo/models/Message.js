// models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // 어떤 방에 속한 메시지인지 (chatrooms._id 문자열)
    roomId: {
      type: String,
      required: true,
    },

    // 보낸 사람 (이메일 문자열 사용)
    senderId: {
      type: String,
      required: true,
    },

    // 실제 채팅 내용
    content: {
      type: String,
      required: true,
    },

    // 메시지 타입 (지금은 text만 사용)
    type: {
      type: String,
      default: "text",
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// OverwriteModelError 방지
module.exports =
  mongoose.models.Message || mongoose.model("Message", messageSchema);
