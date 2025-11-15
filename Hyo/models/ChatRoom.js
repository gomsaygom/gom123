// models/ChatRoom.js
const mongoose = require("mongoose");

const ChatRoomSchema = new mongoose.Schema(
  {
    // 숙소 단체 채팅방이면 숙소 ID (MariaDB의 room_id 같은 것)
    accommodationId: {
      type: Number, // 이건 숙소 PK니까 Number로 놔둬도 됨
      required: false,
    },

    // DM인지 여부
    isDM: {
      type: Boolean,
      default: false,
    },

    // 참여자 ID 목록 (user_id 문자열로 저장)
    participants: [
      {
        type: String, // 🔹 Number → String 으로 변경
        required: true,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatRoom", ChatRoomSchema);
