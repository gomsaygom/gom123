const mysql = require('mysql2/promise');

// 1. DB 연결 설정
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '1234ad', // ⬅️ 님의 비밀번호
    database: 'yanolja_service_db',
    port: 3307
};

async function seedTags() {
    const conn = await mysql.createConnection(dbConfig);

    try {
        console.log("🚀 객실에 태그 붙이기 작업을 시작합니다...");

        // 1. 기존 태그 연결 정보 초기화 (중복 방지)
        await conn.query('TRUNCATE TABLE roomtypetag');
        console.log("🧹 기존 태그 연결 삭제 완료");

        // 2. 모든 태그 목록 가져오기
        const [tags] = await conn.query('SELECT tag_id, name FROM tag');
        if (tags.length === 0) {
            console.log("❌ 태그가 하나도 없습니다! 먼저 태그를 INSERT 해주세요.");
            return;
        }

        // 3. 모든 객실 목록 가져오기
        const [rooms] = await conn.query('SELECT room_type_id FROM roomtype');
        console.log(`📊 총 ${rooms.length}개의 객실을 찾았습니다.`);

        // 4. 각 객실마다 랜덤 태그 2~5개씩 붙이기
        let totalLinks = 0;

        for (const room of rooms) {
            // 태그 목록을 무작위로 섞음
            const shuffledTags = tags.sort(() => 0.5 - Math.random());
            
            // 앞에서부터 2개 ~ 5개 선택
            const tagCount = Math.floor(2 + Math.random() * 4); 
            const selectedTags = shuffledTags.slice(0, tagCount);

            for (const tag of selectedTags) {
                await conn.query(`
                    INSERT INTO roomtypetag (room_type_id, tag_id)
                    VALUES (?, ?)
                `, [room.room_type_id, tag.tag_id]);
                totalLinks++;
            }
        }

        console.log(`🎉 작업 완료! 총 ${totalLinks}개의 태그가 객실에 연결되었습니다.`);

    } catch (err) {
        console.error("❌ 에러 발생:", err);
    } finally {
        conn.end();
    }
}

seedTags();