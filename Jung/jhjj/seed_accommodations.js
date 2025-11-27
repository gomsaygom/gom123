const mysql = require('mysql2/promise');

// 1. DB 연결 설정 (비밀번호 확인!)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '1234ad', // ⬅️ 님의 비밀번호
    database: 'yanolja_service_db',
    port: 3307
};

// 2. 실제 경주 유명 숙소 리스트 (20개) - 유형을 5가지 중 하나로 매핑
const realAccommodations = [
    { name: "라한셀렉트 경주", type: "호텔", address: "경북 경주시 보문로 338", region: "보문단지" },
    { name: "힐튼 경주", type: "호텔", address: "경북 경주시 보문로 484-7", region: "보문단지" },
    { name: "코오롱 호텔", type: "호텔", address: "경북 경주시 불국로 289-17", region: "불국사" },
    { name: "더케이호텔 경주", type: "호텔", address: "경북 경주시 엑스포로 45", region: "보문단지" },
    { name: "코모도호텔 경주", type: "호텔", address: "경북 경주시 보문로 422", region: "보문단지" },
    { name: "황남관 한옥호텔", type: "한옥", address: "경북 경주시 포석로 1038", region: "황리단길" },
    { name: "락고재 경주", type: "한옥", address: "경북 경주시 포석로 1024-1", region: "황리단길" },
    { name: "소담정", type: "한옥", address: "경북 경주시 첨성로81번길 22-2", region: "황리단길" },
    { name: "경주 한옥 1번가", type: "한옥", address: "경북 경주시 포석로 1068", region: "황리단길" },
    { name: "도란도란 게스트하우스", type: "한옥", address: "경북 경주시 포석로 1036", region: "황리단길" },
    { name: "켄싱턴리조트 경주", type: "호텔", address: "경북 경주시 보문로 182-29", region: "보문단지" }, // 리조트->호텔로 분류
    { name: "한화리조트 경주", type: "호텔", address: "경북 경주시 보문로 182-27", region: "보문단지" },
    { name: "블루원 리조트", type: "풀빌라", address: "경북 경주시 보불로 391", region: "불국사" }, // 풀빌라로 분류
    { name: "경주 지지관광호텔", type: "호텔", address: "경북 경주시 태종로 699번길 3", region: "시내" },
    { name: "리버틴 호텔 경주", type: "호텔", address: "경북 경주시 태종로 681-15", region: "시내" },
    { name: "슈가호텔", type: "호텔", address: "경북 경주시 태종로 699번길 12", region: "시내" },
    { name: "141 미니호텔", type: "호텔", address: "경북 경주시 원효로 141", region: "시내" },
    { name: "신라 부티크 호텔", type: "호텔", address: "경북 경주시 강변로 200", region: "터미널" },
    { name: "메이슨 미니호텔", type: "호텔", address: "경북 경주시 금성로 240", region: "터미널" },
    { name: "경주 파크 관광호텔", type: "호텔", address: "경북 경주시 북군길 9", region: "보문단지" }
];

// 3. 가상 숙소 생성용 설정 (5개 유형)
const targetTypes = ['호텔', '글램핑', '펜션', '한옥', '풀빌라'];

// 방 이름 생성기
const roomNames = {
    "호텔": ["스탠다드 더블", "스탠다드 트윈", "디럭스 더블", "스위트룸"],
    "글램핑": ["감성 텐트", "럭셔리 글램핑", "카라반 A타입", "카라반 B타입"],
    "펜션": ["커플룸 (2인)", "가족룸 (4인)", "단체룸 (MT용)", "복층형 독채"],
    "한옥": ["사랑채 (온돌)", "별채 (침대)", "안채 (가족)", "누마루 스위트"],
    "풀빌라": ["프라이빗 풀빌라 A", "오션뷰 풀빌라 B", "키즈 풀빌라", "루프탑 풀빌라"]
};

// 랜덤 좌표 및 이미지 함수 (이전과 동일)
function getRandomCoord() {
    const lat = 35.83 + (Math.random() * 0.05);
    const lng = 129.20 + (Math.random() * 0.10);
    return { lat, lng };
}

// 유형별 키워드 매칭 함수
function getSearchKeyword(type) {
    if (type === '한옥') return 'hanok, traditional house';
    if (type === '글램핑') return 'glamping, camping tent';
    if (type === '풀빌라') return 'pool villa, luxury pool';
    if (type === '펜션') return 'vacation house, cottage';
    return 'hotel room, building'; // 호텔
}

function getRandomImage(index, type) {
    const keyword = getSearchKeyword(type);
    return `https://source.unsplash.com/random/800x600/?${keyword}&sig=${index}`;
}

async function seed() {
    const conn = await mysql.createConnection(dbConfig);
    
    try {
        console.log("🚀 데이터 초기화 및 재생성을 시작합니다...");

        // 0. DB에서 5개 유형의 type_id를 미리 조회해서 맵핑
        // (DB마다 ID가 1,2,3,4,5가 아닐 수도 있으므로 안전하게 조회!)
        const [typeRows] = await conn.query('SELECT type_id, label FROM accommodationtype');
        const typeMap = {}; // { '호텔': 1, '펜션': 2 ... } 형태로 저장
        typeRows.forEach(row => {
            typeMap[row.label] = row.type_id;
        });

        // DB에 없는 유형이 있으면 경고
        targetTypes.forEach(t => {
            if (!typeMap[t]) console.warn(`⚠️ 경고: DB에 '${t}' 유형이 없습니다! SQL INSERT 먼저 하세요.`);
        });

        // 1. 기존 데이터 삭제 (초기화)
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('TRUNCATE TABLE roomtype');
        await conn.query('TRUNCATE TABLE review');
        await conn.query('TRUNCATE TABLE reservation');
        await conn.query('TRUNCATE TABLE recently_viewed');
        await conn.query('TRUNCATE TABLE accommodation');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log("🧹 기존 데이터 싹 지웠습니다!");

        // 2. 숙소 100개 생성 (실제 20 + 가상 80)
        for (let i = 0; i < 100; i++) {
            let name, address, type, region, desc;
            
            if (i < realAccommodations.length) {
                // [1~20번] 실제 숙소 데이터 사용
                const real = realAccommodations[i];
                name = real.name;
                address = real.address;
                type = real.type; // 미리 지정된 타입 사용
                region = real.region;
                desc = `경주 ${region}에 위치한 ${name}입니다. 최고의 휴식을 제공합니다.`;
            } else {
                // [21~100번] 가상 숙소 생성 (5개 유형 중 랜덤 선택)
                const regions = ["황리단길", "보문단지", "불국사", "감포", "시내"];
                const randomRegion = regions[Math.floor(Math.random() * regions.length)];
                
                // ★ 여기서 5개 유형 중 하나를 랜덤으로 뽑음!
                type = targetTypes[Math.floor(Math.random() * targetTypes.length)];

                const nouns = {
                    "호텔": ["스테이", "호텔", "비즈니스"],
                    "글램핑": ["캠프", "글램핑장", "카라반파크"],
                    "펜션": ["펜션", "하우스", "민박"],
                    "한옥": ["고택", "한옥스테이", "당"],
                    "풀빌라": ["풀빌라", "리조트", "맨션"]
                };
                const adjs = ["아름다운", "행복한", "경주", "신라", "황금", "달빛", "별빛"];
                
                const randomAdj = adjs[Math.floor(Math.random() * adjs.length)];
                const randomNoun = nouns[type][Math.floor(Math.random() * nouns[type].length)];

                name = `${randomAdj} ${randomNoun} ${i}`;
                address = `경상북도 경주시 ${randomRegion} ${Math.floor(Math.random() * 1000)}번길`;
                region = randomRegion;
                desc = `${randomRegion}의 자연과 함께하는 ${type}입니다.`;
            }

            const type_id = typeMap[type] || 1; // DB ID 매핑 (없으면 1번으로)
            const { lat, lng } = getRandomCoord();
            const imageUrl = getRandomImage(i, type);

            // 숙소 INSERT
            const sql = `
                INSERT INTO accommodation 
                (owner_user_id, type_id, name, address, region_city, type, latitude, longitude, rating, review_count, main_image_url, description, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1)
            `;
            await conn.query(sql, [1, type_id, name, address, region, type, lat, lng, imageUrl, desc]);
        }
        console.log("✅ 숙소 100개 (5가지 유형) 생성 완료!");

        // 3. 객실 생성 (방 3~6개 랜덤)
        console.log("🛏️ 객실 데이터 생성 중...");
        const [accommodations] = await conn.query('SELECT accommodation_id, type FROM accommodation');
        
        for (const acc of accommodations) {
            const names = roomNames[acc.type] || roomNames["호텔"];
            const roomCount = Math.floor(Math.random() * 4) + 3; 

            for (let j = 0; j < roomCount; j++) {
                const rName = names[j % names.length]; // 이름 돌려가며 쓰기
                const price = 50000 + (j * 30000) + (Math.floor(Math.random() * 10) * 1000);
                const capacity = 2 + Math.floor(j / 2); 

                await conn.query(`
                    INSERT INTO roomtype 
                    (accommodation_id, name, base_price_per_night, base_capacity, max_capacity, max_people, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                `, [acc.accommodation_id, rName, price, capacity, capacity + 2, capacity + 2]);
            }
        }

        console.log("🎉 모든 작업 완료!");

    } catch (err) {
        console.error("❌ 에러 발생:", err);
    } finally {
        conn.end();
    }
}

seed();