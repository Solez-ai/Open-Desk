// Supabase configuration
// These are exposed via Vite's `import.meta.env`
// see: https://vitejs.dev/guide/env-and-mode.html
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Application settings
export const APP_NAME = "OpenDesk";
export const GITHUB_URL = "https://github.com/your-org/opendesk";

// WebRTC configuration
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// Session settings
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
export const MAX_FILE_SIZE_MB = 100;

// Configuration validation
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};
