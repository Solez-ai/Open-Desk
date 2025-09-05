import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ICEOptimizer } from "../../webrtc/ICEOptimizer";
import { BrowserEmulatedAdapter, LocalAgentAdapter } from "../../webrtc/ControlAdapters";

export default function WebRTCTest() {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [controlAdapter, setControlAdapter] = useState<BrowserEmulatedAdapter | LocalAgentAdapter | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pc1Ref = useRef<RTCPeerConnection | null>(null);
  const pc2Ref = useRef<RTCPeerConnection | null>(null);
  const { toast } = useToast();

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testScreenCapture = async () => {
    try {
      addResult("Testing screen capture...");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: true,
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      addResult(`Screen capture successful! Tracks: ${stream.getTracks().map(t => t.kind).join(', ')}`);
      return true;
    } catch (error: any) {
      addResult(`Screen capture failed: ${error.message}`);
      return false;
    }
  };

  const testICEConfiguration = async () => {
    try {
      addResult("Testing ICE configuration...");
      const optimizer = ICEOptimizer.getInstance();
      const config = await optimizer.getOptimizedConfig();
      
      addResult(`ICE servers configured: ${config.iceServers.length} servers`);
      addResult(`Candidate pool size: ${config.iceCandidatePoolSize}`);
      addResult(`Transport policy: ${config.iceTransportPolicy}`);
      
      return true;
    } catch (error: any) {
      addResult(`ICE configuration failed: ${error.message}`);
      return false;
    }
  };

  const testConnectivity = async () => {
    try {
      addResult("Testing connectivity...");
      const result = await ICEOptimizer.testConnectivity();
      
      addResult(`STUN connectivity: ${result.stun ? 'OK' : 'Failed'}`);
      addResult(`TURN connectivity: ${result.turn ? 'OK' : 'Failed'}`);
      addResult(`Latency: ${result.latency}ms`);
      
      return result.stun;
    } catch (error: any) {
      addResult(`Connectivity test failed: ${error.message}`);
      return false;
    }
  };

  const testControlAdapter = async () => {
    try {
      addResult("Testing control adapter...");
      
      // Test browser emulation adapter
      const browserAdapter = new BrowserEmulatedAdapter();
      const browserInit = await browserAdapter.init();
      
      if (browserInit) {
        addResult("Browser emulation adapter: OK");
        setControlAdapter(browserAdapter);
        
        // Test control methods
        browserAdapter.onMouseMove(0.5, 0.5);
        browserAdapter.onMouseDown(0.5, 0.5, 0);
        browserAdapter.onMouseUp(0.5, 0.5, 0);
        browserAdapter.onScroll(0, 100);
        browserAdapter.onKeyDown('a', 'KeyA');
        browserAdapter.onKeyUp('a', 'KeyA');
        await browserAdapter.onClipboard('test clipboard content');
        
        addResult("Control adapter methods: OK");
        return true;
      } else {
        addResult("Browser emulation adapter: Failed");
        return false;
      }
    } catch (error: any) {
      addResult(`Control adapter test failed: ${error.message}`);
      return false;
    }
  };

  const testWebRTCConnection = async () => {
    try {
      addResult("Testing WebRTC peer connection...");
      
      if (!localStream) {
        addResult("No local stream available for WebRTC test");
        return false;
      }

      const optimizer = ICEOptimizer.getInstance();
      const config = await optimizer.getOptimizedConfig();

      // Create two peer connections to simulate host and controller
      const pc1 = new RTCPeerConnection(config);
      const pc2 = new RTCPeerConnection(config);

      pc1Ref.current = pc1;
      pc2Ref.current = pc2;

      // Set up event handlers
      pc1.onicecandidate = (event) => {
        if (event.candidate) {
          pc2.addIceCandidate(event.candidate);
        }
      };

      pc2.onicecandidate = (event) => {
        if (event.candidate) {
          pc1.addIceCandidate(event.candidate);
        }
      };

      pc2.ontrack = (event) => {
        addResult("Remote track received!");
        if (event.streams[0]) {
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        }
      };

      // Add tracks to pc1
      localStream.getTracks().forEach(track => {
        pc1.addTrack(track, localStream);
      });

      // Create offer and answer
      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);

      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);

      addResult("WebRTC connection established!");
      return true;
    } catch (error: any) {
      addResult(`WebRTC connection failed: ${error.message}`);
      return false;
    }
  };

  const runAllTests = async () => {
    setIsTestRunning(true);
    clearResults();
    
    addResult("Starting WebRTC functionality tests...");
    
    const tests = [
      { name: "Screen Capture", fn: testScreenCapture },
      { name: "ICE Configuration", fn: testICEConfiguration },
      { name: "Connectivity", fn: testConnectivity },
      { name: "Control Adapter", fn: testControlAdapter },
      { name: "WebRTC Connection", fn: testWebRTCConnection },
    ];

    let passed = 0;
    for (const test of tests) {
      addResult(`\n--- ${test.name} ---`);
      const result = await test.fn();
      if (result) {
        passed++;
        addResult(`${test.name}: PASSED`);
      } else {
        addResult(`${test.name}: FAILED`);
      }
    }

    addResult(`\n--- Test Summary ---`);
    addResult(`Passed: ${passed}/${tests.length}`);
    addResult(`Success rate: ${Math.round((passed / tests.length) * 100)}%`);

    if (passed === tests.length) {
      toast({
        title: "All tests passed!",
        description: "WebRTC functionality is working correctly.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Some tests failed",
        description: `Only ${passed}/${tests.length} tests passed. Check the results above.`,
      });
    }

    setIsTestRunning(false);
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (pc1Ref.current) {
      pc1Ref.current.close();
      pc1Ref.current = null;
    }
    if (pc2Ref.current) {
      pc2Ref.current.close();
      pc2Ref.current = null;
    }
    if (controlAdapter) {
      controlAdapter.destroy();
      setControlAdapter(null);
    }
    setRemoteStream(null);
  };

  useEffect(() => {
    return cleanup;
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">WebRTC Functionality Test</h2>
      
      <div className="mb-4 space-x-2">
        <Button 
          onClick={runAllTests} 
          disabled={isTestRunning}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isTestRunning ? "Running Tests..." : "Run All Tests"}
        </Button>
        <Button 
          onClick={clearResults} 
          variant="outline"
          disabled={isTestRunning}
        >
          Clear Results
        </Button>
        <Button 
          onClick={cleanup} 
          variant="destructive"
          disabled={isTestRunning}
        >
          Cleanup
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Local Stream (Host)</h3>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-48 bg-black rounded border"
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Remote Stream (Controller)</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-48 bg-black rounded border"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Test Results</h3>
        <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
          {testResults.length === 0 ? (
            <div className="text-gray-500">No test results yet. Click "Run All Tests" to start.</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1">{result}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
