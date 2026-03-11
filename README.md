# ⚡ NexusChat — Real-Time Chat Application

A high-performance real-time chat application built with Node.js, Express, and Supabase.

## Features
- 🔐 **User Authentication** — Register, login with JWT tokens (Supabase Auth backend)
- 🏠 **Chat Rooms** — Create rooms, share unique IDs, multi-user real-time chat
- 👥 **Friend System** — Send/accept/reject friend requests
- 💬 **Private Messages** — Persistent DMs between friends
- 🟢 **Online Status** — Real-time presence updates via Supabase
- ✍️ **Typing Indicators** — See when someone is typing
- 📱 **Responsive Design** — Glassmorphic UI that works on all screen sizes

## Setup & Installation

### Prerequisites
- Node.js 16+
- A Supabase Project (https://supabase.com)

### 1. Install Dependencies
```bash
cd chat-app
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret_key
PORT=3000
```

### 3. Initialize Database Schema
Run the setup script for instructions on how to apply the SQL schema to Supabase:
```bash
node apply_schema.js
```

### 4. Start the Application
```bash
npm run dev
```

### 3. Open the App
Navigate to: **http://localhost:3000**

## Usage Guide

### Getting Started
1. **Register** a new account (or login if you already have one)
2. Use the **🔍 search** button to find other users
3. Send a **friend request** — they'll get a real-time notification
4. Once accepted, start **chatting privately**

### Chat Rooms
1. Click **🏠 Rooms** tab → **Create Room**
2. Copy the **8-character Room ID** and share it with others
3. Friends can join via **Join Room** using the ID
4. All members can chat in real time simultaneously

### Friend Requests
- **🔔 Requests** tab shows incoming friend requests
- Accept (✓) or decline (✕) with one click
- Accepted friends appear in your friends list immediately

## Project Structure
```
chat-app/
├── server.js       # Express + Socket.io server
├── database.js     # SQLite schema & connection
├── package.json    # Dependencies
├── chat.db         # SQLite database (auto-created)
└── public/
    └── index.html  # Single-page frontend
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/users/search?q= | Search users |
| POST | /api/friends/request | Send friend request |
| GET | /api/friends/requests | Get pending requests |
| PUT | /api/friends/request/:id | Accept/reject request |
| GET | /api/friends | Get friends list |
| GET | /api/messages/:friendId | Get DM history |
| POST | /api/rooms/create | Create a room |
| POST | /api/rooms/join | Join a room |
| GET | /api/rooms | Get user's rooms |
| GET | /api/rooms/:id/messages | Get room messages |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| private_message | Client→Server | Send a DM |
| private_message_received | Server→Client | Receive a DM |
| room_message | Client→Server | Send room message |
| room_message_received | Server→Client | Receive room message |
| friend_status | Server→Client | Friend online/offline |
| friend_request_received | Server→Client | New friend request |
| friend_request_accepted | Server→Client | Request accepted |
| typing_start | Client→Server | Started typing |
| typing_stop | Client→Server | Stopped typing |
| user_typing | Server→Client | Someone is typing |

## Troubleshooting

### "Database Not Initialized" Error
If you see this error during registration or login, it means the `users` table does not exist in your Supabase project. 
- Ensure you have run the SQL schema in the Supabase Dashboard.
- Run `node diagnose_supabase.js` to verify your connection and table status.

### Port 3000 Already in Use
If the server fails to start with `EADDRINUSE`, another process is using port 3000. 
- On Windows (PowerShell): `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force`
- On Linux/Mac: `fuser -k 3000/tcp`

## Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL + Realtime)
- **Auth**: JWT + Bcrypt
- **Frontend**: Vanilla JS, Glassmorphism CSS
- **Fonts**: Syne, DM Sans, DM Mono

