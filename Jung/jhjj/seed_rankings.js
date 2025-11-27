const mysql = require('mysql2/promise');

// 1. DB 연결 설정 (본인 환경에 맞게 수정!)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '1234ad', 
    database: 'yanolja_service_db',
    port: 3307
};

// 💬 좋은 리뷰 멘트 (실제 숙소용)
const goodReviews = [
    "뷰가 정말 환상적이네요. 인생 숙소 등극!",
    "직원분들이 너무 친절해서 감동했습니다.",
    "청결 상태가 완벽해요. 먼지 하나 없네요.",
    "침구가 너무 편해서 꿀잠 잤습니다.",
    "조식이 맛있고 종류도 다양해서 좋았어요.",
    "위치가 좋아서 관광지 다니기 너무 편했습니다.",
    "부모님 모시고 왔는데 정말 좋아하셨어요.",
    "사진보다 실물이 훨씬 예쁜 숙소입니다."
];

// 💬 평범/나쁜 리뷰 멘트 (가상 숙소용)
const normalReviews = [
    "나쁘지 않았지만 가격 대비 조금 아쉬워요.",
    "위치는 좋은데 방음이 좀 안 되네요.",
    "그냥 잠만 자기에는 괜찮은 곳입니다.",
    "청소가 조금 미흡한 부분이 있었어요.",
    "주차 공간이 협소해서 불편했습니다.",
    "사진이랑 방 크기가 좀 다른 것 같아요.",
    "쏘쏘합니다. 급하게 예약한 것 치고는...",
    "재방문 의사는 글쎄요..."
];

async function seedRankings() {
    const conn = await mysql.createConnection(dbConfig);

    try {
        console.log("🚀 랭킹 및 리뷰 데이터 튜닝 시작...");

        // 1. 기존 데이터 초기화 (깨끗하게 새로 만들기)
        await conn.query('TRUNCATE TABLE review');
        await conn.query('TRUNCATE TABLE reservation');
        // (주의: recently_viewed는 건드리지 않음)
        
        console.log("🧹 기존 예약/리뷰 삭제 완료. 데이터 생성을 시작합니다.");

        // 2. 숙소 목록 가져오기
        const [accommodations] = await conn.query('SELECT accommodation_id FROM accommodation');

        for (const acc of accommodations) {
            const accId = acc.accommodation_id;
            
            // ★ 핵심 로직: 1~20번(실제 숙소) vs 나머지(가상 숙소) 차별 대우
            const isReal = accId <= 20; 

            let reservationCount, reviewCount;

            if (isReal) {
                // 🏅 실제 숙소: 예약 50~100개, 리뷰 20~40개 (인기 폭발!)
                reservationCount = Math.floor(50 + Math.random() * 50);
                reviewCount = Math.floor(20 + Math.random() * 20);
            } else {
                // 💩 가상 숙소: 예약 0~5개, 리뷰 0~5개 (파리 날림...)
                reservationCount = Math.floor(Math.random() * 6);
                reviewCount = Math.floor(Math.random() * 6);
            }

            // -------------------------------------------------------
            // [A] 예약 데이터 생성 (인기 순위 결정)
            // -------------------------------------------------------
            // 예약이 많아야 '/recommend/popular'에서 상위에 뜸
            for (let i = 0; i < reservationCount; i++) {
                // 해당 숙소의 방 아무거나 하나 가져오기
                const [rooms] = await conn.query('SELECT room_type_id, base_price_per_night FROM roomtype WHERE accommodation_id = ? LIMIT 1', [accId]);
                
                if (rooms.length > 0) {
                    const room = rooms[0];
                    // 예약 생성 (CONFIRMED 상태여야 집계됨)
                    await conn.query(`
                        INSERT INTO reservation (user_id, room_type_id, checkin_date, checkout_date, total_price, status)
                        VALUES (1, ?, NOW(), NOW(), ?, 'CONFIRMED')
                    `, [room.room_type_id, room.base_price_per_night]);
                }
            }

            // -------------------------------------------------------
            // [B] 리뷰 데이터 생성 (평점 결정)
            // -------------------------------------------------------
            let totalRating = 0;

            for (let i = 0; i < reviewCount; i++) {
                let rating, content;

                if (isReal) {
                    // 실제 숙소: 4점 ~ 5점 (대부분 5점)
                    rating = Math.random() > 0.3 ? 5 : 4; 
                    content = goodReviews[Math.floor(Math.random() * goodReviews.length)];
                } else {
                    // 가상 숙소: 1점 ~ 4점 (랜덤)
                    rating = Math.floor(1 + Math.random() * 4);
                    content = normalReviews[Math.floor(Math.random() * normalReviews.length)];
                }

                // 날짜는 최근 100일 이내 랜덤
                const randDate = new Date(Date.now() - Math.floor(Math.random() * 10000000000));

                await conn.query(`
                    INSERT INTO review (user_id, accommodation_id, rating, content, created_at)
                    VALUES (1, ?, ?, ?, ?)
                `, [accId, rating, content, randDate]);

                totalRating += rating;
            }

            // -------------------------------------------------------
            // [C] 숙소 테이블 정보(평점, 리뷰수) 업데이트
            // -------------------------------------------------------
            let avgRating = 0;
            if (reviewCount > 0) {
                avgRating = (totalRating / reviewCount).toFixed(1); // 소수점 1자리
            }

            await conn.query(`
                UPDATE accommodation 
                SET review_count = ?, rating = ?
                WHERE accommodation_id = ?
            `, [reviewCount, avgRating, accId]);

            // 진행 상황 표시 (......)
            process.stdout.write(".");
        }

        console.log("\n\n🎉 [완료] 예약/리뷰 데이터 튜닝 끝!");
        console.log("✅ 1~20번 숙소: 예약 많음 / 평점 4.5 이상");
        console.log("✅ 나머지 숙소: 예약 적음 / 평점 낮음");

    } catch (err) {
        console.error("❌ 에러 발생:", err);
    } finally {
        conn.end();
    }
}

seedRankings();