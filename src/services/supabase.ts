import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qogdzcgvkwdnpkeejpef.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvZ2R6Y2d2a3dkbnBrZWVqcGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzU3MTEsImV4cCI6MjEwNjQxMTcxMX0.PA7Wswd56WAAvvGxq3UAnrrhivnxzl7TQonpfHOnwSU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
