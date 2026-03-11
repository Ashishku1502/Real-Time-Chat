const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runSetup() {
    console.log('\n--- 🛠️ NexusChat: Supabase Schema Setup ---');

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sqlFile = path.join(__dirname, 'supabase_setup.sql');

    if (!fs.existsSync(sqlFile)) {
        console.error('❌ Error: "supabase_setup.sql" not found.');
        return;
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');

    if (!serviceRoleKey) {
        console.log('\n⚠️  SUPABASE_SERVICE_ROLE_KEY is not defined in your .env file.');
        console.log('Follow these manual steps to initialize your database:\n');
        console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
        console.log('2. Select your project: ' + supabaseUrl);
        console.log('3. Click on "SQL Editor" in the left sidebar.');
        console.log('4. Create a "New Query".');
        console.log('5. Copy the entire content of "supabase_setup.sql" and paste it into the editor.');
        console.log('6. Click "Run" (top right).');
        console.log('\nOnce done, you can run "node diagnose_supabase.js" to verify.');

        // Proactive help: Try to open the URL for them
        const { exec } = require('child_process');
        const dashboardUrl = `https://supabase.com/dashboard/project/${supabaseUrl.split('//')[1].split('.')[0]}/sql/new`;

        console.log(`\n🚀 Attempting to open the SQL Editor for you: ${dashboardUrl}`);

        const command = process.platform === 'win32' ? `start ${dashboardUrl}` :
            process.platform === 'darwin' ? `open ${dashboardUrl}` :
                `xdg-open ${dashboardUrl}`;

        exec(command, (err) => {
            if (err) console.log('Could not open automatically. Please copy the link above.');
        });

        return;
    }

    console.log('⏳ Connecting to Supabase with Service Role...');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('🚀 Executing SQL Schema...');

    try {
        // We use a trick to execute raw SQL via an RPC call if the user has set up the 'exec_sql' function
        // However, standard Supabase doesn't allow raw SQL execution via API for security.
        // We will try to execute it as a sequence of statements if possible, 
        // but since Supabase JS client doesn't support raw SQL directly without an RPC wrapper,
        // we will provide instructions for a more reliable method if simple insert fails.

        // First, check connection
        const { error: connError } = await supabase.from('users').select('count', { count: 'exact', head: true });

        if (connError && connError.code !== '42P01') {
            // 42P01 is "relation does not exist", which is expected if tables aren't there
            throw new Error('Connection failed: ' + connError.message);
        }

        console.log('✅ Connection verified.');
        console.log('\n⚠️  Supabase does not allow direct SQL execution via the client library for security.');
        console.log('Please copy/paste the content of "supabase_setup.sql" into the Supabase SQL Editor.');
        console.log('\nLink to SQL Editor:');
        console.log(`https://supabase.com/dashboard/project/${supabaseUrl.split('//')[1].split('.')[0]}/sql/new`);

    } catch (err) {
        console.error('❌ Setup error:', err.message);
    }
}

runSetup();

