# OpenDesk - By Samin Yeasar

OpenDesk is a secure, open-source remote desktop web application backend using Encore.ts and Supabase. It aims to be a free, lightweight alternative to TeamViewer — built with simplicity, security, and local-first data handling in mind.

- Authentication: Supabase (JWT) via Encore global auth handler
- Signaling: Supabase Realtime (DB table-based events)
- Backend: Encore.ts (TypeScript), type-safe APIs
- Data Minimization: Only metadata and signaling persist in Supabase; streaming and inputs are peer-to-peer via WebRTC
- Cross-Platform: Intended for a React + TypeScript frontend

Star on GitHub: https://github.com/your-org/opendesk — please consider giving a star!

## Architecture Summary

- Supabase handles:
  - User authentication (email/password, OAuth)
  - Real-time signaling (DB replication via supabase_realtime)
  - Lightweight session metadata, participants, chat, and signals storage with RLS policies
- Encore backend handles:
  - Auth validation (verify Supabase JWT in Authorization or sb-access-token cookie)
  - Session lifecycle endpoints (create, join, leave, terminate, list)
  - Access control checks (owner/participant/target)
  - Publishing signaling and chat rows into Supabase with service role key

## Secrets to Configure (in Leap Infrastructure tab)

- SupabaseURL
- SupabaseServiceRoleKey
- SupabaseJWTSecret

Optionally, also set:
- SupabaseAnonKey (not used server-side, but handy for documentation and tooling)

See supabase/schema.sql for the complete Supabase schema (tables, indexes, RLS policies, publication).

