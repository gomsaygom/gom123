/**
 * [숙소 및 리뷰 로직]
 * - 숙소 목록 조회 (검색, 필터, 태그, 페이지네이션)
 * - 숙소 상세 정보 조회
 * - 인기 숙소 추천 (예약 많은 순)
 * - 후기(Review) 작성(사진 포함), 수정, 삭제, 조회
 */

const dbPool = require('../config/database');
const jwt = require('jsonwebtoken'); // 👈 [필수] 토큰 해석기 추가
const { JWT_SECRET_KEY } = require('../config/secrets'); // 👈 [필수] 비밀키 추가

// =========================================================
// 🛠️ [내부 함수] 최근 본 숙소 저장하기
// =========================================================
const saveRecentView = async (userId, accommodationId) => {
    try {
        console.log("gggggg");
        // "넣어라! 만약 이미 있으면? 본 시간(viewed_at)만 최신으로 바꿔라!"
        const sql = `
            INSERT INTO recently_viewed (user_id, accommodation_id, viewed_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE viewed_at = NOW()
        `;
        await dbPool.query(sql, [userId, accommodationId]);
        console.log(`👀 최근 본 숙소 저장 성공! (User: ${userId}, Acc: ${accommodationId})`);
    } catch (err) {
        console.error('최근 본 숙소 저장 실패 (에러 무시):', err);
    }
};

// 1. 숙소 목록 조회 (검색/필터/페이지네이션)
exports.getAccommodations = async (req, res) => {
    let { type, keyword, tag, page, limit } = req.query; 
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 20;
    const offset = (page - 1) * limit;

    try {
        console.log("잘 들어옴");
        let query;
        const queryParams = [];

        if (tag) {
            query = `
                SELECT DISTINCT a.*, (SELECT MIN(base_price_per_night) FROM RoomType WHERE accommodation_id = a.accommodation_id) AS min_price
                FROM Accommodation AS a
                JOIN RoomType AS rt ON a.accommodation_id = rt.accommodation_id
                JOIN RoomTypeTag AS rtt ON rt.room_type_id = rtt.room_type_id
                JOIN Tag AS t ON rtt.tag_id = t.tag_id
                WHERE a.is_active = 1 AND t.name = ?
            `;
            queryParams.push(tag);
        } else {
            query = 'SELECT * FROM Accommodation WHERE is_active = 1';
        }

        if (type && !tag) { 
            query += ' AND type = ?';
            queryParams.push(type);
        }
        if (keyword && !tag) { 
            query += ' AND name LIKE ?';
            queryParams.push(`%${keyword}%`);
        }

        query += ' ORDER BY accommodation_id DESC LIMIT ? OFFSET ?';
        queryParams.push(limit, offset);

        const [rows] = await dbPool.query(query, queryParams);
        
        res.status(200).json({
            page, limit, total_current: rows.length, data: rows
        });

    } catch (error) {
        console.error('숙소 목록 조회 오류:', error);
        res.status(500).json({ message: '서버 오류' });
    }
};

// =========================================================
// 🚀 2. 숙소 상세 조회 (+최근 본 숙소 자동 저장 로직 포함!)
// =========================================================
exports.getAccommodationDetail = async (req, res) => {
    const { id } = req.params; 
console.log(req.headers.authorization);
    // 👇 [핵심 기능] 로그인한 유저인지 확인하고, 맞다면 저장 함수 실행!
    const authHeader = req.headers.authorization;
    console.log("인증 결과" + authHeader);
    if (authHeader) {
        try {
            const token = authHeader.split(' ')[1];
            // 토큰을 직접 해석해서 userId를 알아냅니다.
            const decoded = jwt.verify(token, JWT_SECRET_KEY);
            
            // 비동기로 저장 실행 (await 안 씀 -> 사용자 응답 속도 저하 방지)
            saveRecentView(decoded.userId, id); 
            console.log("숙소 상세 조회");
        } catch (e) {
            // 토큰이 만료되었거나 비회원이면 그냥 저장 안 하고 넘어감 (에러 아님)
            console.log("비회원 또는 토큰 만료로 인해 기록 안 함");
        }
    }

    try {
        const [accommodations] = await dbPool.query('SELECT * FROM Accommodation WHERE accommodation_id = ?', [id]);
        if (accommodations.length === 0) return res.status(404).json({ message: '숙소 없음' });

        const [rooms] = await dbPool.query('SELECT * FROM RoomType WHERE accommodation_id = ?', [id]);

        res.status(200).json({ accommodation: accommodations[0], rooms });

    } catch (error) {
        console.error('숙소 상세 조회 오류:', error);
        res.status(500).json({ message: '서버 오류' });
    }
};

// 3. 인기 숙소 추천
exports.getPopular = async (req, res) => {
    try {
        const query = `
            SELECT a.accommodation_id, a.name, a.region_city, COUNT(r.reservation_id) AS count, MIN(rt.base_price_per_night) AS min_price 
            FROM Accommodation AS a
            JOIN RoomType AS rt ON a.accommodation_id = rt.accommodation_id 
            JOIN Reservation AS r ON rt.room_type_id = r.room_type_id 
            WHERE r.status = 'CONFIRMED' 
            GROUP BY a.accommodation_id, a.name, a.region_city
            ORDER BY count DESC, min_price ASC
        `;
        const [rows] = await dbPool.query(query);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: '서버 오류' });
    }
};

// 4. 리뷰 작성
exports.createReview = async (req, res) => {
    const userId = req.user.userId || req.user.id;
    let { accommodation_id, rating, content } = req.body;
    
    const image_url = req.file ? `http://localhost:3000/uploads/${req.file.filename}` : null;

    if (rating === undefined || rating === "") rating = 5; 
    if (!accommodation_id || !content) return res.status(400).json({ message: '필수 정보 누락' });

    try {
        await dbPool.query(
            'INSERT INTO Review (user_id, accommodation_id, rating, content, image_url) VALUES (?, ?, ?, ?, ?)', 
            [userId, accommodation_id, rating, content, image_url]
        );

        // 숙소 평점 업데이트
        const updateQuery = `
            UPDATE Accommodation a SET 
            review_count = (SELECT COUNT(*) FROM Review WHERE accommodation_id = a.accommodation_id),
            rating = (SELECT AVG(rating) FROM Review WHERE accommodation_id = a.accommodation_id)
            WHERE a.accommodation_id = ?
        `;
        await dbPool.query(updateQuery, [accommodation_id]);

        res.status(201).json({ message: '후기 등록 성공!' });
    } catch (error) {
        console.error('리뷰 등록 오류:', error);
        res.status(500).json({ message: '서버 오류' });
    }
};

// 5. 리뷰 수정
exports.updateReview = async (req, res) => {
    const { userId } = req.user;
    const { id: reviewId } = req.params;
    let { rating, content } = req.body;

    if (!content) return res.status(400).json({ message: '내용 입력 필요' });

    try {
        const [reviews] = await dbPool.query('SELECT accommodation_id, rating FROM Review WHERE review_id = ? AND user_id = ?', [reviewId, userId]);
        if (reviews.length === 0) return res.status(403).json({ message: '권한 없음' });
        
        const accommodationId = reviews[0].accommodation_id;
        if (!rating) rating = reviews[0].rating;

        await dbPool.query('UPDATE Review SET rating = ?, content = ?, updated_at = NOW() WHERE review_id = ?', [rating, content, reviewId]);
        
        await dbPool.query(`
            UPDATE Accommodation a SET rating = (SELECT AVG(rating) FROM Review WHERE accommodation_id = a.accommodation_id) WHERE accommodation_id = ?
        `, [accommodationId]);

        res.status(200).json({ message: '리뷰 수정 완료' });
    } catch (error) {
        res.status(500).json({ message: '서버 오류' });
    }
};

// 6. 리뷰 삭제
exports.deleteReview = async (req, res) => {
    const { userId } = req.user;
    const { id: reviewId } = req.params;

    try {
        const [reviews] = await dbPool.query('SELECT accommodation_id FROM Review WHERE review_id = ? AND user_id = ?', [reviewId, userId]);
        if (reviews.length === 0) return res.status(403).json({ message: '권한 없음' });

        const accommodationId = reviews[0].accommodation_id;
        await dbPool.query('DELETE FROM Review WHERE review_id = ?', [reviewId]);

        await dbPool.query(`
            UPDATE Accommodation a SET 
            review_count = (SELECT COUNT(*) FROM Review WHERE accommodation_id = a.accommodation_id),
            rating = IFNULL((SELECT AVG(rating) FROM Review WHERE accommodation_id = a.accommodation_id), 0)
            WHERE accommodation_id = ?
        `, [accommodationId]);

        res.status(200).json({ message: '리뷰 삭제 완료' });
    } catch (error) {
        res.status(500).json({ message: '서버 오류' });
    }
};

// 7. 리뷰 목록 조회
exports.getReviews = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT r.*, u.name AS user_name, u.email AS user_email 
            FROM Review r JOIN users u ON r.user_id = u.user_id 
            WHERE r.accommodation_id = ? ORDER BY r.created_at DESC
        `;
        const [reviews] = await dbPool.query(query, [id]);
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ message: '서버 오류' });
    }
};