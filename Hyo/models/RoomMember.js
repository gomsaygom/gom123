// models/RoomMember.js
const mongoose = require("mongoose");

const RoomMemberSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: String, required: true, index: true },         // 이메일 소문자 권장
    accommodationId: { type: Number, required: true, index: true }, // 숙소 단체/DM 구분 보조
    expiresAt: { type: Date, required: true },                      // 체크아웃 시각(UTC)
  },
  { timestamps: true }
);

// TTL: 만료 시 자동 삭제(최대 ~60초 지연 가능)
RoomMemberSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// 중복 방지: 같은 방에 같은 유저 한 번만
RoomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });

module.exports =
  mongoose.models.RoomMember || mongoose.model("RoomMember", RoomMemberSchema);
