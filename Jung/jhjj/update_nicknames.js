const mysql = require('mysql2/promise');

// 1. DB 연결 설정 (본인 환경에 맞게 수정 필수!)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '1234ad', // ⬅️ 님의 비밀번호
    database: 'yanolja_service_db',
    port: 3307
};

// 2. 🌟 60개 이상의 고유한 닉네임 목록 (숫자 꼬리표 없음)
const uniqueNicknames = [
    "경주별밤", "황리단길러", "보문호산책", "첨성대힐링", "석굴암노을", "불국사길", 
    "감포바다", "동궁과월지", "대릉원길", "아리아나 그란데", "천마총여행", "여행을떠나요", 
    "꿀잠예약", "빼꼼", "탑은버려도돼요", "소확행여행", "통나무들기온라인", "추억제작소", 
    "주말여행자", "평일휴가", "일병 유 성", "전국 에메랄드 협회장", "여행에미치다", "메시최고",
    "찰리 푸스", "태우버너스 리", "푸른하늘", "꽃길만걷자", "바람따라", "구름처럼", 
    "햇살한조각", "미소천사", "꿈꾸는자", "커피한잔", "떡볶이킬러", "삼겹살러버", 
    "맥주한캔", "일론 머스크", "밥심으로", "비가오면", "눈이오면", "맑은날씨", 
    "흐린하늘", "가성비최고", "숙소탐험", "손가 원익", "솔직리뷰어", "오늘이가장젊음", 
    "내일은맑음", "쉬고싶다", "잠만보", "부지런한꿀벌", "어쩌다여행", "계획적인사람", 
    "충동여행", "페이커", "포항 대통령", "여름방학", "존시나", "밤도깨비", 
    "아침형인간", "졸업시켜주세요", "숙박왕", "현준 정정", "여행고수", "흥민 쏜", 
    "띠디띠디띠디", "최고의선택", "곰곰", "낭만여행가", "hide on bush", "KYLE"
];

// 배열 섞기 함수 (Fisher-Yates Shuffle)
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}


async function assignCleanNicknames() {
    let conn;
    
    try {
        console.log("🚀 닉네임 목록 재할당을 시작합니다...");
        conn = await mysql.createConnection(dbConfig);

        const [users] = await conn.query("SELECT user_id FROM users");
        
        if (users.length === 0) {
            console.log("❌ 수정할 사용자가 없습니다.");
            return;
        }

        // 1. 고유 닉네임 목록을 무작위로 섞습니다.
        const shuffledNames = shuffle(uniqueNicknames);
        
        let updatedCount = 0;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            
            // 2. 닉네임 목록에서 순서대로 가져와 할당합니다.
            // (i % shuffledNames.length를 사용해서 목록이 사용자 수보다 적을 경우 처음으로 돌아가도록 처리)
            const newNickname = shuffledNames[i % shuffledNames.length];
            
            // 3. DB 업데이트
            await conn.query(
                'UPDATE users SET nickname = ? WHERE user_id = ?',
                [newNickname, user.user_id]
            );
            updatedCount++;
        }

        console.log(`✅ 닉네임 업데이트 완료! 총 ${updatedCount}명 수정.`);

    } catch (err) {
        console.error("❌ 닉네임 업데이트 중 에러 발생:", err.message);
    } finally {
        if (conn) conn.end();
    }
}

assignCleanNicknames();