/* =========================================================
   server.js (API + 상세 주석 합본)
   ========================================================= */

// 1. 필요한 부품(라이브러리) 가져오기
const cors = require('cors');
const express = require('express');
const mysql = require('mysql2/promise'); // ⬅️ (기존 주석) (추가됨) DB 접속에 필요
const bcrypt = require('bcrypt'); // ⬅️ 2순위: 'bcrypt' (비밀번호 암호화) 부품
const jwt = require('jsonwebtoken'); // ⬅️ 2순위: 'JWT' (인증 토큰) 부품

const app = express();
const port = 4000; // ⬅️ (기존 주석) (님이 만든 코드) 사용할 포트 번호 설정 (4000번으로 수정됨)

app.use(express.json()); // ⬅️ (기존 주석) (추가됨) JSON 파싱에 필요

app.use(cors({ 
    origin: ['http://localhost:8080', 'http://121.180.137.122:8080'], 
    credentials: true 
}));

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

// (상수 상단으로 이동)
const saltRounds = 10; 
const JWT_SECRET_KEY = '1234ad'; // ⬅️ (기존 주석) (★중요!★ 나중에 아무도 모르는 값으로 바꾸세요)

/* =========================================================
   기본 경로 (Root Route) - 님이 만든 코드 (테스트용)
   ========================================================= */
app.get('/', (req, res) => {
    res.send('JHJJ Express Server is running!');
});

/* =========================================================
   🚀 1순위 API: 숙소 목록 조회 (필터 기능 + 검색 기능 + 새 컬럼 조회)
   ========================================================= */
app.get('/accommodations', async (req, res) => {
    
    // 1. 프론트가 보낸 'type' (숙소 유형) 값을 주소에서 꺼냅니다.
    // (예: /accommodations?type=한옥  ==> type 변수에 '한옥'이 들어감)
    const { type } = req.query; 

    console.log(`LOG: 숙소 목록 요청 (필터: ${type || '전체'})`);

    try {
        // 2. 기본 SQL 쿼리 (전체 조회용)
        // ⬇️ (수정됨) 새로 추가된 4가지 컬럼(type, main_image_url, rating, review_count)을 포함합니다.
        let query = `
            SELECT 
                accommodation_id, owner_user_id, type_id, name, address, 
                latitude, longitude, region_city, description, is_active,
                type, main_image_url, rating, review_count  
            FROM Accommodation 
            WHERE is_active = 1
        `;
        
        // 3. SQL에 넣을 '값'들을 담을 배열
        const queryParams = [];

        // 4. (핵심!) 만약 'type' 필터가 있다면, SQL 뒤에 조건을 붙입니다.
        if (type) {
            query += ' AND type = ?'; // SQL 문장 이어 붙이기 (예: ... AND type = '한옥')
            queryParams.push(type);   // ? 자리에 넣을 값 추가
        }

        // 5. 완성된 쿼리와 값들로 DB 조회
        const [rows] = await dbPool.query(query, queryParams);
        
        // 6. 프론트(손님)에게 JSON(음식)으로 응답합니다.
        res.status(200).json(rows);

    } catch (error) {
        // 만약 에러가 나면, 프론트와 터미널에 에러를 알려줍니다.
        console.error('숙소 목록 조회 중 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});
/* =========================================================
   🚀 2순위 API: 회원가입 (POST /register)
   ========================================================= */
//  bcrypt 암호화 강도 설정. 숫자가 높을수록 강력하지만 오래 걸림.
// const saltRounds = 10; // (상단으로 이동됨)

//  '/register' 주소로 'POST' 방식의 요청이 오면 이 코드가 실행됨
app.post('/register', async (req, res) => {
    
    //  1. 프론트엔드가 보낸 '요청 본문(body)'에서 데이터를 꺼냅니다.
    const { username, password, name, email, phone, role_code } = req.body;

    //  (간단한 유효성 검사) 필수 정보가 빠졌는지 확인
    if (!username || !password || !name) {
        return res.status(400).json({ message: '아이디, 비밀번호, 이름은 필수입니다.' });
    }

    //  2. (필수!) 비밀번호를 'bcrypt'로 암호화(분쇄)합니다.
    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, saltRounds);
    } catch (hashError) {
        console.error('비밀번호 암호화 중 오류:', hashError);
        return res.status(500).json({ message: '서버 내부 오류 (암호화)' });
    }
    
    //  3. 암호화된 비밀번호로 DB(users 테이블)에 INSERT 쿼리를 실행합니다.
    try {
        const query = `
            INSERT INTO users (username, password, name, email, phone, role_code) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await dbPool.query(query, [
            username, 
            hashedPassword, // ⬅️  원본 비번(password) 대신, 암호화된 비번(hashedPassword)을 저장!
            name, 
            email, 
            phone, 
            role_code || 'CUSTOMER' //  역할 코드가 안 오면 기본 'CUSTOMER'
        ]);

        //  4. 성공 응답(201: 생성됨)을 프론트에게 보냅니다.
        res.status(201).json({ message: '회원가입에 성공했습니다!' });

    } catch (error) {
        //  (주의!) DB에 UNIQUE로 설정한 username이나 email이 중복되면 이 에러가 뜸
        if (error.code === 'ER_DUP_ENTRY') {
            console.warn('경고: 아이디 또는 이메일이 중복되었습니다.', error.sqlMessage);
            return res.status(409).json({ message: '이미 사용 중인 아이디 또는 이메일입니다.' });
        }
        
        console.error('회원가입 DB 삽입 중 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/* =========================================================
   🚀 2순위 API: 로그인 (POST /login)
   ========================================================= */
//  JWT(자유이용권)을 만들 때 사용할 '비밀 서명'.
// const JWT_SECRET_KEY = '1234ad'; // (상단으로 이동됨)

//  '/login' 주소로 'POST' 방식의 요청이 오면 이 코드가 실행됨
app.post('/login', async (req, res) => {
    
    //  1. 프론트가 보낸 'username'과 'password'를 받습니다.
    const { username, password } = req.body;

    //  (유효성 검사)
    if (!username || !password) {
        return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력하세요.' });
    }

    try {
        //  2. DB(users 테이블)에서 'username'으로 사용자를 찾습니다. (활성화된 계정만)
        const query = 'SELECT * FROM users WHERE username = ? AND is_active = 1';
        const [users] = await dbPool.query(query, [username]);

        //  3. (검사 1) 사용자가 없는 경우
        if (users.length === 0) {
            console.log(`❌ 로그인 실패: ID [${username}] - 사용자 없음.`); // ⬅️ (로그 추가됨)
            return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
        }

        const user = users[0]; // 찾은 사용자 정보

        // 4. (검사 2) 비밀번호 비교 (★핵심★)
        const isMatch = await bcrypt.compare(password, user.password);

        // 5. (검사 2 결과) 비밀번호가 틀린 경우
        if (!isMatch) {
            console.log(`❌ 로그인 실패: ID [${username}] - 비밀번호 불일치.`); // ⬅️ (로그 추가됨)
            return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
        }

        //  6. (로그인 성공!) '자유이용권(JWT)'을 발급합니다.
        const token = jwt.sign(
            { 
                userId: user.user_id, 
                role: user.role_code 
            }, 
            JWT_SECRET_KEY, 
            { expiresIn: '1h' } 
        );
        
        // ⬅️ ★여기! 로그인 성공 로그가 추가되었습니다★
        console.log(`✅ 로그인 성공! [${user.role_code}] 사용자: ${user.username} (ID: ${user.user_id})`); 
        
        //  7. 프론트에게 토큰(자유이용권)을 응답으로 줍니다.
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
   🔍 로그인 상태 확인 API (GET /auth/session)
   ========================================================= */
app.get('/auth/session', (req, res) => {
    const authHeader = req.headers.authorization;

    // 토큰이 없음 → 로그인 안됨
    if (!authHeader) {
        return res.json({ isAuthenticated: false });
    }

    // Authorization: Bearer xxxxxx
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.json({ isAuthenticated: false });
    }

    try {
        // JWT 토큰 검증
        const decoded = jwt.verify(token, JWT_SECRET_KEY);

        // 로그인 인증 성공
        return res.json({
            isAuthenticated: true,
            user: {
                userId: decoded.userId,
                role: decoded.role
            }
        });
    } catch (err) {
        // 만료·위조된 토큰 → 로그인 아님
        return res.json({ isAuthenticated: false });
    }
});

/* =========================================================
   🚀 3순위 API: 숙소 상세 조회 (GET /accommodations/:id) 
   ========================================================= */
//  '/accommodations/:id' -> :id는 '변수'라는 뜻입니다.
app.get('/accommodations/:id', async (req, res) => {
    
    //  1. (새 기술!) 주소(URL)에서 ':id' 값을 꺼냅니다.
    const { id } = req.params; 

    try {
        //  2. '숙소' 정보와 '객실' 정보를 DB에서 따로따로 조회합니다.
        
        //  (A) 'id'번 숙소의 기본 정보를 Accommodation 테이블에서 가져옵니다.
        const accommodationQuery = 'SELECT * FROM Accommodation WHERE accommodation_id = ? AND is_active = 1';
        const [accommodations] = await dbPool.query(accommodationQuery, [id]);

        //  (검사) 만약 해당 ID의 숙소가 없으면, 404 (찾을 수 없음) 응답
        if (accommodations.length === 0) {
            return res.status(404).json({ message: '해당 숙소를 찾을 수 없습니다.' });
        }
        const accommodationData = accommodations[0]; //  (숙소 정보는 1개)

        //  (B) 'id'번 숙소에 딸린 '객실 목록'을 RoomType 테이블에서 가져옵니다.
        const roomsQuery = 'SELECT * FROM RoomType WHERE accommodation_id = ? AND is_active = 1';
        const [roomsData] = await dbPool.query(roomsQuery, [id]); //  (객실은 여러 개일 수 있음)

        //  3. (결합!) 숙소 정보와 객실 목록을 하나의 JSON으로 합쳐서 응답합니다.
        const responseData = {
            accommodation: accommodationData, // ⬅️  '경주 힐링 펜션' 상세 정보
            rooms: roomsData                // ⬅️  '커플룸 (스파)' 등 객실 목록
        };

        //  4. 프론트에게 200 (성공) 응답과 함께 합쳐진 JSON 데이터를 보냅니다.
        res.status(200).json(responseData);

    } catch (error) {
        console.error('숙소 상세 조회 중 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

/* =========================================================
   🔑 JWT 인증 미들웨어 (티켓 검사원)
   ========================================================= */
//  이 함수가 '로그인한 사용자'인지 아닌지 검사하는 '미들웨어'입니다.
const authMiddleware = (req, res, next) => {
    
    //  1. 프론트엔드가 요청 헤더(headers)에 'Authorization' 값을 보냈는지 확인합니다.
    const authHeader = req.headers.authorization;

    //  2. (검사 1) 'Authorization' 헤더가 아예 없는 경우 (티켓을 안 냄)
    if (!authHeader) {
        return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
    }

    //  3. 헤더에서 'Bearer ' 부분을 잘라내고 '토큰값'만 추출합니다.
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: '유효하지 않은 토큰 형식입니다.' });
    }

    //  4. (★핵심★) 'jsonwebtoken'을 이용해 토큰을 검증(verify)합니다.
    try {
        //  jwt.verify(토큰, 비밀키) -> 비밀키가 일치하고 만료되지 않았는지 검사
        const decoded = jwt.verify(token, JWT_SECRET_KEY); 

        //  5. (검증 성공!) 토큰에 담겨있던 정보를 req.user에 저장합니다.
        req.user = decoded; // ⬅️ 예: { userId: 2, role: 'CUSTOMER' }

        //  6. 검사 통과! 다음 단계(실제 API 로직)로 이동시킵니다.
        next(); 

    } catch (error) {
        //  7. (검증 실패!) 토큰이 만료되었거나(TokenExpiredError) 서명이 위조된 경우
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: '토큰이 만료되었습니다. 다시 로그인하세요.' });
        }
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
};

/* =========================================================
   🚀 2-3순위 API: 내 정보 조회 (GET /me) (★새로 추가★)
   ========================================================= */
// (새 주석) 이 API는 JWT를 검사해야 하므로 'authMiddleware'를 사용합니다.
app.get('/me', authMiddleware, async (req, res) => {
    
    // (새 주석) 1. '티켓 검사원'이 req.user에 넣어준 '로그인한 사용자 ID'를 꺼냅니다.
    const { userId } = req.user; 

    try {
        // (새 주석) 2. DB에서 해당 ID의 사용자 정보를 조회합니다. (비밀번호 제외)
        const query = `
            SELECT 
                user_id,
                username,
                name,
                email,
                phone,
                role_code,
                created_at
            FROM users
            WHERE user_id = ?
        `; // ⬅️ (수정) SQL을 백틱(``)으로 감싸서 문자열로 만들었습니다.

        const [rows] = await dbPool.query(query, [userId]);

        // 3. (검사) 사용자가 없으면 404
        if (rows.length === 0) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        // 4. 조회된 정보를 DTO 형식으로 응답합니다.
        res.status(200).json({ user: rows[0] });

    } catch (error) {
        console.error('내 정보 조회 중 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/* =========================================================
   🚀 4순위 API: 예약하기 (POST /reservations)
   ========================================================= */
//  '/reservations' 주소로 POST 요청이 오면,
//  (1) authMiddleware (티켓 검사원)가 먼저 실행되고, (★중요★)
//  (2) 통과해야만 (async (req, res) => ...) 부분이 실행됩니다.
app.post('/reservations', authMiddleware, async (req, res) => {
    
    //  1. (★핵심★) '티켓 검사원'이 req.user에 넣어준 '로그인한 사용자 정보'를 꺼냅니다.
    const { userId } = req.user; 

    //  2. 프론트가 보낸 '예약 정보'를 req.body에서 꺼냅니다.
    const { room_type_id, checkin_date, checkout_date, total_price } = req.body;

    //  (간단한 유효성 검사)
    if (!room_type_id || !checkin_date || !checkout_date || !total_price) {
        return res.status(400).json({ message: '예약 정보(객실ID, 날짜, 가격)가 모두 필요합니다.' });
    }

    //  (★미래 작업★) 재고 검사 로직이 추가되어야 합니다.

    try {
        //  3. 'Reservation' 테이블에 예약 정보를 INSERT 합니다.
        const query = `
            INSERT INTO Reservation (user_id, room_type_id, checkin_date, checkout_date, total_price, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await dbPool.query(query, [
            userId, // ⬅️ (중요!) 로그인한 사용자의 ID
            room_type_id,
            checkin_date,
            checkout_date,
            total_price,
            'CONFIRMED' //  일단 '예약 확정' 상태로 저장
        ]);

        //  4. 예약 성공 응답을 보냅니다.
        res.status(201).json({ message: '예약이 성공적으로 완료되었습니다!' });

    } catch (error) {
        console.error('예약 처리 중 DB 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

/* =========================================================
   🚀 4-2. API: 예약 취소하기 (DELETE /reservations/:id)
   ========================================================= */
app.delete('/reservations/:id', authMiddleware, async (req, res) => {
    
    //  1. (★인증★) '티켓 검사원'이 req.user에 넣어준 '로그인한 사용자' 정보를 꺼냅니다.
    const { userId } = req.user; 

    //  2. (★경로★) 주소(URL)에서 취소할 ':id' (reservation_id) 값을 꺼냅니다.
    const { id: reservationId } = req.params;

    try {
        //  3. (★검사★) DB에서 "이 예약을 '로그인한 본인'이 한 게 맞는지" 확인합니다.
        const checkQuery = 'SELECT * FROM Reservation WHERE reservation_id = ? AND user_id = ?';
        const [reservations] = await dbPool.query(checkQuery, [reservationId, userId]);

        //  4. (검사 실패) 예약이 없거나, 내 예약이 아닌 경우
        if (reservations.length === 0) {
            return res.status(403).json({ message: '예약을 찾을 수 없거나, 취소할 권한이 없습니다.' });
        }
        
        //  5. (검사 성공) 내 예약이 맞으면, 'status'를 'CANCELLED'로 업데이트합니다.
        const updateQuery = `
            UPDATE Reservation 
            SET status = 'CANCELLED' 
            WHERE reservation_id = ? AND user_id = ?
        `;
        
        await dbPool.query(updateQuery, [reservationId, userId]);

        //  6. 예약 취소 성공 응답을 보냅니다.
        res.status(200).json({ message: '예약이 성공적으로 취소되었습니다.' });

    } catch (error) {
        console.error('예약 취소 처리 중 DB 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

/* =========================================================
   🚀 5순위 API: 내 예약 목록 조회 (GET /me/reservations)
   ========================================================= */
app.get('/me/reservations', authMiddleware, async (req, res) => {
    
    //  1. (★인증★) '티켓 검사원'이 req.user에 넣어준 '로그인한 사용자' 정보를 꺼냅니다.
    const { userId } = req.user; 

    try {
        //  2. (★핵심 JOIN★) 'Reservation' 테이블을 중심으로
        //  'RoomType' (방 정보)과 'Accommodation' (숙소 정보) 테이블을 'JOIN'합니다.
        const query = `
            SELECT 
                r.reservation_id,
                r.checkin_date,
                r.checkout_date,
                r.total_price,
                r.status,
                r.created_at,
                rt.name AS room_name,
                a.name AS accommodation_name,
                a.address AS accommodation_address
            FROM Reservation AS r
            JOIN RoomType AS rt ON r.room_type_id = rt.room_type_id
            JOIN Accommodation AS a ON rt.accommodation_id = a.accommodation_id
            WHERE r.user_id = ?
            ORDER BY r.checkin_date DESC;
        `;
        
        const [reservations] = await dbPool.query(query, [userId]);

        //  3. 조회된 '내 예약 목록' (배열)을 프론트에게 응답합니다.
        res.status(200).json(reservations);

    } catch (error) {
        console.error('내 예약 목록 조회 중 DB 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/* =========================================================
   🚀 6순위 API: 찜하기 기능 (3종 세트)
   ========================================================= */

//  6-1. 찜 추가하기 (POST /favorites)
app.post('/favorites', authMiddleware, async (req, res) => {
    
    //  1. (★인증★) '티켓 검사원'이 req.user에 넣어준 '로그인한 사용자' 정보를 꺼냅니다.
    const { userId } = req.user; 
    
    //  2. 프론트가 보낸 '찜할 숙소 ID'를 req.body에서 꺼냅니다.
    const { accommodation_id } = req.body;

    if (!accommodation_id) {
        return res.status(400).json({ message: '찜할 숙소의 ID가 필요합니다.' });
    }

    try {
        //  3. 'Favorite' 테이블에 찜 정보를 INSERT 합니다.
        const query = `
            INSERT INTO Favorite (user_id, accommodation_id)
            VALUES (?, ?)
        `;
        
        await dbPool.query(query, [userId, accommodation_id]);

        //  4. 찜 추가 성공 응답을 보냅니다.
        res.status(201).json({ message: '찜 목록에 추가되었습니다!' });

    } catch (error) {
        //  (주의!) 이미 찜한 숙소를 또 찜하면 'UNIQUE' 제약 조건 에러가 뜹니다.
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: '이미 찜 목록에 있는 숙소입니다.' });
        }
        console.error('찜하기 처리 중 DB 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


//  6-2. 내 찜 목록 조회 (GET /me/favorites)
app.get('/me/favorites', authMiddleware, async (req, res) => {
    
    //  1. (★인증★) '티켓 검사원'이 req.user에 넣어준 '로그인한 사용자' 정보를 꺼냅니다.
    const { userId } = req.user; 

    try {
        //  2. (★핵심 JOIN★) 'Favorite' 테이블과 'Accommodation' 테이블을 JOIN합니다.
        const query = `
            SELECT 
                f.favorite_id,
                f.created_at AS favorited_at,
                a.accommodation_id,
                a.name AS accommodation_name,
                a.address AS accommodation_address,
                a.region_city
            FROM Favorite AS f
            JOIN Accommodation AS a ON f.accommodation_id = a.accommodation_id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC;
        `;
        
        const [favorites] = await dbPool.query(query, [userId]);

        //  3. 조회된 '내 찜 목록' (배열)을 프론트에게 응답합니다.
        res.status(200).json(favorites);

    } catch (error) {
        console.error('내 찜 목록 조회 중 DB 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

//  6-3. 찜 취소하기 (DELETE /favorites/:id)
app.delete('/favorites/:id', authMiddleware, async (req, res) => {
    
    //  1. (★인증★) '티켓 검사원'이 req.user에 넣어준 '로그인한 사용자' 정보를 꺼냅니다.
    const { userId } = req.user; 

    //  2. (★경로★) 주소(URL)에서 취소할 ':id' (favorite_id) 값을 꺼냅니다.
    const { id: favoriteId } = req.params;

    try {
        //  3. (★검사★) DB에서 "이 찜을 '로그인한 본인'이 한 게 맞는지" 확인합니다.
        const deleteQuery = `
            DELETE FROM Favorite 
            WHERE favorite_id = ? AND user_id = ?
        `;
        
        //  4. 찜 삭제 쿼리를 실행합니다.
        const [result] = await dbPool.query(deleteQuery, [favoriteId, userId]);

        //  5. (검사 실패) 삭제된 행(affectedRows)이 0개면, 찜이 없거나 내 찜이 아닌 경우
        if (result.affectedRows === 0) {
            return res.status(403).json({ message: '찜 목록을 찾을 수 없거나, 삭제할 권한이 없습니다.' });
        }
        
        //  6. 찜 취소 성공 응답을 보냅니다.
        res.status(200).json({ message: '찜 목록에서 삭제되었습니다.' });

    } catch (error) {
        console.error('찜 취소 처리 중 DB 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

/* =========================================================
   🚀 7순위 API: 인기 숙소 추천 (GET /recommend/popular) (★새로 추가★)
   ========================================================= */
// (새 주석) 이 API는 가장 예약 건수가 많은 숙소를 순서대로 조회합니다.
// (새 주석) 로그인 없이도 가능하도록 authMiddleware는 적용하지 않습니다.
app.get('/recommend/popular', async (req, res) => {
    
    console.log("LOG: /recommend/popular (인기 순위) API 요청");

    try {
        // 1. (★핵심 복잡 쿼리★) 예약 건수를 기준으로 숙소 순위를 매기는 쿼리
        const query = `
            SELECT 
                a.accommodation_id,
                a.name AS accommodation_name,
                a.region_city,
                COUNT(r.reservation_id) AS reservation_count,  -- 숙소별 예약 건수를 셉니다.
                MIN(rt.base_price_per_night) AS min_price     -- 최저 가격을 함께 조회합니다.
            FROM Accommodation AS a
            JOIN RoomType AS rt ON a.accommodation_id = rt.accommodation_id 
            JOIN Reservation AS r ON rt.room_type_id = r.room_type_id       
            WHERE r.status = 'CONFIRMED' 
            GROUP BY a.accommodation_id, a.name, a.region_city              
            ORDER BY reservation_count DESC, min_price ASC;                 
        `;
        
        const [popularAccommodations] = await dbPool.query(query);

        // 2. 조회된 인기 숙소 목록을 응답합니다.
        res.status(200).json(popularAccommodations);

    } catch (error) {
        console.error('인기 숙소 조회 중 DB 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});



// 3. 서버 시작 (님이 만든 코드를 DB 연결 테스트 코드로 업그레이드)
app.listen(port, async () => {
    try {
        // (기존 주석) 서버가 켜지면, DB 연결이 진짜 되는지 테스트
        const [rows] = await dbPool.query('SELECT 1 + 1 AS result');
        console.log(`🎉 서버가 http://localhost:${port} 에서 실행 중입니다.`); // ⬅️ 4000번 포트로 실행
        console.log(`🔗 DB (yanolja_service_db) 연결 성공! (테스트 쿼리 결과: ${rows[0].result})`);
    } catch (err) {
        console.error('❌ DB 연결 실패:', err);
    }
});