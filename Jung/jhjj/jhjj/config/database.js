/**
 * [DB 연결 설정]
 * MySQL(MariaDB) 데이터베이스와의 연결 풀(Pool)을 생성하는 파일입니다.
 * DB 호스트, 유저, 비밀번호, 포트 정보가 들어있습니다.
 */

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