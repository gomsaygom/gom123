/**
 * [예약 관련 로직]
 * - 객실 예약하기 (중복 예약 방지 포함)
 * - 예약 취소하기
 * - 내 예약 내역 목록 조회
 */

const dbPool = require('../config/database');

// 1. 예약하기
exports.createReservation = async (req, res) => {
    const { userId } = req.user;
    const { room_type_id, checkin_date, checkout_date, total_price } = req.body;

    if (!room_type_id || !checkin_date || !checkout_date || !total_price) {
        return res.status(400).json({ message: '예약 정보 누락' });
    }

    try {
        // 중복 확인
        const checkQuery = `
            SELECT reservation_id FROM Reservation WHERE room_type_id = ? AND status = 'CONFIRMED'
            AND checkin_date < ? AND checkout_date > ? LIMIT 1
        `;
        const [existing] = await dbPool.query(checkQuery, [room_type_id, checkout_date, checkin_date]);
        if (existing.length > 0) return res.status(409).json({ message: '이미 예약된 날짜입니다.' });

        // 예약 생성
        await dbPool.query(`
            INSERT INTO Reservation (user_id, room_type_id, checkin_date, checkout_date, total_price, status)
            VALUES (?, ?, ?, ?, ?, 'CONFIRMED')
        `, [userId, room_type_id, checkin_date, checkout_date, total_price]);

        res.status(201).json({ message: '예약 성공!' });
    } catch (error) {
        console.error('예약 오류:', error);
        res.status(500).json({ message: '서버 오류' });
    }
};

// 2. 예약 취소
exports.cancelReservation = async (req, res) => {
    const { userId } = req.user;
    const { id } = req.params;

    try {
        const [result] = await dbPool.query(`
            UPDATE Reservation SET status = 'CANCELLED' WHERE reservation_id = ? AND user_id = ?
        `, [id, userId]);

        if (result.affectedRows === 0) return res.status(403).json({ message: '취소 권한 없음' });
        res.status(200).json({ message: '예약 취소 완료' });
    } catch (error) {
        res.status(500).json({ message: '서버 오류' });
    }
};

// ============================================================
// 👇 [수정됨] 3. 내 예약 목록 (자동 '이용완료' 처리 추가)
// ============================================================
exports.getMyReservations = async (req, res) => {
    const { userId } = req.user;

    try {
        // 1. 체크아웃 날짜가 지난 예약은 상태를 'COMPLETED'로 자동 업데이트
        // (쿼리에 백틱 ` ` 을 꼭 붙여야 합니다!)
        await dbPool.query(`
            UPDATE Reservation 
            SET status = 'COMPLETED' 
            WHERE user_id = ? 
            AND checkout_date < CURDATE() 
            AND status = 'CONFIRMED'
        `, [userId]);

        // 2. 업데이트된 최신 목록 조회
        const query = `
            SELECT r.*, rt.name AS room_name, a.name AS accommodation_name, a.address 
            FROM Reservation r 
            JOIN RoomType rt ON r.room_type_id = rt.room_type_id 
            JOIN Accommodation a ON rt.accommodation_id = a.accommodation_id 
            WHERE r.user_id = ? 
            ORDER BY r.checkin_date DESC
        `;

        const [rows] = await dbPool.query(query, [userId]);

        res.status(200).json(rows);
    } catch (error) {
        console.error('예약 목록 조회 오류:', error);
        res.status(500).json({ message: '서버 오류' });
    }
};