-- NexusChat Supabase Schema Setup

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#6C63FF',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    creator_id BIGINT REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Room Members Table
CREATE TABLE IF NOT EXISTS public.room_members (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT REFERENCES public.rooms(room_id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- 4. Room Messages Table
CREATE TABLE IF NOT EXISTS public.room_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT REFERENCES public.rooms(room_id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Friend Requests Table
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sender_id, receiver_id)
);

-- 6. Friends Table
CREATE TABLE IF NOT EXISTS public.friends (
    id BIGSERIAL PRIMARY KEY,
    user1_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    user2_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);

-- 7. Private Messages Table
CREATE TABLE IF NOT EXISTS public.private_messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
