const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Use the OS temp directory for serverless compatibility (e.g. Vercel)
const dbPath = path.join(os.tmpdir(), 'chat.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database at', dbPath);
    db.run('PRAGMA foreign_keys = ON;');

    // Initialize schema if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          avatar_color TEXT DEFAULT '#6C63FF',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS rooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          creator_id INTEGER REFERENCES users(id),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS room_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT REFERENCES rooms(room_id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(room_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS room_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT REFERENCES rooms(room_id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          message TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS friend_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(sender_id, receiver_id)
      );

      CREATE TABLE IF NOT EXISTS friends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user1_id, user2_id)
      );

      CREATE TABLE IF NOT EXISTS private_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          message TEXT NOT NULL,
          read_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
});

// Polyfill Promise wrapper for SQLite queries
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

module.exports = { db, query, run };
