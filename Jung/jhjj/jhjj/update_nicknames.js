const mysql = require('mysql2/promise');

// 1. DB 연결 설정 (본인 환경에 맞게 수정 필수!)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '1234ad', // ⬅️ 님의 비밀번호
    database: 'yanolja_service_db',
    port: 3307
};

// 2. 닉네임에 사용할 접두사/접미사 목록
const adjectives = ['여행하는', '행복한', '달콤한', '경주러', '스마일', '꿀잠', '맛집'];
const nouns = ['탐험가', '고수', '방랑자', '요정', '투어'];

function generateNickname(userId, adjective, noun) {
    // [규칙] '형용사 + 명사 + 유저ID' 형태로 닉네임을 생성합니다. (예: 행복한탐험가_12)
    return `${adjective}${noun}`;
}

async function updateAllNicknames() {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        console.log("🚀 기존 사용자 닉네임 업데이트를 시작합니다...");

        // 1. 모든 사용자 ID와 이름을 가져옵니다.
        const [users] = await conn.query('SELECT user_id, name FROM users');
        
        if (users.length === 0) {
            console.log("❌ DB에 업데이트할 사용자가 없습니다. users 테이블을 먼저 확인하세요.");
            return;
        }

        console.log(`📊 총 ${users.length}명의 사용자 닉네임 생성 중...`);
        let updatedCount = 0;

        for (const user of users) {
            const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
            const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
            
            // 2. 새로운 닉네임 생성 (ID를 붙여서 중복을 확실히 방지)
            const newNickname = generateNickname(user.user_id, randomAdj, randomNoun);

            // 3. DB 업데이트
            await conn.query(
                'UPDATE users SET nickname = ? WHERE user_id = ?',
                [newNickname, user.user_id]
            );
            updatedCount++;
        }

        console.log(`✅ 닉네임 업데이트 완료! ${updatedCount}개 행이 수정되었습니다.`);

    } catch (err) {
        console.error("❌ 닉네임 업데이트 중 에러 발생:", err);
    } finally {
        conn.end();
    }
}

updateAllNicknames();