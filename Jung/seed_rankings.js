const mysql = require('mysql2/promise');

// 1. DB 연결 설정 (본인 비번 확인!)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '1234ad', // ⬅️ 님의 비밀번호
    database: 'yanolja_service_db',
    port: 3307
};

// 👥 실제 사람 이름 리스트 (50명)
const realNames = [
    "김민수", "이지은", "박서준", "최유리", "정호석",
    "강동원", "송혜교", "현빈", "손예진", "공유",
    "김태리", "유재석", "강호동", "신동엽", "박나래",
    "장도연", "이수근", "김희철", "민경훈", "서장훈",
    "이상민", "김종국", "송지효", "하동훈", "지석진",
    "양세찬", "전소민", "이광수", "박보검", "김유정",
    "차은우", "황민현", "강다니엘", "옹성우", "김재환",
    "박지훈", "박우진", "배진영", "이대휘", "라이관린",
    "윤두준", "이기광", "양요섭", "손동운", "용준형",
    "김남준", "김석진", "민윤기", "정호석", "박지민"
];

// 👍 좋은 리뷰 모음 (4~5점용)
const goodReviews = [
    "인생 최고의 숙소였습니다. 창밖으로 보이는 뷰가 정말 환상적이에요!",
    "직원분들이 너무 친절하고 방도 먼지 하나 없이 깨끗했어요.",
    "부모님 모시고 갔는데 대만족하셨습니다. 효도 여행 성공했네요.",
    "침구가 너무 푹신해서 꿀잠 잤습니다. 매트리스 어디 건지 물어보고 싶을 정도예요.",
    "조식이 정말 맛있었습니다. 종류도 많고 신선해서 아침부터 과식했네요.",
    "위치가 진짜 대박입니다. 황리단길이랑 가까워서 걸어 다니기 딱 좋아요.",
    "방이 사진보다 훨씬 넓고 쾌적했어요. 청소 상태 100점 드립니다.",
    "어메니티 향이 너무 좋아요. 사소한 부분까지 신경 쓴 게 느껴집니다.",
    "수영장 물도 따뜻하고 관리도 잘 되어 있어서 아이들이랑 놀기 좋았습니다.",
    "방음이 잘 돼서 조용하게 쉬다 왔습니다. 힐링 그 자체네요.",
    "재방문 의사 200%입니다. 다음 경주 여행 때도 무조건 여기로 올 거예요.",
    "주차 공간이 넓어서 편했습니다. 초보 운전인데도 걱정 없었어요.",
    "인테리어가 감성적이라 사진 찍기 너무 좋아요. 인생샷 많이 건졌습니다.",
    "웰컴 드링크도 주시고 서비스가 5성급 호텔 못지않네요.",
    "난방이 잘 돼서 따뜻하게 잤습니다. 겨울 여행 숙소로 강추합니다."
];

// 😐 보통 리뷰 모음 (3~4점용)
const normalReviews = [
    "전반적으로 나쁘지 않았지만, 가격 대비 조금 아쉬운 느낌입니다.",
    "위치는 좋은데 시설이 조금 노후된 느낌이 있어요. 관리가 필요해 보입니다.",
    "방음이 조금 아쉽네요. 복도에서 사람들 지나가는 소리가 들려요.",
    "주차장이 협소해서 늦게 오면 자리가 없을 수도 있습니다.",
    "청소 상태는 깔끔한데 방이 생각보다 좁았어요. 잠만 자기엔 괜찮습니다.",
    "조식은 그럭저럭 먹을만했습니다. 특별하진 않고 무난해요.",
    "엘리베이터가 좀 느려서 기다리는 시간이 길었어요.",
    "수압이 약해서 씻는데 조금 불편했습니다. 개선되었으면 좋겠네요.",
    "직원분들은 친절한데 체크인 시간이 너무 오래 걸렸어요.",
    "뷰는 주차장 뷰라 아쉬웠지만, 룸 컨디션은 좋았습니다.",
    "에어컨 소음이 좀 있어서 예민하신 분들은 힘들 수도 있어요.",
    "그냥 무난무난한 숙소입니다. 큰 기대 없이 가면 만족할 듯."
];

async function seedRankings() {
    const conn = await mysql.createConnection(dbConfig);

    try {
        console.log("🚀 데이터 튜닝을 시작합니다...");
        
        // 1. 기존 리뷰와 예약 데이터 초기화
        await conn.query('TRUNCATE TABLE review');
        await conn.query('TRUNCATE TABLE reservation');
        console.log("✅ 기존 리뷰/예약 데이터 삭제 완료");

        // 2. 가짜 유저 50명 생성하기 (실명 버전)
        console.log("👤 가짜 유저 50명 생성 중...");
        const userIds = [];
        
        for (let i = 0; i < realNames.length; i++) {
            const email = `user${i + 100}@test.com`; // 이메일은 user100, user101...
            const name = realNames[i]; // 이름은 김철수, 이영희...
            
            // 유저 생성
            await conn.query(`
                INSERT IGNORE INTO users (email, password, name, phone, role_code)
                VALUES (?, '1234', ?, '010-1234-5678', 'CUSTOMER')
            `, [email, name]);

            // 방금 만든 유저의 ID 가져오기
            const [rows] = await conn.query('SELECT user_id FROM users WHERE email = ?', [email]);
            if (rows.length > 0) {
                userIds.push(rows[0].user_id);
            }
        }
        console.log(`✅ 가짜 유저 ${userIds.length}명 (실명) 준비 완료!`);


        // 3. 숙소 목록 가져오기
        const [accommodations] = await conn.query('SELECT accommodation_id FROM accommodation');

        // 4. 리뷰 및 예약 데이터 생성
        for (const acc of accommodations) {
            const accId = acc.accommodation_id;
            const isRealHotel = accId <= 20; 

            let reviewCount, reservationCount;
            
            if (isRealHotel) {
                reservationCount = Math.floor(100 + Math.random() * 100); 
                reviewCount = Math.floor(30 + Math.random() * 20);        
            } else {
                reservationCount = Math.floor(Math.random() * 20);        
                reviewCount = Math.floor(Math.random() * 5);              
            }

            // A. 예약 데이터 생성
            for (let i = 0; i < reservationCount; i++) {
                const [rooms] = await conn.query('SELECT room_type_id, base_price_per_night FROM roomtype WHERE accommodation_id = ? LIMIT 1', [accId]);
                if (rooms.length > 0) {
                    const room = rooms[0];
                    const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
                    
                    await conn.query(`
                        INSERT INTO reservation (user_id, room_type_id, checkin_date, checkout_date, total_price, status)
                        VALUES (?, ?, NOW(), NOW(), ?, 'CONFIRMED')
                    `, [randomUserId, room.room_type_id, room.base_price_per_night]);
                }
            }

            // B. 리뷰 데이터 생성 (유저 랜덤 배정!)
            let totalRating = 0;

            for (let i = 0; i < reviewCount; i++) {
                let rating, content;
                const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];

                if (isRealHotel) {
                    rating = Math.random() < 0.8 ? 5 : 4;
                    content = goodReviews[Math.floor(Math.random() * goodReviews.length)];
                } else {
                    rating = Math.floor(3 + Math.random() * 3);
                    if (rating >= 4) {
                        content = goodReviews[Math.floor(Math.random() * goodReviews.length)];
                    } else {
                        content = normalReviews[Math.floor(Math.random() * normalReviews.length)];
                    }
                }

                const randDate = new Date(Date.now() - Math.floor(Math.random() * 10000000000));

                await conn.query(`
                    INSERT INTO review (user_id, accommodation_id, rating, content, created_at)
                    VALUES (?, ?, ?, ?, ?)
                `, [randomUserId, accId, rating, content, randDate]);

                totalRating += rating;
            }

            // C. 평점 업데이트
            let avgRating = 0;
            if (reviewCount > 0) {
                avgRating = (totalRating / reviewCount).toFixed(1);
            }

            await conn.query(`
                UPDATE accommodation 
                SET review_count = ?, rating = ?
                WHERE accommodation_id = ?
            `, [reviewCount, avgRating, accId]);

            process.stdout.write(isRealHotel ? "★" : ".");
        }

        console.log("\n\n🎉 모든 작업 완료! 리뷰 작성자가 실명으로 변경되었습니다.");

    } catch (err) {
        console.error("❌ 에러 발생:", err);
    } finally {
        conn.end();
    }
}

seedRankings();