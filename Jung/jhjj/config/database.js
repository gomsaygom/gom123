// DB 연결

const mysql = require('mysql2/promise');

// DB 연결 설정
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root', 
    password: '1234ad', // 본인 비밀번호
    database: 'yanolja_service_db',
    port: 3307,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = dbPool;