const mysql = require('mysql2/promise');

// 1. DB 연결 설정 (본인 비번 필수!)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '1234ad', // ⬅️ 님의 비밀번호
    database: 'yanolja_service_db',
    port: 3307
};

// 실제 경주 숙소 20개 리스트 (기존 유지)
const realAccommodations = [
    { name: "라한셀렉트 경주", type: "호텔", type_id: 1, address: "경북 경주시 보문로 338", region: "보문단지" },
    { name: "힐튼 경주", type: "호텔", type_id: 1, address: "경북 경주시 보문로 484-7", region: "보문단지" },
    { name: "코오롱 호텔", type: "호텔", type_id: 1, address: "경북 경주시 불국로 289-17", region: "불국사" },
    { name: "더케이호텔 경주", type: "호텔", type_id: 1, address: "경북 경주시 엑스포로 45", region: "보문단지" },
    { name: "코모도호텔 경주", type: "호텔", type_id: 1, address: "경북 경주시 보문로 422", region: "보문단지" },
    { name: "황남관 한옥호텔", type: "펜션/풀빌라", type_id: 2, address: "경북 경주시 포석로 1038", region: "황리단길" },
    { name: "락고재 경주", type: "펜션/풀빌라", type_id: 2, address: "경북 경주시 포석로 1024-1", region: "황리단길" },
    { name: "소담정", type: "펜션/풀빌라", type_id: 2, address: "경북 경주시 첨성로81번길 22-2", region: "황리단길" },
    { name: "켄싱턴리조트 경주", type: "리조트/콘도", type_id: 3, address: "경북 경주시 보문로 182-29", region: "보문단지" },
    { name: "한화리조트 경주", type: "리조트/콘도", type_id: 3, address: "경북 경주시 보문로 182-27", region: "보문단지" },
    { name: "블루원 리조트", type: "리조트/콘도", type_id: 3, address: "경북 경주시 보불로 391", region: "불국사" },
    { name: "경주 지지관광호텔", type: "호텔", type_id: 1, address: "경북 경주시 태종로 699번길 3", region: "시내" },
    { name: "리버틴 호텔 경주", type: "호텔", type_id: 1, address: "경북 경주시 태종로 681-15", region: "시내" },
    { name: "슈가호텔", type: "모텔", type_id: 1, address: "경북 경주시 태종로 699번길 12", region: "시내" },
    { name: "141 미니호텔", type: "호텔", type_id: 1, address: "경북 경주시 원효로 141", region: "시내" },
    { name: "도란도란 게스트하우스", type: "펜션/풀빌라", type_id: 2, address: "경북 경주시 포석로 1036", region: "황리단길" },
    { name: "경주 한옥 1번가", type: "펜션/풀빌라", type_id: 2, address: "경북 경주시 포석로 1068", region: "황리단길" },
    { name: "신라 부티크 호텔", type: "호텔", type_id: 1, address: "경북 경주시 강변로 200", region: "터미널" },
    { name: "메이슨 미니호텔", type: "호텔", type_id: 1, address: "경북 경주시 금성로 240", region: "터미널" },
    { name: "경주 파크 관광호텔", type: "호텔", type_id: 1, address: "경북 경주시 북군길 9", region: "보문단지" }
];

// 방 이름 생성기 (숙소 타입에 따라 다르게!)
const roomNames = {
    "호텔": ["스탠다드 더블", "스탠다드 트윈", "디럭스 더블", "디럭스 트윈", "이그제큐티브 스위트", "프레지덴셜 스위트"],
    "펜션/풀빌라": ["별님방 (2인)", "달님방 (2인)", "해님방 (4인)", "사랑채 (독채)", "행복채 (풀빌라)", "하늘채 (복층)"],
    "리조트/콘도": ["패밀리 A타입 (18평)", "패밀리 B타입 (24평)", "로얄 스위트 (30평)", "프리미어 룸", "오션뷰 스위트"],
    "모텔": ["일반실", "특실", "VIP실", "게임룸 (PC 2대)", "파티룸"]
};

function getRandomCoord() {
    const lat = 35.83 + (Math.random() * 0.05);
    const lng = 129.20 + (Math.random() * 0.10);
    return { lat, lng };
}

function getRandomImage(index) {
    return `https://source.unsplash.com/random/800x600/?hotel,room,building&sig=${index}`;
}

async function seed() {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        console.log("🚀 데이터 초기화 및 생성을 시작합니다...");

        // 1. 기존 데이터 싹 지우기 (순서 중요! 자식부터 삭제)
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('TRUNCATE TABLE roomtype');
        await conn.query('TRUNCATE TABLE review');
        await conn.query('TRUNCATE TABLE reservation');
        await conn.query('TRUNCATE TABLE recently_viewed');
        await conn.query('TRUNCATE TABLE accommodation');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log("🧹 기존 데이터 삭제 완료!");

        // 2. 숙소 100개 생성
        for (let i = 0; i < 100; i++) {
            let name, address, type, type_id, region, desc;
            
            if (i < realAccommodations.length) {
                const real = realAccommodations[i];
                name = real.name;
                address = real.address;
                type = real.type;
                type_id = real.type_id;
                region = real.region;
                desc = `경주 ${region}에 위치한 ${name}입니다. 최고의 휴식을 제공합니다.`;
            } else {
                const regions = ["황리단길", "보문단지", "불국사", "감포", "시내"];
                const types = [
                    { t: "호텔", id: 1 }, { t: "펜션/풀빌라", id: 2 }, { t: "리조트/콘도", id: 3 }
                ];
                const nouns = ["스테이", "호텔", "펜션", "풀빌라", "하우스", "궁", "장"];
                const adjs = ["아름다운", "행복한", "경주", "신라", "황금", "달빛", "별빛"];
                
                const randomRegion = regions[Math.floor(Math.random() * regions.length)];
                const randomType = types[Math.floor(Math.random() * types.length)];
                const randomAdj = adjs[Math.floor(Math.random() * adjs.length)];
                const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

                name = `${randomAdj} ${randomNoun} ${i}`;
                address = `경상북도 경주시 ${randomRegion} ${Math.floor(Math.random() * 1000)}번길`;
                type = randomType.t;
                type_id = randomType.id;
                region = randomRegion;
                desc = `${randomRegion}의 낭만을 즐길 수 있는 숙소입니다.`;
            }

            const { lat, lng } = getRandomCoord();
            const imageUrl = getRandomImage(i);

            const sql = `
                INSERT INTO accommodation 
                (owner_user_id, type_id, name, address, region_city, type, latitude, longitude, rating, review_count, main_image_url, description, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1)
            `;
            
            await conn.query(sql, [1, type_id, name, address, region, type, lat, lng, imageUrl, desc]);
        }
        console.log("✅ 숙소 100개 건물 짓기 완료!");

        // 3. 객실(Room) 생성 - 숙소당 3~6개씩 랜덤 생성!
        console.log("🛏️ 객실 인테리어 공사 중...");
        
        const [accommodations] = await conn.query('SELECT accommodation_id, type FROM accommodation');
        
        for (const acc of accommodations) {
            // 숙소 타입에 맞는 방 이름 목록 가져오기 (없으면 호텔 거 씀)
            const names = roomNames[acc.type] || roomNames["호텔"];
            
            // 방 개수 랜덤 (3개 ~ 6개)
            const roomCount = Math.floor(Math.random() * 4) + 3; 

            for (let j = 0; j < roomCount; j++) {
                // 이름 순서대로 가져오기 (없으면 '랜덤룸')
                const rName = names[j] || `스페셜 룸 ${j}`;
                
                // 가격: 방이 좋아질수록(j가 커질수록) 비싸짐
                const price = 50000 + (j * 30000) + (Math.floor(Math.random() * 10) * 1000);
                
                // 인원: 기본 2명 + 방 커지면 추가
                const capacity = 2 + Math.floor(j / 2); 

                await conn.query(`
                    INSERT INTO roomtype 
                    (accommodation_id, name, base_price_per_night, base_capacity, max_capacity, max_people, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                `, [acc.accommodation_id, rName, price, capacity, capacity + 2, capacity + 2]);
            }
        }

        console.log("🎉 모든 숙소와 객실 생성 완료!");

    } catch (err) {
        console.error("❌ 에러 발생:", err);
    } finally {
        conn.end();
    }
}

seed();