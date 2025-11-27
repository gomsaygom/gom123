// models/ChatRoom.js
const mongoose = require("mongoose");

const chatRoomSchema = new mongoose.Schema(
  {
    // 단체방/DM 구분
    isDM: { type: Boolean, default: false },

    // 단체방이면 숙소 ID 필요
    accommodationId: { type: Number },

    // 참여자 목록(표시/검색용). 이제 권한 판단엔 쓰지 않음 → 빈 배열 허용
    participants: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: [], // ✅ 빈 배열 허용
    },
  },
  { timestamps: true }
);

// "숙소별 단 하나의 단체방" 보장(단, isDM:false일 때만)
chatRoomSchema.index(
  { isDM: 1, accommodationId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDM: false, accommodationId: { $type: "number" } },
  }
);

module.exports =
  mongoose.models.ChatRoom || mongoose.model("ChatRoom", chatRoomSchema);
