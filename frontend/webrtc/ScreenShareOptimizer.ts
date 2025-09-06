/**
 * Advanced Screen Sharing Optimizer
 * Provides optimal screen capture settings and real-time quality adjustments
 */

export interface ScreenShareConstraints {
  video: {
    width: { ideal: number; max: number };
    height: { ideal: number; max: number };
    frameRate: { ideal: number; max: number };
    cursor?: 'always' | 'motion' | 'never';
    displaySurface?: 'monitor' | 'window' | 'application';
    logicalSurface?: boolean;
    suppressLocalAudioPlayback?: boolean;
  };
  audio: boolean | {
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    sampleRate?: number;
    sampleSize?: number;
    channelCount?: number;
  };
}

export interface QualityProfile {
  name: string;
  constraints: ScreenShareConstraints;
  bitrate: {
    video: { min: number; ideal: number; max: number };
    audio?: { min: number; ideal: number; max: number };
  };
  description: string;
}

export class ScreenShareOptimizer {
  private static instance: ScreenShareOptimizer;
  private currentProfile: QualityProfile;
  private networkMonitor: NetworkMonitor;
  private qualityProfiles: QualityProfile[];

  private constructor() {
    this.networkMonitor = new NetworkMonitor();
    this.initializeQualityProfiles();
    this.currentProfile = this.qualityProfiles[2]; // Default to 'balanced'
  }

  static getInstance(): ScreenShareOptimizer {
    if (!ScreenShareOptimizer.instance) {
      ScreenShareOptimizer.instance = new ScreenShareOptimizer();
    }
    return ScreenShareOptimizer.instance;
  }

  private initializeQualityProfiles(): void {
    this.qualityProfiles = [
      {
        name: 'ultra',
        description: 'Ultra Quality - Best visual fidelity',
        constraints: {
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 60, max: 60 },
            cursor: 'always',
            displaySurface: 'monitor',
            logicalSurface: true,
            suppressLocalAudioPlayback: false
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000,
            sampleSize: 16,
            channelCount: 2
          }
        },
        bitrate: {
          video: { min: 2000000, ideal: 5000000, max: 8000000 },
          audio: { min: 64000, ideal: 128000, max: 256000 }
        }
      },
      {
        name: 'high',
        description: 'High Quality - Great for presentations',
        constraints: {
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
            cursor: 'always',
            displaySurface: 'monitor',
            logicalSurface: true,
            suppressLocalAudioPlayback: false
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
            sampleSize: 16,
            channelCount: 1
          }
        },
        bitrate: {
          video: { min: 1000000, ideal: 3000000, max: 5000000 },
          audio: { min: 32000, ideal: 64000, max: 128000 }
        }
      },
      {
        name: 'balanced',
        description: 'Balanced - Good quality with reasonable bandwidth',
        constraints: {
          video: {
            width: { ideal: 1366, max: 1920 },
            height: { ideal: 768, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
            cursor: 'always',
            displaySurface: 'monitor',
            logicalSurface: true,
            suppressLocalAudioPlayback: false
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
            sampleSize: 16,
            channelCount: 1
          }
        },
        bitrate: {
          video: { min: 500000, ideal: 1500000, max: 3000000 },
          audio: { min: 32000, ideal: 64000, max: 96000 }
        }
      },
      {
        name: 'efficient',
        description: 'Efficient - Lower bandwidth usage',
        constraints: {
          video: {
            width: { ideal: 1280, max: 1366 },
            height: { ideal: 720, max: 768 },
            frameRate: { ideal: 24, max: 30 },
            cursor: 'motion',
            displaySurface: 'monitor',
            logicalSurface: true,
            suppressLocalAudioPlayback: false
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 22050,
            sampleSize: 16,
            channelCount: 1
          }
        },
        bitrate: {
          video: { min: 200000, ideal: 800000, max: 1500000 },
          audio: { min: 16000, ideal: 32000, max: 64000 }
        }
      },
      {
        name: 'minimal',
        description: 'Minimal - Very low bandwidth',
        constraints: {
          video: {
            width: { ideal: 1024, max: 1280 },
            height: { ideal: 576, max: 720 },
            frameRate: { ideal: 15, max: 24 },
            cursor: 'motion',
            displaySurface: 'monitor',
            logicalSurface: true,
            suppressLocalAudioPlayback: false
          },
          audio: false
        },
        bitrate: {
          video: { min: 100000, ideal: 400000, max: 800000 }
        }
      }
    ];
  }

  async getOptimalConstraints(): Promise<ScreenShareConstraints> {
    const networkQuality = await this.networkMonitor.getNetworkQuality();
    const profile = this.selectProfileForNetwork(networkQuality);
    
    console.log(`[ScreenShareOptimizer] Selected profile: ${profile.name} for network quality: ${networkQuality}`);
    return profile.constraints;
  }

  private selectProfileForNetwork(networkQuality: 'excellent' | 'good' | 'fair' | 'poor'): QualityProfile {
    switch (networkQuality) {
      case 'excellent':
        return this.qualityProfiles[0]; // ultra
      case 'good':
        return this.qualityProfiles[1]; // high
      case 'fair':
        return this.qualityProfiles[2]; // balanced
      case 'poor':
        return this.qualityProfiles[3]; // efficient
      default:
        return this.qualityProfiles[4]; // minimal
    }
  }

  async optimizeStream(stream: MediaStream, pc: RTCPeerConnection): Promise<void> {
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    if (videoTrack) {
      await this.optimizeVideoTrack(videoTrack, pc);
    }

    if (audioTrack) {
      await this.optimizeAudioTrack(audioTrack, pc);
    }
  }

  private async optimizeVideoTrack(track: MediaStreamTrack, pc: RTCPeerConnection): Promise<void> {
    try {
      // Apply video constraints to the track
      const capabilities = track.getCapabilities();
      const settings = track.getSettings();
      
      console.log('[ScreenShareOptimizer] Video capabilities:', capabilities);
      console.log('[ScreenShareOptimizer] Current video settings:', settings);

      // Apply constraints if supported
      if ('applyConstraints' in track) {
        const constraints = this.currentProfile.constraints.video;
        await track.applyConstraints({
          width: constraints.width,
          height: constraints.height,
          frameRate: constraints.frameRate
        });
      }

      // Configure encoding parameters for the sender
      const sender = pc.getSenders().find(s => s.track === track);
      if (sender) {
        await this.configureVideoSender(sender);
      }

    } catch (error) {
      console.error('[ScreenShareOptimizer] Failed to optimize video track:', error);
    }
  }

  private async optimizeAudioTrack(track: MediaStreamTrack, pc: RTCPeerConnection): Promise<void> {
    try {
      const capabilities = track.getCapabilities();
      const settings = track.getSettings();
      
      console.log('[ScreenShareOptimizer] Audio capabilities:', capabilities);
      console.log('[ScreenShareOptimizer] Current audio settings:', settings);

      // Configure audio constraints
      const audioConstraints = this.currentProfile.constraints.audio;
      if (typeof audioConstraints === 'object' && 'applyConstraints' in track) {
        await track.applyConstraints({
          echoCancellation: audioConstraints.echoCancellation,
          noiseSuppression: audioConstraints.noiseSuppression,
          sampleRate: audioConstraints.sampleRate,
          sampleSize: audioConstraints.sampleSize,
          channelCount: audioConstraints.channelCount
        });
      }

      // Configure encoding parameters for the sender
      const sender = pc.getSenders().find(s => s.track === track);
      if (sender) {
        await this.configureAudioSender(sender);
      }

    } catch (error) {
      console.error('[ScreenShareOptimizer] Failed to optimize audio track:', error);
    }
  }

  private async configureVideoSender(sender: RTCRtpSender): Promise<void> {
    try {
      const params = sender.getParameters();
      const bitrate = this.currentProfile.bitrate.video;

      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      // Configure primary encoding
      const encoding = params.encodings[0];
      encoding.maxBitrate = bitrate.max;
      encoding.minBitrate = bitrate.min;

      // Enable simulcast for better quality adaptation
      if (params.encodings.length === 1) {
        params.encodings.push({
          rid: 'medium',
          scaleResolutionDownBy: 2,
          maxBitrate: Math.round(bitrate.ideal * 0.6)
        });
        params.encodings.push({
          rid: 'low',
          scaleResolutionDownBy: 4,
          maxBitrate: Math.round(bitrate.ideal * 0.3)
        });
      }

      await sender.setParameters(params);
      console.log('[ScreenShareOptimizer] Video sender configured:', params);
    } catch (error) {
      console.error('[ScreenShareOptimizer] Failed to configure video sender:', error);
    }
  }

  private async configureAudioSender(sender: RTCRtpSender): Promise<void> {
    try {
      const params = sender.getParameters();
      const bitrate = this.currentProfile.bitrate.audio;

      if (!bitrate) return; // Audio disabled

      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      const encoding = params.encodings[0];
      encoding.maxBitrate = bitrate.max;
      encoding.minBitrate = bitrate.min;

      await sender.setParameters(params);
      console.log('[ScreenShareOptimizer] Audio sender configured:', params);
    } catch (error) {
      console.error('[ScreenShareOptimizer] Failed to configure audio sender:', error);
    }
  }

  setQualityProfile(profileName: string): boolean {
    const profile = this.qualityProfiles.find(p => p.name === profileName);
    if (profile) {
      this.currentProfile = profile;
      console.log(`[ScreenShareOptimizer] Quality profile set to: ${profileName}`);
      return true;
    }
    return false;
  }

  getCurrentProfile(): QualityProfile {
    return this.currentProfile;
  }

  getAvailableProfiles(): QualityProfile[] {
    return [...this.qualityProfiles];
  }

  async adaptToNetworkConditions(pc: RTCPeerConnection): Promise<void> {
    const networkQuality = await this.networkMonitor.getNetworkQuality();
    const optimalProfile = this.selectProfileForNetwork(networkQuality);
    
    if (optimalProfile.name !== this.currentProfile.name) {
      console.log(`[ScreenShareOptimizer] Adapting quality from ${this.currentProfile.name} to ${optimalProfile.name}`);
      this.currentProfile = optimalProfile;
      
      // Reconfigure senders with new bitrate settings
      const senders = pc.getSenders();
      for (const sender of senders) {
        if (sender.track?.kind === 'video') {
          await this.configureVideoSender(sender);
        } else if (sender.track?.kind === 'audio') {
          await this.configureAudioSender(sender);
        }
      }
    }
  }
}

class NetworkMonitor {
  async getNetworkQuality(): Promise<'excellent' | 'good' | 'fair' | 'poor'> {
    try {
      // Use Network Information API if available
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        const effectiveType = connection.effectiveType;
        const downlink = connection.downlink;
        const rtt = connection.rtt;

        if (effectiveType === '4g' && downlink >= 10 && rtt <= 100) {
          return 'excellent';
        } else if (effectiveType === '4g' && downlink >= 5 && rtt <= 200) {
          return 'good';
        } else if (effectiveType === '3g' || (effectiveType === '4g' && rtt <= 500)) {
          return 'fair';
        } else {
          return 'poor';
        }
      }

      // Fallback: simple connection test
      const testResult = await this.performConnectionTest();
      return testResult;
    } catch (error) {
      console.warn('[NetworkMonitor] Failed to assess network quality:', error);
      return 'fair'; // Conservative default
    }
  }

  private async performConnectionTest(): Promise<'excellent' | 'good' | 'fair' | 'poor'> {
    try {
      const startTime = Date.now();
      
      // Test with a small image download
      const response = await fetch('/logo.png', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;

      if (response.ok) {
        if (latency < 100) return 'excellent';
        if (latency < 200) return 'good';
        if (latency < 500) return 'fair';
      }
      
      return 'poor';
    } catch (error) {
      return 'poor';
    }
  }
}
