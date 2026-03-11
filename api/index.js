const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cors = require('cors');
const { db, query, run } = require('../database');

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-chat-secret-2024-change-in-production';

// Avatar colors pool
const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Only serve static files via Express in development
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
}

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ─── Online Users Map (userId → socketId) ─────────────────────────────────────
// const onlineUsers = new Map(); 

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const existing = await query('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1', [username, email]);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username or email already taken' });
    }

    const hash = await bcrypt.hash(password, 12);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const result = await run(
      'INSERT INTO users (username, email, password_hash, avatar_color) VALUES (?, ?, ?, ?)',
      [username, email, hash, color]
    );

    const newUser = await query('SELECT id, username, email, avatar_color FROM users WHERE id = ?', [result.id]);

    const token = jwt.sign({ id: result.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: newUser[0] });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error during registration: ' + err.message });
  }
});


app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  try {
    const users = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const user = users[0];

    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar_color: user.avatar_color } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const users = await query('SELECT id, username, email, avatar_color FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = users[0];

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ ...user, online: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching user data' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY
  });
});

// ─── Users Routes ─────────────────────────────────────────────────────────────
app.get('/api/users/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 1) return res.json([]);

  try {
    const users = await query(`
      SELECT 
        u.id, u.username, u.email, u.avatar_color,
        EXISTS(SELECT 1 FROM friends f WHERE (f.user1_id = u.id AND f.user2_id = ?) OR (f.user1_id = ? AND f.user2_id = u.id)) as is_friend,
        EXISTS(SELECT 1 FROM friend_requests fr WHERE fr.sender_id = ? AND fr.receiver_id = u.id AND fr.status = 'pending') as request_sent
      FROM users u
      WHERE u.username LIKE ? AND u.id != ?
      LIMIT 20
    `, [req.user.id, req.user.id, req.user.id, `%${q.trim()}%`, req.user.id]);

    const formatted = users.map(u => ({
      ...u,
      online: false,
      is_friend: !!u.is_friend, // Convert 0/1 to boolean
      request_sent: !!u.request_sent // Convert 0/1 to boolean
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Friends Routes ───────────────────────────────────────────────────────────
app.post('/api/friends/request', authMiddleware, async (req, res) => {
  const { receiverId } = req.body;
  if (!receiverId) return res.status(400).json({ error: 'receiverId required' });
  if (receiverId == req.user.id) return res.status(400).json({ error: 'Cannot friend yourself' });

  try {
    const receivers = await query('SELECT id, username FROM users WHERE id = ? LIMIT 1', [receiverId]);
    const receiver = receivers[0];

    if (!receiver) return res.status(404).json({ error: 'User not found' });

    const friendsRes = await query(
      'SELECT id FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?) LIMIT 1',
      [req.user.id, receiverId, receiverId, req.user.id]
    );

    if (friendsRes.length > 0) return res.status(400).json({ error: 'Already friends' });

    const requests = await query(
      'SELECT id, status FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) LIMIT 1',
      [req.user.id, receiverId, receiverId, req.user.id]
    );
    const existing = requests[0];

    if (existing && existing.status === 'pending') return res.status(400).json({ error: 'Friend request already pending' });

    if (existing) {
      await run('UPDATE friend_requests SET status = "pending", sender_id = ?, receiver_id = ? WHERE id = ?', [req.user.id, receiverId, existing.id]);
    } else {
      await run('INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)', [req.user.id, receiverId]);
    }

    res.json({ success: true, message: `Friend request sent to ${receiver.username}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/friends/requests', authMiddleware, async (req, res) => {
  try {
    const requests = await query(`
      SELECT 
        fr.id, fr.sender_id, fr.created_at,
        u.username as sender_username, u.avatar_color as sender_avatar_color
      FROM friend_requests fr
      JOIN users u ON fr.sender_id = u.id
      WHERE fr.receiver_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `, [req.user.id]);

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/friends/request/:id', authMiddleware, async (req, res) => {
  const { action } = req.body;
  if (!['accept', 'reject'].includes(action))
    return res.status(400).json({ error: 'Action must be accept or reject' });

  try {
    const requests = await query('SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = "pending" LIMIT 1', [req.params.id, req.user.id]);
    const request = requests[0];

    if (!request) return res.status(404).json({ error: 'Request not found' });

    await run('UPDATE friend_requests SET status = ? WHERE id = ?', [action === 'accept' ? 'accepted' : 'rejected', request.id]);

    if (action === 'accept') {
      await run('INSERT INTO friends (user1_id, user2_id) VALUES (?, ?)', [request.sender_id, request.receiver_id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/friends', authMiddleware, async (req, res) => {
  try {
    const friends = await query(`
      SELECT u.id, u.username, u.email, u.avatar_color
      FROM friends f
      JOIN users u ON (f.user1_id = u.id AND f.user2_id = ?) OR (f.user2_id = u.id AND f.user1_id = ?)
      ORDER BY u.username ASC
    `, [req.user.id, req.user.id]);

    res.json(friends.map(f => ({ ...f, online: false })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Messages Routes ──────────────────────────────────────────────────────────
app.get('/api/messages/:friendId', authMiddleware, async (req, res) => {
  const friendId = parseInt(req.params.friendId);
  try {
    const isFriendRes = await query(
      'SELECT id FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?) LIMIT 1',
      [req.user.id, friendId, friendId, req.user.id]
    );

    if (isFriendRes.length === 0) return res.status(403).json({ error: 'Not friends with this user' });

    const messages = await query(`
      SELECT 
        m.*,
        u.username as sender_username, u.avatar_color as sender_avatar_color
      FROM private_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
      LIMIT 200
    `, [req.user.id, friendId, friendId, req.user.id]);

    await run('UPDATE private_messages SET read_at = CURRENT_TIMESTAMP WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL', [req.user.id, friendId]);

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/send', authMiddleware, async (req, res) => {
  const { receiverId, message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });

  try {
    const isFriendRes = await query(
      'SELECT id FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?) LIMIT 1',
      [req.user.id, receiverId, receiverId, req.user.id]
    );

    if (isFriendRes.length === 0) return res.status(403).json({ error: 'Not friends with this user' });

    const result = await run(
      'INSERT INTO private_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
      [req.user.id, receiverId, message.trim()]
    );

    const saved = await query('SELECT * FROM private_messages WHERE id = ?', [result.id]);
    res.json(saved[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Rooms Routes ─────────────────────────────────────────────────────────────
app.post('/api/rooms/create', authMiddleware, async (req, res) => {
  const { name, description } = req.body;
  if (!name || name.trim().length < 1) return res.status(400).json({ error: 'Room name required' });

  try {
    const roomId = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();

    await run(
      'INSERT INTO rooms (room_id, name, description, creator_id) VALUES (?, ?, ?, ?)',
      [roomId, name.trim(), description?.trim() || '', req.user.id]
    );

    const roomRes = await query('SELECT * FROM rooms WHERE room_id = ? LIMIT 1', [roomId]);
    const room = roomRes[0];

    await run('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)', [roomId, req.user.id]);

    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rooms/join', authMiddleware, async (req, res) => {
  const { roomId } = req.body;
  if (!roomId) return res.status(400).json({ error: 'Room ID required' });

  try {
    const roomRes = await query('SELECT * FROM rooms WHERE LOWER(room_id) = LOWER(?) LIMIT 1', [roomId.trim()]);
    const room = roomRes[0];

    if (!room) return res.status(404).json({ error: 'Room not found. Check the room ID.' });

    await run('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)', [room.room_id, req.user.id]);

    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms', authMiddleware, async (req, res) => {
  try {
    const memberOf = await query('SELECT room_id FROM room_members WHERE user_id = ?', [req.user.id]);
    const roomIds = memberOf.map(m => m.room_id);

    if (roomIds.length === 0) return res.json([]);

    const placeholders = roomIds.map(() => '?').join(',');
    const roomList = await query(`
      SELECT 
        r.*,
        (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.room_id) as member_count,
        (SELECT COUNT(*) FROM room_messages rms WHERE rms.room_id = r.room_id) as message_count
      FROM rooms r
      WHERE r.room_id IN (${placeholders})
      ORDER BY r.created_at DESC
    `, roomIds);

    res.json(roomList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms/:roomId/messages', authMiddleware, async (req, res) => {
  try {
    const isMemberRes = await query('SELECT id FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1', [req.params.roomId, req.user.id]);

    if (isMemberRes.length === 0) return res.status(403).json({ error: 'Not a member of this room' });

    const messages = await query(`
      SELECT 
        m.*,
        u.username as username, u.avatar_color as avatar_color
      FROM room_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.created_at ASC
      LIMIT 200
    `, [req.params.roomId]);

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rooms/messages/send', authMiddleware, async (req, res) => {
  const { roomId, message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });

  try {
    const isMemberRes = await query('SELECT id FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1', [roomId, req.user.id]);

    if (isMemberRes.length === 0) return res.status(403).json({ error: 'Not a member of this room' });

    const result = await run(
      'INSERT INTO room_messages (room_id, user_id, message) VALUES (?, ?, ?)',
      [roomId, req.user.id, message.trim()]
    );

    const saved = await query(`
      SELECT 
        m.*,
        u.username as username, u.avatar_color as avatar_color
      FROM room_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `, [result.id]);

    res.json(saved[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms/:roomId/members', authMiddleware, async (req, res) => {
  try {
    const members = await query(`
      SELECT 
        u.id, u.username, u.avatar_color
      FROM room_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.room_id = ?
    `, [req.params.roomId]);

    const formatted = members.map(m => ({
      ...m,
      online: false
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/rooms/:roomId/leave', authMiddleware, async (req, res) => {
  try {
    await run('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', [req.params.roomId, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
