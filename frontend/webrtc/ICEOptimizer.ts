export interface ICEConfiguration {
  iceServers: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy;
  bundlePolicy?: RTCBundlePolicy;
  rtcpMuxPolicy?: RTCRtcpMuxPolicy;
  iceCandidatePoolSize?: number;
}

export interface OptimizedICEConfig extends ICEConfiguration {
  gatheringTimeout: number;
  candidatePairTimeout: number;
}

export class ICEOptimizer {
  private static readonly DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ];

  private static readonly REGIONAL_ICE_SERVERS = {
    global: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
    na: [ // North America
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
    ],
    eu: [ // Europe
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
    ],
    ap: [ // Asia Pacific
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.qq.com:3478" },
    ],
  };

  static async getOptimizedConfig(
    customServers?: RTCIceServer[]
  ): Promise<OptimizedICEConfig> {
    const region = await this.detectRegion();
    const regionalServers = this.REGIONAL_ICE_SERVERS[region] || this.REGIONAL_ICE_SERVERS.global;
    
    const iceServers = customServers || [...regionalServers, ...this.DEFAULT_ICE_SERVERS];
    
    // Remove duplicates
    const uniqueServers = this.deduplicateServers(iceServers);

    return {
      iceServers: uniqueServers,
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceCandidatePoolSize: 10, // Pre-gather candidates
      gatheringTimeout: 5000, // 5 seconds
      candidatePairTimeout: 10000, // 10 seconds
    };
  }

  private static async detectRegion(): Promise<keyof typeof ICEOptimizer.REGIONAL_ICE_SERVERS> {
    try {
      // Try to detect region based on timezone and language
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const language = navigator.language;

      if (timezone.includes("America") || language.startsWith("en-US")) {
        return "na";
      } else if (timezone.includes("Europe") || language.startsWith("en-GB") || 
                 language.startsWith("de") || language.startsWith("fr")) {
        return "eu";
      } else if (timezone.includes("Asia") || timezone.includes("Pacific") ||
                 language.startsWith("zh") || language.startsWith("ja") || language.startsWith("ko")) {
        return "ap";
      }

      return "global";
    } catch {
      return "global";
    }
  }

  private static deduplicateServers(servers: RTCIceServer[]): RTCIceServer[] {
    const seen = new Set<string>();
    return servers.filter(server => {
      const key = Array.isArray(server.urls) ? server.urls.join(",") : server.urls;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  static createOptimizedPeerConnection(
    config: OptimizedICEConfig,
    onIceCandidate?: (candidate: RTCIceCandidate | null) => void,
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  ): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: config.iceServers,
      iceTransportPolicy: config.iceTransportPolicy,
      bundlePolicy: config.bundlePolicy,
      rtcpMuxPolicy: config.rtcpMuxPolicy,
      iceCandidatePoolSize: config.iceCandidatePoolSize,
    });

    // Optimize ICE gathering
    let gatheringTimer: number | null = null;
    let gatheringComplete = false;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate?.(event.candidate);
      } else {
        // End of candidates
        gatheringComplete = true;
        if (gatheringTimer) {
          clearTimeout(gatheringTimer);
          gatheringTimer = null;
        }
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "gathering" && !gatheringTimer) {
        // Set a timeout for gathering
        gatheringTimer = window.setTimeout(() => {
          if (!gatheringComplete) {
            console.warn("ICE gathering timeout reached, proceeding with available candidates");
            onIceCandidate?.(null); // Signal end of candidates
          }
        }, config.gatheringTimeout);
      }
    };

    pc.onconnectionstatechange = () => {
      onConnectionStateChange?.(pc.connectionState);
    };

    // Enable aggressive ICE nomination
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "checking") {
        // Connection is attempting to establish, this is normal
        console.log("ICE connection checking...");
      }
    };

    return pc;
  }

  static async testICEServer(server: RTCIceServer): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pc.close();
        resolve(false);
      }, 3000);

      const pc = new RTCPeerConnection({
        iceServers: [server],
        iceCandidatePoolSize: 1,
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          clearTimeout(timeout);
          pc.close();
          resolve(true);
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          pc.close();
          resolve(false);
        }
      };

      // Create a dummy data channel to trigger ICE gathering
      pc.createDataChannel("test");
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
    });
  }

  static async filterWorkingServers(servers: RTCIceServer[]): Promise<RTCIceServer[]> {
    const workingServers: RTCIceServer[] = [];
    
    // Test servers in parallel, but limit concurrency
    const batchSize = 3;
    for (let i = 0; i < servers.length; i += batchSize) {
      const batch = servers.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(server => this.testICEServer(server))
      );
      
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          workingServers.push(batch[index]);
        }
      });
    }

    return workingServers.length > 0 ? workingServers : servers; // Fallback to all if none work
  }

  static enableAggressiveICE(pc: RTCPeerConnection): void {
    // Enable aggressive ICE nomination for faster connection
    const originalSetLocalDescription = pc.setLocalDescription.bind(pc);
    pc.setLocalDescription = function(description: RTCSessionDescriptionInit) {
      if (description.sdp) {
        // Modify SDP to be more aggressive
        description.sdp = description.sdp.replace(
          /a=ice-options:trickle/g,
          "a=ice-options:trickle,aggressive"
        );
      }
      return originalSetLocalDescription(description);
    };
  }
}
