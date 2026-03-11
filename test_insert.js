const supabase = require('./database');

async function testInsert() {
    console.log('--- Testing User Table Insertion ---');
    const { data, error } = await supabase
        .from('users')
        .insert({
            username: 'testuser_' + Date.now(),
            email: 'test_' + Date.now() + '@example.com',
            password_hash: 'test',
            avatar_color: '#6C63FF'
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Insert failed:', error.message);
        console.error('Error Code:', error.code);
    } else {
        console.log('✅ Insert successful! User ID:', data.id);
        // Clean up
        await supabase.from('users').delete().eq('id', data.id);
        console.log('🗑️ Test user cleaned up.');
    }
}

testInsert();
