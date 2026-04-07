import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uvdbfnpinyxqcqocdyiv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2ZGJmbnBpbnl4cWNxb2NkeWl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNzE4NzIsImV4cCI6MjA5MDg0Nzg3Mn0.i-m8r9bMG_-5wj7wn55er9Dl2xZrheInvzESQexMpJM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
