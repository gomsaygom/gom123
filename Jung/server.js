/* =========================================================
   server.js (1, 2, 3순위 API + 상세 주석 합본)
   ========================================================= */

// 1. 필요한 부품(라이브러리) 가져오기
const express = require('express');
const mysql = require('mysql2/promise'); // ⬅️ (기존 주석) (추가됨) DB 접속에 필요
const bcrypt = require('bcrypt'); // ⬅️ (새 주석) 2순위: 'bcrypt' (비밀번호 암호화) 부품
const jwt = require('jsonwebtoken'); // ⬅️ (새 주석) 2순위: 'JWT' (인증 토큰) 부품

const app = express();
const port = 3000; // ⬅️ (기존 주석) (님이 만든 코드) 사용할 포트 번호 설정

app.use(express.json()); // ⬅️ (기존 주석) (추가됨) JSON 파싱에 필요

// 2. DB 연결 설정
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root', 
    password: '1234ad', // ⬅️ (기존 주석) 님의 MariaDB 비밀번호를 여기에 꼭!
    database: 'yanolja_service_db',
    port: 3307, // ⬅️ (기존 주석) (중요!) 님이 알려주신 DB 포트 3307번
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

/* =========================================================
   기본 경로 (Root Route) - 님이 만든 코드 (테스트용)
   ========================================================= */
app.get('/', (req, res) => {
    res.send('JHJJ Express Server is running!');
});

/* =========================================================
   🚀 1순위 API: 숙소 목록 조회 (추가됨)
   ========================================================= */
app.get('/accommodations', async (req, res) => {
    
    console.log("LOG: /accommodations (숙소 목록) API가 요청되었습니다!");

    try {
        // (기존 주석) DB '창고'에서 'Accommodation' 선반의 물건을 꺼냅니다.
        const [rows] = await dbPool.query('SELECT * FROM Accommodation WHERE is_active = 1');
        
        // (기존 주석) 프론트(손님)에게 JSON(음식)으로 응답합니다.
        res.status(200).json(rows);

    } catch (error) {
        // (기존 주석) 만약 에러가 나면, 프론트와 터미널에 에러를 알려줍니다.
        console.error('숙소 목록 조회 중 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

/* =========================================================
   (기존 주석) (나중에 2순위 3순위 API들도 여기에 계속 추가...)
   ========================================================= */

/* =========================================================
   🚀 2순위 API: 회원가입 (POST /register) (새로 추가!)
   ========================================================= */
// (새 주석) bcrypt 암호화 강도 설정. 숫자가 높을수록 강력하지만 오래 걸림.
const saltRounds = 10; 

// (새 주석) '/register' 주소로 'POST' 방식의 요청이 오면 이 코드가 실행됨
app.post('/register', async (req, res) => {
    
    // (새 주석) 1. 프론트엔드가 보낸 '요청 본문(body)'에서 데이터를 꺼냅니다.
    const { username, password, name, email, phone, role_code } = req.body;

    // (새 주석) (간단한 유효성 검사) 필수 정보가 빠졌는지 확인
    if (!username || !password || !name) {
        return res.status(400).json({ message: '아이디, 비밀번호, 이름은 필수입니다.' });
    }

    // (새 주석) 2. (필수!) 비밀번호를 'bcrypt'로 암호화(분쇄)합니다.
    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, saltRounds);
    } catch (hashError) {
        console.error('비밀번호 암호화 중 오류:', hashError);
        return res.status(500).json({ message: '서버 내부 오류 (암호화)' });
    }
    
    // (새 주석) 3. 암호화된 비밀번호로 DB(users 테이블)에 INSERT 쿼리를 실행합니다.
    try {
        const query = `
            INSERT INTO users (username, password, name, email, phone, role_code) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await dbPool.query(query, [
            username, 
            hashedPassword, // ⬅️ (새 주석) 원본 비번(password) 대신, 암호화된 비번(hashedPassword)을 저장!
            name, 
            email, 
            phone, 
            role_code || 'CUSTOMER' // (새 주석) 역할 코드가 안 오면 기본 'CUSTOMER'
        ]);

        // (새 주석) 4. 성공 응답(201: 생성됨)을 프론트에게 보냅니다.
        res.status(201).json({ message: '회원가입에 성공했습니다!' });

    } catch (error) {
        // (새 주석) (주의!) DB에 UNIQUE로 설정한 username이나 email이 중복되면 이 에러가 뜸
        if (error.code === 'ER_DUP_ENTRY') {
            console.warn('경고: 아이디 또는 이메일이 중복되었습니다.', error.sqlMessage);
            return res.status(409).json({ message: '이미 사용 중인 아이디 또는 이메일입니다.' });
        }
        
        console.error('회원가입 DB 삽입 중 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/* =========================================================
   🚀 2순위 API: 로그인 (POST /login) (새로 추가!)
   ========================================================= */
// (새 주석) JWT(자유이용권)을 만들 때 사용할 '비밀 서명'.
const JWT_SECRET_KEY = 'YOUR_SECRET_KEY'; // (★중요!★ 나중에 아무도 모르는 값으로 바꾸세요)

// (새 주석) '/login' 주소로 'POST' 방식의 요청이 오면 이 코드가 실행됨
app.post('/login', async (req, res) => {
    
    // (새 주석) 1. 프론트가 보낸 'username'과 'password'를 받습니다.
    const { username, password } = req.body;

    // (새 주석) (유효성 검사)
    if (!username || !password) {
        return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력하세요.' });
    }

    try {
        // (새 주석) 2. DB(users 테이블)에서 'username'으로 사용자를 찾습니다. (활성화된 계정만)
        const query = 'SELECT * FROM users WHERE username = ? AND is_active = 1';
        const [users] = await dbPool.query(query, [username]);

        // (새 주석) 3. (검사 1) 사용자가 없는 경우
        if (users.length === 0) {
            return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
        }

        const user = users[0]; // (새 주석) 찾은 사용자 정보

        // (새 주석) 4. (검사 2) 비밀번호 비교 (★핵심★)
        const isMatch = await bcrypt.compare(password, user.password);

        // (새 주석) 5. (검사 2 결과) 비밀번호가 틀린 경우
        if (!isMatch) {
            return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
        }

        // (새 주석) 6. (로그인 성공!) '자유이용권(JWT)'을 발급합니다.
        const token = jwt.sign(
            { 
                userId: user.user_id, 
                role: user.role_code 
            }, 
            JWT_SECRET_KEY, 
            { expiresIn: '1h' } 
        );
        
        // (새 주석) 7. 프론트에게 토큰(자유이용권)을 응답으로 줍니다.
        res.status(200).json({
            message: '로그인 성공!',
            token: token,
            username: user.name 
        });

    } catch (error) {
        console.error('로그인 처리 중 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/* =========================================================
   🚀 3순위 API: 숙소 상세 조회 (GET /accommodations/:id) (★새로 추가된 코드★)
   ========================================================= */
// (새 주석) '/accommodations/:id' -> :id는 '변수'라는 뜻입니다.
// (새 주석) /accommodations/1, /accommodations/2 ... 모든 숫자가 이 API로 연결됩니다.
app.get('/accommodations/:id', async (req, res) => {
    
    // (새 주석) 1. (새 기술!) 주소(URL)에서 ':id' 값을 꺼냅니다.
    // (새 주석) 프론트가 /accommodations/1 이라고 요청하면, 'id' 변수에 '1'이 담깁니다.
    const { id } = req.params; 

    try {
        // (새 주석) 2. '숙소' 정보와 '객실' 정보를 DB에서 따로따로 조회합니다.
        
        // (새 주석) (A) 'id'번 숙소의 기본 정보를 Accommodation 테이블에서 가져옵니다.
        const accommodationQuery = 'SELECT * FROM Accommodation WHERE accommodation_id = ? AND is_active = 1';
        const [accommodations] = await dbPool.query(accommodationQuery, [id]);

        // (새 주석) (검사) 만약 해당 ID의 숙소가 없으면, 404 (찾을 수 없음) 응답
        if (accommodations.length === 0) {
            return res.status(404).json({ message: '해당 숙소를 찾을 수 없습니다.' });
        }
        const accommodationData = accommodations[0]; // (새 주석) (숙소 정보는 1개)

        // (새 주석) (B) 'id'번 숙소에 딸린 '객실 목록'을 RoomType 테이블에서 가져옵니다.
        const roomsQuery = 'SELECT * FROM RoomType WHERE accommodation_id = ? AND is_active = 1';
        const [roomsData] = await dbPool.query(roomsQuery, [id]); // (새 주석) (객실은 여러 개일 수 있음)

        // (새 주석) 3. (결합!) 숙소 정보와 객실 목록을 하나의 JSON으로 합쳐서 응답합니다.
        const responseData = {
            accommodation: accommodationData, // ⬅️ (새 주석) '경주 힐링 펜션' 상세 정보
            rooms: roomsData                // ⬅️ (새 주석) '커플룸 (스파)' 등 객실 목록
        };

        // (새 주석) 4. 프론트에게 200 (성공) 응답과 함께 합쳐진 JSON 데이터를 보냅니다.
        res.status(200).json(responseData);

    } catch (error) {
        console.error('숙소 상세 조회 중 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/* =========================================================
   (새 주석) (나중에 4순위 API들도 여기에 계속 추가...)
   ========================================================= */


// 3. 서버 시작 (님이 만든 코드를 DB 연결 테스트 코드로 업그레이드)
app.listen(port, async () => {
    try {
        // (기존 주석) 서버가 켜지면, DB 연결이 진짜 되는지 테스트
        const [rows] = await dbPool.query('SELECT 1 + 1 AS result');
        console.log(`🎉 서버가 http://localhost:${port} 에서 실행 중입니다.`);
        console.log(`🔗 DB (yanolja_service_db) 연결 성공! (테스트 쿼리 결과: ${rows[0].result})`);
    } catch (err) {
        console.error('❌ DB 연결 실패:', err);
    }
});