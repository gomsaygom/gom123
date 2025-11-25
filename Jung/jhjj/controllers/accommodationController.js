/**
 * [숙소 및 리뷰 로직]
 * - 숙소 목록 조회 (검색, 필터, 태그, 페이지네이션)
 * - 숙소 상세 정보 조회
 * - 인기 숙소 추천 (예약 많은 순)
 * - 후기(Review) 작성(사진 포함), 수정, 삭제, 조회
 */

const dbPool = require('../config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET_KEY } = require('../config/secrets');

// [내부 함수] 최근 본 숙소 저장
const saveRecentView = async (userId, accommodationId) => {
    try {
        const sql = `
            INSERT INTO recently_viewed (user_id, accommodation_id, viewed_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE viewed_at = NOW()
        `;
        await dbPool.query(sql, [userId, accommodationId]);
    } catch (err) {
        console.error('최근 본 숙소 저장 실패 (무시):', err);
    }
};

// 1. 숙소 목록 조회 (검색/필터/페이지네이션)
exports.getAccommodations = async (req, res) => {
    let { type, keyword, tag, page, limit } = req.query; 
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 20;
    const offset = (page - 1) * limit;

    try {
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

// 2. 숙소 상세 조회 (+최근 본 숙소 저장)
exports.getAccommodationDetail = async (req, res) => {
    const { id } = req.params; 

    // 로그인 여부 확인 및 저장
    const authHeader = req.headers.authorization;
    if (authHeader) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET_KEY);
            saveRecentView(decoded.userId, id); 
        } catch (e) {}
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

// 4. 리뷰 작성 (사진 추가 버전)
exports.createReview = async (req, res) => {
    const userId = req.user.userId || req.user.id;
    let { accommodation_id, rating, content } = req.body;
    
    // 👇 [추가됨] 업로드된 파일이 있으면 주소 만들기, 없으면 NULL
    // (윈도우 경로 역슬래시 \ 를 슬래시 / 로 바꿔주는 처리 포함)
    const image_url = req.file ? `http://localhost:3000/uploads/${req.file.filename}` : null;

    if (rating === undefined || rating === "") rating = 5; 
    if (!accommodation_id || !content) return res.status(400).json({ message: '필수 정보 누락' });

    try {
        // 👇 [수정됨] image_url 컬럼 추가
        await dbPool.query(
            'INSERT INTO review (user_id, accommodation_id, rating, content, image_url) VALUES (?, ?, ?, ?, ?)', 
            [userId, accommodation_id, rating, content, image_url]
        );

        // 숙소 평점 업데이트 (기존과 동일)
        const updateQuery = `
            UPDATE accommodation a SET 
            review_count = (SELECT COUNT(*) FROM review WHERE accommodation_id = a.accommodation_id),
            rating = (SELECT AVG(rating) FROM review WHERE accommodation_id = a.accommodation_id)
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
        
        // 평점 재계산
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

        // 평점 재계산
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