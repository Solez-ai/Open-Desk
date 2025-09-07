// Supabase configuration
// These are exposed via Vite's `import.meta.env`
// see: https://vitejs.dev/guide/env-and-mode.html
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Application settings
export const APP_NAME = "OpenDesk";
export const GITHUB_URL = "https://github.com/Solez-ai/Open-Desk";

// WebRTC configuration with optimized ICE servers
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

// Session settings
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
export const MAX_FILE_SIZE_MB = 100;

// Adaptive streaming settings
export const BITRATE_ADAPTATION_INTERVAL_MS = 2000; // 2 seconds
export const QUALITY_ADJUSTMENT_COOLDOWN_MS = 5000; // 5 seconds
export const CONNECTION_QUALITY_HISTORY_SIZE = 10;

// ICE optimization settings
export const ICE_GATHERING_TIMEOUT_MS = 5000; // 5 seconds
export const ICE_CANDIDATE_PAIR_TIMEOUT_MS = 10000; // 10 seconds
export const ICE_CANDIDATE_POOL_SIZE = 10;

// Configuration validation
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};
