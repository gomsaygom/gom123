// models/ChatRoom.js
const mongoose = require("mongoose");

const ChatRoomSchema = new mongoose.Schema(
  {
    isDM: { type: Boolean, default: false },
    accommodationId: { type: Number }, // 단체방일 때만 사용
    participants: {
      type: [String],  // 문자열 배열
      required: true,
      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.length > 0 &&
          arr.every(v => typeof v === "string" && v.trim() !== ""),
        message: "participants 배열은 비어있을 수 없고, 빈 문자열을 포함할 수 없습니다.",
      },
    },
  },
  { timestamps: true }
);

// 이미 컴파일된 모델이 있으면 재사용
module.exports = mongoose.models.ChatRoom || mongoose.model("ChatRoom", ChatRoomSchema);

// ... 기존 스키마 정의 위/아래 어디든 인덱스 정의만 추가하면 됨
ChatRoomSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { isDM: true, expiresAt: { $exists: true } } }
);

