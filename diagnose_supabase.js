const supabase = require('./database');

async function checkConnection() {
    console.log('--- Supabase Diagnostic ---');
    console.log('URL:', process.env.SUPABASE_URL);

    const tables = ['users', 'rooms', 'room_members', 'room_messages', 'friend_requests', 'friends', 'private_messages'];

    for (const table of tables) {
        try {
            const { data, error } = await supabase
                .from(table)
                .select('id')
                .limit(1);

            if (error) {
                console.error(`❌ Table "${table}":`, error.message);
            } else {
                console.log(`✅ Table "${table}": OK`);
            }
        } catch (err) {
            console.error(`❌ Table "${table}": Unexpected error:`, err.message);
        }
    }
}

checkConnection();
