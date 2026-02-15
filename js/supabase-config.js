const SUPABASE_URL = "https://uylrisbibnjhwpbpqhxl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5bHJpc2JpYm5qaHdwYnBxaHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzY4NDksImV4cCI6MjA4NjY1Mjg0OX0._nQUvzRoMKPU2I08weVGCSjvWJMFFITASzetPg8w24M";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const supabaseClient = window.supabaseClient; // Keep local reference for other scripts
