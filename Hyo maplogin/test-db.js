// test-db.js
const pool = require("./db");

async function test() {
  try {
    const [rows] = await pool.query("SELECT 1 AS test");
    console.log("✅ DB 연결 성공:", rows);
  } catch (err) {
    console.error("❌ DB 연결 실패:", err);
  } finally {
    process.exit();
  }
}

test();
