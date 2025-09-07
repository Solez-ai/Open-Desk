export interface ICEConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
  iceTransportPolicy?: RTCIceTransportPolicy;
  bundlePolicy?: RTCBundlePolicy;
  rtcpMuxPolicy?: RTCRtcpMuxPolicy;
}

export interface NetworkInfo {
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  downlink: number;
  rtt: number;
}

export class ICEOptimizer {
  private static instance: ICEOptimizer;
  private networkInfo: NetworkInfo | null = null;
  private iceServers: RTCIceServer[] = [];

  private constructor() {
    this.initializeNetworkDetection();
    this.initializeICEServers();
  }

  static getInstance(): ICEOptimizer {
    if (!ICEOptimizer.instance) {
      ICEOptimizer.instance = new ICEOptimizer();
    }
    return ICEOptimizer.instance;
  }

  private async initializeNetworkDetection(): Promise<void> {
    try {
      // Use Network Information API if available
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        this.networkInfo = {
          type: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
        };

        // Listen for network changes
        connection.addEventListener('change', () => {
          this.networkInfo = {
            type: connection.type || 'unknown',
            effectiveType: connection.effectiveType || 'unknown',
            downlink: connection.downlink || 0,
            rtt: connection.rtt || 0,
          };
        });
      }
    } catch (error) {
      console.warn('Network detection not available:', error);
    }
  }

  private async initializeICEServers(): Promise<void> {
    // Default ICE servers - in production, these should be your own STUN/TURN servers
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ];

    // Add TURN servers if available (you should replace these with your own)
    const turnServers = [
      // Example TURN servers - replace with your own
      // { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' },
    ];

    this.iceServers.push(...turnServers);
  }

  async getOptimizedConfig(): Promise<ICEConfig> {
    const config: ICEConfig = {
      iceServers: this.iceServers,
      iceCandidatePoolSize: this.getOptimalCandidatePoolSize(),
      iceTransportPolicy: this.getOptimalTransportPolicy(),
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    return config;
  }

  private getOptimalCandidatePoolSize(): number {
    if (!this.networkInfo) return 10;

    // Adjust candidate pool size based on network conditions
    switch (this.networkInfo.effectiveType) {
      case 'slow-2g':
      case '2g':
        return 5; // Fewer candidates for slow networks
      case '3g':
        return 10;
      case '4g':
        return 15;
      default:
        return 10;
    }
  }

  private getOptimalTransportPolicy(): RTCIceTransportPolicy {
    if (!this.networkInfo) return 'all';

    // Use relay only for very poor networks to save bandwidth
    if (this.networkInfo.effectiveType === 'slow-2g' || this.networkInfo.rtt > 1000) {
      return 'relay';
    }

    return 'all';
  }

  static createOptimizedPeerConnection(
    config: ICEConfig,
    onIceCandidate: (candidate: RTCIceCandidate | null) => void,
    onConnectionStateChange: (state: RTCPeerConnectionState) => void
  ): RTCPeerConnection {
    const pc = new RTCPeerConnection(config);

    // Set up ICE candidate handling
    pc.onicecandidate = (event) => {
      onIceCandidate(event.candidate);
    };

    // Set up connection state monitoring
    pc.onconnectionstatechange = () => {
      onConnectionStateChange(pc.connectionState);
    };

    // Set up ICE connection state monitoring
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    // Set up ICE gathering state monitoring
    pc.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', pc.iceGatheringState);
    };

    return pc;
  }

  static enableAggressiveICE(pc: RTCPeerConnection): void {
    // Configure aggressive ICE gathering for faster connection
    const transceivers = pc.getTransceivers();
    
    transceivers.forEach(transceiver => {
      if (transceiver.sender && transceiver.sender.track) {
        const params = transceiver.sender.getParameters();
        if (params.encodings && params.encodings.length > 0) {
          // Enable simulcast for better quality adaptation
          params.encodings[0].rid = 'high';
          if (params.encodings.length === 1) {
            params.encodings.push({
              rid: 'medium',
              scaleResolutionDownBy: 2,
              maxBitrate: 1000000,
            });
            params.encodings.push({
              rid: 'low',
              scaleResolutionDownBy: 4,
              maxBitrate: 300000,
            });
          }
          transceiver.sender.setParameters(params);
        }
      }
    });
  }

  static async optimizeForNetwork(pc: RTCPeerConnection): Promise<void> {
    const optimizer = ICEOptimizer.getInstance();
    const networkInfo = optimizer.networkInfo;

    if (!networkInfo) return;

    // Adjust bitrate based on network conditions
    const senders = pc.getSenders();
    
    for (const sender of senders) {
      if (!sender.track) continue;

      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      // Adjust encoding parameters based on network
      if (sender.track.kind === 'video') {
        const encoding = params.encodings[0];
        
        switch (networkInfo.effectiveType) {
          case 'slow-2g':
            encoding.maxBitrate = 200000; // 200 kbps
            encoding.maxFramerate = 15;
            encoding.scaleResolutionDownBy = 4;
            break;
          case '2g':
            encoding.maxBitrate = 500000; // 500 kbps
            encoding.maxFramerate = 20;
            encoding.scaleResolutionDownBy = 3;
            break;
          case '3g':
            encoding.maxBitrate = 1000000; // 1 Mbps
            encoding.maxFramerate = 25;
            encoding.scaleResolutionDownBy = 2;
            break;
          case '4g':
            encoding.maxBitrate = 2500000; // 2.5 Mbps
            encoding.maxFramerate = 30;
            encoding.scaleResolutionDownBy = 1.5;
            break;
          default:
            encoding.maxBitrate = 4000000; // 4 Mbps
            encoding.maxFramerate = 60;
            encoding.scaleResolutionDownBy = 1;
        }

        await sender.setParameters(params);
      }
    }
  }

  static async getNetworkQuality(): Promise<'excellent' | 'good' | 'fair' | 'poor'> {
    const optimizer = ICEOptimizer.getInstance();
    const networkInfo = optimizer.networkInfo;

    if (!networkInfo) return 'good';

    // Determine quality based on network metrics
    if (networkInfo.effectiveType === '4g' && networkInfo.rtt < 100) {
      return 'excellent';
    } else if (networkInfo.effectiveType === '4g' && networkInfo.rtt < 200) {
      return 'good';
    } else if (networkInfo.effectiveType === '3g' || (networkInfo.effectiveType === '4g' && networkInfo.rtt < 500)) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  static async testConnectivity(): Promise<{
    stun: boolean;
    turn: boolean;
    latency: number;
  }> {
    const results = {
      stun: false,
      turn: false,
      latency: 0,
    };

    try {
      // Test STUN connectivity
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      const startTime = Date.now();
      
      return new Promise((resolve) => {
      pc.onicecandidate = (event) => {
        if (event.candidate) {
            results.stun = true;
            results.latency = Date.now() - startTime;
          pc.close();
            resolve(results);
          }
        };

        pc.createDataChannel('test');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));

        // Timeout after 5 seconds
        setTimeout(() => {
          pc.close();
          resolve(results);
        }, 5000);
      });
    } catch (error) {
      console.error('Connectivity test failed:', error);
      return results;
    }
  }

  getNetworkInfo(): NetworkInfo | null {
    return this.networkInfo;
  }

  getICEServers(): RTCIceServer[] {
    return [...this.iceServers];
  }
}