const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://uylrisbibnjhwpbpqhxl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5bHJpc2JpYm5qaHdwYnBxaHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzY4NDksImV4cCI6MjA4NjY1Mjg0OX0._nQUvzRoMKPU2I08weVGCSjvWJMFFITASzetPg8w24M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testLogin(identifier, password) {
    console.log(`Testing login for: ${identifier}`);
    try {
        let email = identifier;
        if (!identifier.includes('@')) {
            const { data: user, error: userError } = await supabase
                .from('profiles')
                .select('*')
                .eq('username', identifier.toLowerCase())
                .single();

            if (userError || !user) {
                console.error('Username not found in profiles table:', userError?.message || 'No user');
                return;
            }
            email = user.email;
            console.log(`Found email for username ${identifier}: ${email}`);
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Login failed:', error.message);
            return;
        }

        console.log('Login successful! User ID:', data.user.id);

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError || !profile) {
            console.error('Profile not found for authenticated user:', profileError?.message || 'No profile');
        } else {
            console.log('Profile found:', profile.username, profile.name);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

async function run() {
    console.log('--- Testing Email Login ---');
    await testLogin('test100@gmail.com', 'Rohit@123');
    console.log('\n--- Testing Username Login ---');
    await testLogin('tester', 'Rohit@123');
}

run();
