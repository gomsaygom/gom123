// models/Accommodation.js
const mongoose = require("mongoose");

const AccommodationSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true }, // 외부에서 쓰는 숙소 ID
    name: { type: String, required: true },             // 숙소 이름
    // 필요하면 필드 추가: address, phone, images, etc.
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Accommodation ||
  mongoose.model("Accommodation", AccommodationSchema);
