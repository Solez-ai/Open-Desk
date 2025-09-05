# OpenDesk WebRTC Setup and Troubleshooting Guide

## Overview

OpenDesk is a remote desktop application that allows users to share their screens and control remote computers through a web browser. The application uses WebRTC for real-time communication and Supabase for signaling and data persistence.

## Key Features Implemented

✅ **Screen Sharing** - Host can share their screen with controllers  
✅ **Remote Control** - Controllers can control the host's mouse, keyboard, and clipboard  
✅ **Real-time Communication** - WebRTC peer-to-peer connections with fallback signaling  
✅ **File Transfer** - Send files between host and controllers  
✅ **Chat System** - Real-time messaging during sessions  
✅ **Quality Adaptation** - Automatic bitrate adjustment based on network conditions  
✅ **Connection Monitoring** - Real-time connection quality indicators  

## Architecture

### Frontend (React + TypeScript)
- **Session Management** - Create, join, and manage remote desktop sessions
- **WebRTC Implementation** - Screen capture, peer connections, and data channels
- **Control Adapters** - Browser emulation and native agent support
- **Quality Monitoring** - Adaptive bitrate and connection quality tracking

### Backend (Encore.ts)
- **Authentication** - Supabase Auth integration
- **Session Management** - Create, update, and terminate sessions
- **Signaling** - WebRTC offer/answer/ICE candidate exchange
- **Real-time Updates** - Supabase realtime subscriptions

### Database (Supabase PostgreSQL)
- **Sessions** - Session metadata and configuration
- **Participants** - User roles and connection status
- **Signals** - WebRTC signaling messages
- **Chat Messages** - Real-time messaging
- **Profiles** - User profile information

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Modern web browser with WebRTC support

### 2. Backend Setup

```bash
cd open-desk/Open-Desk/backend
npm install
```

Set up Supabase secrets:
```bash
encore secret set --type dev SupabaseURL "your-supabase-url"
encore secret set --type dev SupabaseServiceRoleKey "your-service-role-key"
```

Run the backend:
```bash
encore run
```

### 3. Frontend Setup

```bash
cd open-desk/Open-Desk/frontend
npm install
```

Create `.env.local` file:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run the frontend:
```bash
npm run dev
```

### 4. Database Setup

Run the SQL schema in your Supabase SQL editor:
```sql
-- Copy and paste the contents of supabase/schema.sql
```

## Usage

### Creating a Session (Host)

1. Log in to the application
2. Click "Create Session" on the dashboard
3. Configure session settings (clipboard sync, public access)
4. Click "Start Screen Sharing" when ready
5. Share the session code with controllers

### Joining a Session (Controller)

1. Enter the session code on the dashboard
2. Wait for the host to start screen sharing
3. Once connected, you can:
   - View the host's screen
   - Control mouse and keyboard
   - Send files
   - Use chat
   - Sync clipboard (if enabled)

## Troubleshooting

### Common Issues

#### 1. Screen Sharing Not Working

**Symptoms:** "Permission denied" or "Unsupported browser" errors

**Solutions:**
- Ensure you're using HTTPS (required for screen capture)
- Check browser permissions for screen sharing
- Try a different browser (Chrome/Edge work best)
- Disable browser extensions that might block screen capture

#### 2. WebRTC Connection Fails

**Symptoms:** Controllers can't see host screen or connection drops

**Solutions:**
- Check firewall settings (WebRTC uses UDP ports)
- Try different ICE servers in `config.ts`
- Check network connectivity
- Use the WebRTC test component to diagnose issues

#### 3. Remote Control Not Working

**Symptoms:** Mouse/keyboard input doesn't affect host

**Solutions:**
- Ensure control is enabled in the session toolbar
- Check if the host has granted control permissions
- Try refreshing the connection
- Check browser console for errors

#### 4. Poor Video Quality

**Symptoms:** Choppy or low-quality video

**Solutions:**
- Check network bandwidth
- Adjust quality settings in the toolbar
- Enable adaptive bitrate (should be automatic)
- Close other bandwidth-intensive applications

### Debug Tools

#### WebRTC Test Component

Access the test component at `/webrtc-test` to diagnose issues:

1. **Screen Capture Test** - Verifies screen sharing permissions
2. **ICE Configuration Test** - Checks WebRTC configuration
3. **Connectivity Test** - Tests STUN/TURN server connectivity
4. **Control Adapter Test** - Verifies remote control functionality
5. **WebRTC Connection Test** - Tests peer-to-peer connection

#### Browser Developer Tools

Check the console for WebRTC-related errors:
- ICE candidate gathering issues
- Peer connection state changes
- Data channel connection problems
- Media stream track errors

### Network Configuration

#### Firewall Settings

WebRTC requires the following ports to be open:
- **UDP 3478** - STUN/TURN servers
- **UDP 49152-65535** - ICE candidate ports
- **TCP 443** - HTTPS signaling

#### Corporate Networks

Some corporate networks block WebRTC traffic:
- Configure TURN servers for relay
- Use TCP fallback for signaling
- Contact IT department for port access

## Advanced Configuration

### Custom ICE Servers

Edit `frontend/config.ts` to add your own STUN/TURN servers:

```typescript
export const ICE_SERVERS = [
  { urls: "stun:your-stun-server.com:3478" },
  { 
    urls: "turn:your-turn-server.com:3478",
    username: "your-username",
    credential: "your-password"
  }
];
```

### Quality Settings

Adjust video quality in `frontend/webrtc/AdaptiveBitrate.ts`:

```typescript
export const QUALITY_PRESETS = {
  ultra: {
    name: "Ultra (1080p)",
    video: { maxBitrate: 4000000, maxFramerate: 60, scaleResolutionDownBy: 1 },
    audio: { maxBitrate: 128000 },
  },
  // ... other presets
};
```

### Control Adapter Configuration

For native control support, implement the `LocalAgentAdapter`:

```typescript
// This would interface with a native desktop application
// for actual mouse/keyboard control
```

## Security Considerations

### Authentication
- All API endpoints require authentication
- Session access is controlled by participant roles
- Signaling messages are encrypted in transit

### Data Privacy
- Screen content is transmitted peer-to-peer (not stored)
- Chat messages are stored in encrypted database
- File transfers are temporary and not persisted

### Network Security
- WebRTC connections use DTLS encryption
- Signaling uses HTTPS
- Database connections use SSL

## Performance Optimization

### Bandwidth Management
- Adaptive bitrate automatically adjusts quality
- Video compression reduces bandwidth usage
- Audio is compressed using Opus codec

### Connection Optimization
- ICE optimization for faster connections
- Connection pooling for multiple participants
- Automatic reconnection on network issues

### Resource Management
- Memory cleanup on session end
- Track cleanup when screen sharing stops
- Connection cleanup on participant leave

## Monitoring and Analytics

### Connection Quality
- Real-time quality indicators
- Bandwidth and latency monitoring
- Packet loss detection

### Session Metrics
- Participant count and roles
- Session duration and activity
- Error rates and connection failures

## Support

For additional help:
1. Check the browser console for errors
2. Use the WebRTC test component
3. Review the troubleshooting section above
4. Check network connectivity and firewall settings

## Known Limitations

1. **Browser Compatibility** - Requires modern browsers with WebRTC support
2. **Network Requirements** - Needs stable internet connection
3. **Permission Requirements** - Requires screen sharing permissions
4. **Mobile Support** - Limited mobile browser support
5. **File Size Limits** - Large file transfers may timeout

## Future Enhancements

- [ ] Mobile app support
- [ ] Native desktop applications
- [ ] Multi-monitor support
- [ ] Session recording
- [ ] Advanced security features
- [ ] Performance analytics dashboard
