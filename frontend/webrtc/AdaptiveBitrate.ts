import { ConnectionMonitor, NetworkStats, QualityMetrics } from "./ConnectionMonitor";

export interface BitrateSettings {
  video: {
    maxBitrate: number;
    maxFramerate: number;
    scaleResolutionDownBy: number;
  };
  audio: {
    maxBitrate: number;
  };
}

export interface QualityPreset {
  name: string;
  video: {
    maxBitrate: number; // bps
    maxFramerate: number;
    scaleResolutionDownBy: number;
  };
  audio: {
    maxBitrate: number; // bps
  };
}

export const QUALITY_PRESETS: Record<string, QualityPreset> = {
  ultra: {
    name: "Ultra (1080p)",
    video: { maxBitrate: 4000000, maxFramerate: 60, scaleResolutionDownBy: 1 },
    audio: { maxBitrate: 128000 },
  },
  high: {
    name: "High (720p)",
    video: { maxBitrate: 2500000, maxFramerate: 30, scaleResolutionDownBy: 1.5 },
    audio: { maxBitrate: 96000 },
  },
  medium: {
    name: "Medium (480p)",
    video: { maxBitrate: 1200000, maxFramerate: 30, scaleResolutionDownBy: 2.25 },
    audio: { maxBitrate: 64000 },
  },
  low: {
    name: "Low (360p)",
    video: { maxBitrate: 600000, maxFramerate: 24, scaleResolutionDownBy: 3 },
    audio: { maxBitrate: 48000 },
  },
  minimal: {
    name: "Minimal (240p)",
    video: { maxBitrate: 300000, maxFramerate: 15, scaleResolutionDownBy: 4.5 },
    audio: { maxBitrate: 32000 },
  },
};

export class AdaptiveBitrateController {
  private pc: RTCPeerConnection;
  private monitor: ConnectionMonitor;
  private currentPreset: QualityPreset;
  private autoAdjustEnabled = true;
  private lastAdjustment = 0;
  private readonly ADJUSTMENT_COOLDOWN = 5000; // 5 seconds
  private readonly ADAPTATION_HISTORY_SIZE = 3;
  private adaptationHistory: string[] = [];

  constructor(peerConnection: RTCPeerConnection, initialPreset: keyof typeof QUALITY_PRESETS = "high") {
    this.pc = peerConnection;
    this.monitor = new ConnectionMonitor(peerConnection);
    this.currentPreset = QUALITY_PRESETS[initialPreset];

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.monitor.on("qualityChange", (quality: QualityMetrics) => {
      if (this.autoAdjustEnabled) {
        this.adaptToQuality(quality);
      }
    });

    this.monitor.on("stats", (stats: NetworkStats) => {
      // Additional bandwidth-based adaptation
      if (this.autoAdjustEnabled) {
        this.adaptToBandwidth(stats);
      }
    });
  }

  start(): void {
    this.monitor.start();
  }

  stop(): void {
    this.monitor.stop();
  }

  private async adaptToQuality(quality: QualityMetrics): Promise<void> {
    const now = Date.now();
    if (now - this.lastAdjustment < this.ADJUSTMENT_COOLDOWN) {
      return; // Too soon to adjust again
    }

    let targetPresetKey: keyof typeof QUALITY_PRESETS | null = null;

    switch (quality.category) {
      case "poor":
        if (this.currentPreset.name !== QUALITY_PRESETS.minimal.name) {
          targetPresetKey = this.getPresetKeyByName(this.currentPreset.name);
          if (targetPresetKey) {
            const presetKeys = Object.keys(QUALITY_PRESETS) as (keyof typeof QUALITY_PRESETS)[];
            const currentIndex = presetKeys.indexOf(targetPresetKey);
            if (currentIndex < presetKeys.length - 1) {
              targetPresetKey = presetKeys[currentIndex + 1]; // Move to lower quality
            }
          }
        }
        break;

      case "fair":
        // Stay at current quality or slightly reduce if experiencing issues
        if (quality.issues.includes("High packet loss") || quality.issues.includes("High latency")) {
          targetPresetKey = this.getPresetKeyByName(this.currentPreset.name);
          if (targetPresetKey) {
            const presetKeys = Object.keys(QUALITY_PRESETS) as (keyof typeof QUALITY_PRESETS)[];
            const currentIndex = presetKeys.indexOf(targetPresetKey);
            if (currentIndex < presetKeys.length - 1) {
              targetPresetKey = presetKeys[currentIndex + 1];
            }
          }
        }
        break;

      case "good":
        // Potentially increase quality if we've been stable
        if (this.canIncreaseQuality()) {
          targetPresetKey = this.getPresetKeyByName(this.currentPreset.name);
          if (targetPresetKey) {
            const presetKeys = Object.keys(QUALITY_PRESETS) as (keyof typeof QUALITY_PRESETS)[];
            const currentIndex = presetKeys.indexOf(targetPresetKey);
            if (currentIndex > 0) {
              targetPresetKey = presetKeys[currentIndex - 1]; // Move to higher quality
            }
          }
        }
        break;

      case "excellent":
        // Increase quality if not at maximum
        if (this.currentPreset.name !== QUALITY_PRESETS.ultra.name && this.canIncreaseQuality()) {
          targetPresetKey = this.getPresetKeyByName(this.currentPreset.name);
          if (targetPresetKey) {
            const presetKeys = Object.keys(QUALITY_PRESETS) as (keyof typeof QUALITY_PRESETS)[];
            const currentIndex = presetKeys.indexOf(targetPresetKey);
            if (currentIndex > 0) {
              targetPresetKey = presetKeys[currentIndex - 1];
            }
          }
        }
        break;
    }

    if (targetPresetKey && QUALITY_PRESETS[targetPresetKey].name !== this.currentPreset.name) {
      await this.setQualityPreset(targetPresetKey);
    }
  }

  private async adaptToBandwidth(stats: NetworkStats): Promise<void> {
    const bandwidth = stats.bandwidth;
    if (bandwidth <= 0) return;

    let targetPresetKey: keyof typeof QUALITY_PRESETS | null = null;

    // Conservative bandwidth thresholds
    if (bandwidth < 400000) { // < 400 kbps
      targetPresetKey = "minimal";
    } else if (bandwidth < 800000) { // < 800 kbps
      targetPresetKey = "low";
    } else if (bandwidth < 1500000) { // < 1.5 Mbps
      targetPresetKey = "medium";
    } else if (bandwidth < 3000000) { // < 3 Mbps
      targetPresetKey = "high";
    } else { // >= 3 Mbps
      targetPresetKey = "ultra";
    }

    if (targetPresetKey && QUALITY_PRESETS[targetPresetKey].name !== this.currentPreset.name) {
      const currentPresetKey = this.getPresetKeyByName(this.currentPreset.name);
      if (currentPresetKey) {
        const presetKeys = Object.keys(QUALITY_PRESETS) as (keyof typeof QUALITY_PRESETS)[];
        const currentIndex = presetKeys.indexOf(currentPresetKey);
        const targetIndex = presetKeys.indexOf(targetPresetKey);

        // Only make gradual changes to avoid oscillation
        if (Math.abs(currentIndex - targetIndex) <= 1) {
          await this.setQualityPreset(targetPresetKey);
        }
      }
    }
  }

  private canIncreaseQuality(): boolean {
    // Check if we've been stable at current or lower quality
    const recentAdaptations = this.adaptationHistory.slice(-this.ADAPTATION_HISTORY_SIZE);
    return recentAdaptations.every(adaptation => 
      this.getPresetRank(adaptation) >= this.getPresetRank(this.currentPreset.name)
    );
  }

  private getPresetRank(presetName: string): number {
    const presetKeys = Object.keys(QUALITY_PRESETS);
    for (let i = 0; i < presetKeys.length; i++) {
      if (QUALITY_PRESETS[presetKeys[i] as keyof typeof QUALITY_PRESETS].name === presetName) {
        return i;
      }
    }
    return 0;
  }

  private getPresetKeyByName(name: string): keyof typeof QUALITY_PRESETS | null {
    for (const [key, preset] of Object.entries(QUALITY_PRESETS)) {
      if (preset.name === name) {
        return key as keyof typeof QUALITY_PRESETS;
      }
    }
    return null;
  }

  async setQualityPreset(presetKey: keyof typeof QUALITY_PRESETS): Promise<void> {
    const preset = QUALITY_PRESETS[presetKey];
    if (!preset) return;

    try {
      // Apply settings to all senders
      const senders = this.pc.getSenders();
      
      for (const sender of senders) {
        if (!sender.track) continue;

        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }

        // Apply video settings
        if (sender.track.kind === "video") {
          params.encodings[0].maxBitrate = preset.video.maxBitrate;
          params.encodings[0].maxFramerate = preset.video.maxFramerate;
          params.encodings[0].scaleResolutionDownBy = preset.video.scaleResolutionDownBy;
        }
        
        // Apply audio settings
        if (sender.track.kind === "audio") {
          params.encodings[0].maxBitrate = preset.audio.maxBitrate;
        }

        await sender.setParameters(params);
      }

      this.currentPreset = preset;
      this.lastAdjustment = Date.now();
      
      // Update adaptation history
      this.adaptationHistory.push(preset.name);
      if (this.adaptationHistory.length > this.ADAPTATION_HISTORY_SIZE) {
        this.adaptationHistory.shift();
      }

      console.log(`Adapted to quality preset: ${preset.name}`);
    } catch (error) {
      console.error("Failed to apply quality preset:", error);
    }
  }

  getCurrentPreset(): QualityPreset {
    return this.currentPreset;
  }

  setAutoAdjustEnabled(enabled: boolean): void {
    this.autoAdjustEnabled = enabled;
  }

  isAutoAdjustEnabled(): boolean {
    return this.autoAdjustEnabled;
  }

  getConnectionMonitor(): ConnectionMonitor {
    return this.monitor;
  }

  async forceQualityPreset(presetKey: keyof typeof QUALITY_PRESETS): Promise<void> {
    this.autoAdjustEnabled = false;
    await this.setQualityPreset(presetKey);
  }

  destroy(): void {
    this.monitor.destroy();
  }
}
