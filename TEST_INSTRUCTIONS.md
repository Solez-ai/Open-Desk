# Quick Test Instructions

## Test Screen Sharing and Remote Control

### Setup (2 browser tabs/windows)

1. **Tab 1 (Host)**:
   - Go to the app
   - Create a new session
   - Copy the session code

2. **Tab 2 (Controller)**:
   - Go to the app
   - Join session with the code
   - Select "Controller" role

### Test Steps

1. **Host Tab**:
   - Click "Start Screen Sharing"
   - Select screen/window to share
   - **Check**: Host should see a larger preview of their screen
   - **Check**: Should show "Broadcasting to 1 controller(s)"

2. **Controller Tab**:
   - **Check**: Should immediately see the host's screen
   - **Check**: Video should be clear and properly sized
   - **Check**: Should show stream info overlay (video/audio track count)

3. **Remote Control Test**:
   - In controller tab, move mouse over the shared screen
   - Click on different areas
   - Type on keyboard
   - **Check**: Host should see visual feedback for all actions

4. **Chat Test**:
   - Open chat panel on both sides
   - Send messages from both host and controller
   - **Check**: Messages appear instantly on both sides

5. **File Transfer Test**:
   - Upload a file from controller to host
   - **Check**: File should appear in transfers panel and auto-download

## Expected Results

✅ **Host sees larger screen preview**
✅ **Controller sees host's screen immediately**
✅ **Remote control works with visual feedback**
✅ **Chat works in real-time**
✅ **File transfer works**

## Debug Information

Open browser console to see detailed logs:
- `[WebRTC]` - WebRTC connection events
- `[ScreenShare]` - Screen sharing events
- `[RemoteDisplay]` - Video display events
- `[FileTransfer]` - File transfer progress

If issues occur, check the WebRTC Debug panel in bottom-left corner.
