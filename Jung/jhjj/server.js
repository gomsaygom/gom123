const express = require('express');
const cors = require('cors');
const dbPool = require('./config/database');

// 라우터 불러오기
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const accommodationRoutes = require('./routes/accommodationRoutes');
const reservationRoutes = require('./routes/reservationRoutes');

const app = express();


const port = 3000;


// "내 컴퓨터의 'uploads' 폴더를 외부에서 '/uploads' 주소로 접근할 수 있게 해줘!"
app.use('/uploads', express.static('uploads'));

// 미들웨어 설정
app.use(cors({ 
    origin: ['http://localhost:8080', 'http://121.180.137.122:8080'], 
    credentials: true 
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log('요청:', req.method, req.url);
    next();
});
// 라우터 연결 (주소 프리픽스 설정)
app.use('/uploads', express.static('uploads'));
app.use('/auth', authRoutes); // /auth/login, /auth/register ...
app.use('/', userRoutes);     // /me, /favorites ...
app.use('/', accommodationRoutes); // /accommodations ...
app.use('/', reservationRoutes);   // /reservations ...

// 기본 경로
app.get('/', (req, res) => {
    res.send('JHJJ Express Server is running (Refactored)!');
});

// 서버 시작
app.listen(port, async () => {
    try {
        const [rows] = await dbPool.query('SELECT 1 + 1 AS result');
        console.log(`🎉 서버가 http://localhost:${port} 에서 실행 중입니다.`);
        console.log(`🔗 DB 연결 성공! (테스트: ${rows[0].result})`);
    } catch (err) {
        console.error('❌ DB 연결 실패:', err);
    }
});