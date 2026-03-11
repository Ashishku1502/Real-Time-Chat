const supabase = require('./database');

async function testRpc() {
    console.log('--- Testing for exec_sql RPC ---');
    try {
        const { data, error } = await supabase.rpc('exec_sql', {
            query: 'SELECT 1'
        });

        if (error) {
            console.error('❌ RPC Failed:', error.message);
            if (error.message.includes('function "public.exec_sql" does not exist')) {
                console.log('Confirmed: exec_sql function is NOT available.');
            }
        } else {
            console.log('✅ RPC success! exec_sql is available.');
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
    }
}

testRpc();
