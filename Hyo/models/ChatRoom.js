// models/ChatRoom.js
const mongoose = require("mongoose");

const chatRoomSchema = new mongoose.Schema(
  {
    // false = 숙소 단체방, true = DM (지금은 단체방만 사용)
    isDM: {
      type: Boolean,
      default: false,
    },

    // 숙소 ID (다른 백엔드의 숙소 PK, 예: 13)
    accommodationId: {
      type: Number,
      required: true,
    },

    // 방과 관련된 사용자 이메일 목록 (참고용)
    // ❗권한/입장 체크에 사용하지 않음
    participants: {
      type: [String],
      default: [], // 빈 배열 허용 (이전처럼 에러 안 나게)
    },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성
  }
);

// 숙소 하나당 단체 채팅방 1개 유지
// isDM=false 이고 accommodationId가 숫자일 때만 unique
chatRoomSchema.index(
  { isDM: 1, accommodationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDM: false,
      accommodationId: { $type: "number" },
    },
  }
);

// OverwriteModelError 방지
module.exports =
  mongoose.models.ChatRoom || mongoose.model("ChatRoom", chatRoomSchema);
