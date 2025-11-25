/**
 * [파일 업로드 미들웨어]
 * Multer 라이브러리를 사용하여 사용자가 전송한 이미지 파일을 처리합니다.
 * - 파일 저장 위치: 'uploads/' 폴더
 * - 파일명: 중복 방지를 위해 '현재시간 + 원본파일명'으로 저장
 * - 용량 제한: 5MB
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. 이미지를 저장할 'uploads' 폴더가 없으면 알아서 만듭니다.
try {
    fs.readdirSync('uploads');
} catch (error) {
    console.error('uploads 폴더가 없어 uploads 폴더를 생성합니다.');
    fs.mkdirSync('uploads');
}

// 2. 저장 설정 (어디에, 어떤 이름으로 저장할지)
const storage = multer.diskStorage({
    destination(req, file, done) {
        done(null, 'uploads/'); // 파일이 저장될 위치
    },
    filename(req, file, done) {
        // 파일명 중복을 막기 위해 '날짜+원본이름'으로 저장합니다.
        const ext = path.extname(file.originalname);
        done(null, path.basename(file.originalname, ext) + Date.now() + ext);
    },
});

// 3. 파일 크기 제한 (5MB) 및 설정 내보내기
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

module.exports = upload;