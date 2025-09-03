import { EventEmitter } from "events";

export interface NetworkStats {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsLost: number;
  packetsLostRate: number;
  jitter: number;
  roundTripTime: number;
  bandwidth: number;
  timestamp: number;
}

export interface QualityMetrics {
  score: number; // 0-100
  category: "excellent" | "good" | "fair" | "poor";
  issues: string[];
}

export class ConnectionMonitor extends EventEmitter {
  private pc: RTCPeerConnection;
  private statsInterval: number | null = null;
  private previousStats: NetworkStats | null = null;
  private readonly STATS_INTERVAL = 1000; // 1 second
  private readonly QUALITY_HISTORY_SIZE = 10;
  private qualityHistory: QualityMetrics[] = [];

  constructor(peerConnection: RTCPeerConnection) {
    super();
    this.pc = peerConnection;
  }

  start(): void {
    if (this.statsInterval) return;

    this.statsInterval = window.setInterval(async () => {
      try {
        const stats = await this.collectStats();
        if (stats) {
          const quality = this.calculateQuality(stats);
          this.updateQualityHistory(quality);
          
          this.emit("stats", stats);
          this.emit("quality", quality);
          
          // Emit quality change events
          if (this.hasQualityChanged()) {
            this.emit("qualityChange", quality);
          }
        }
      } catch (error) {
        console.error("Failed to collect stats:", error);
      }
    }, this.STATS_INTERVAL);
  }

  stop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private async collectStats(): Promise<NetworkStats | null> {
    try {
      const statsReport = await this.pc.getStats();
      let inboundRtp: RTCInboundRtpStreamStats | null = null;
      let outboundRtp: RTCOutboundRtpStreamStats | null = null;
      let candidatePair: RTCIceCandidatePairStats | null = null;

      statsReport.forEach((report) => {
        if (report.type === "inbound-rtp" && report.mediaType === "video") {
          inboundRtp = report as RTCInboundRtpStreamStats;
        } else if (report.type === "outbound-rtp" && report.mediaType === "video") {
          outboundRtp = report as RTCOutboundRtpStreamStats;
        } else if (report.type === "candidate-pair" && (report as RTCIceCandidatePairStats).state === "succeeded") {
          candidatePair = report as RTCIceCandidatePairStats;
        }
      });

      if (!inboundRtp && !outboundRtp) return null;

      const now = Date.now();
      const stats: NetworkStats = {
        bytesReceived: inboundRtp?.bytesReceived || 0,
        bytesSent: outboundRtp?.bytesSent || 0,
        packetsReceived: inboundRtp?.packetsReceived || 0,
        packetsLost: inboundRtp?.packetsLost || 0,
        packetsLostRate: this.calculatePacketLossRate(inboundRtp),
        jitter: inboundRtp?.jitter || 0,
        roundTripTime: candidatePair?.currentRoundTripTime || 0,
        bandwidth: this.calculateBandwidth(inboundRtp, outboundRtp),
        timestamp: now,
      };

      this.previousStats = stats;
      return stats;
    } catch (error) {
      console.error("Error collecting WebRTC stats:", error);
      return null;
    }
  }

  private calculatePacketLossRate(inbound: RTCInboundRtpStreamStats | null): number {
    if (!inbound) return 0;
    
    const packetsReceived = inbound.packetsReceived || 0;
    const packetsLost = inbound.packetsLost || 0;
    const totalPackets = packetsReceived + packetsLost;
    
    return totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;
  }

  private calculateBandwidth(
    inbound: RTCInboundRtpStreamStats | null,
    outbound: RTCOutboundRtpStreamStats | null
  ): number {
    if (!this.previousStats) return 0;

    const currentBytes = (inbound?.bytesReceived || 0) + (outbound?.bytesSent || 0);
    const previousBytes = this.previousStats.bytesReceived + this.previousStats.bytesSent;
    const timeDiff = (Date.now() - this.previousStats.timestamp) / 1000; // seconds

    if (timeDiff <= 0) return 0;

    const bytesDiff = currentBytes - previousBytes;
    return (bytesDiff * 8) / timeDiff; // bits per second
  }

  private calculateQuality(stats: NetworkStats): QualityMetrics {
    let score = 100;
    const issues: string[] = [];

    // Packet loss impact (0-40 points)
    if (stats.packetsLostRate > 5) {
      score -= 40;
      issues.push("High packet loss");
    } else if (stats.packetsLostRate > 2) {
      score -= 20;
      issues.push("Moderate packet loss");
    } else if (stats.packetsLostRate > 0.5) {
      score -= 10;
      issues.push("Minor packet loss");
    }

    // RTT impact (0-30 points)
    if (stats.roundTripTime > 300) {
      score -= 30;
      issues.push("High latency");
    } else if (stats.roundTripTime > 150) {
      score -= 15;
      issues.push("Moderate latency");
    } else if (stats.roundTripTime > 100) {
      score -= 5;
      issues.push("Minor latency");
    }

    // Jitter impact (0-20 points)
    if (stats.jitter > 50) {
      score -= 20;
      issues.push("High jitter");
    } else if (stats.jitter > 30) {
      score -= 10;
      issues.push("Moderate jitter");
    }

    // Bandwidth impact (0-10 points)
    if (stats.bandwidth < 500000) { // Less than 500 kbps
      score -= 10;
      issues.push("Low bandwidth");
    }

    score = Math.max(0, Math.min(100, score));

    let category: QualityMetrics["category"];
    if (score >= 85) category = "excellent";
    else if (score >= 70) category = "good";
    else if (score >= 50) category = "fair";
    else category = "poor";

    return { score, category, issues };
  }

  private updateQualityHistory(quality: QualityMetrics): void {
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
  }

  private hasQualityChanged(): boolean {
    if (this.qualityHistory.length < 2) return false;
    
    const current = this.qualityHistory[this.qualityHistory.length - 1];
    const previous = this.qualityHistory[this.qualityHistory.length - 2];
    
    return current.category !== previous.category;
  }

  getAverageQuality(): QualityMetrics | null {
    if (this.qualityHistory.length === 0) return null;

    const avgScore = this.qualityHistory.reduce((sum, q) => sum + q.score, 0) / this.qualityHistory.length;
    const allIssues = [...new Set(this.qualityHistory.flatMap(q => q.issues))];

    let category: QualityMetrics["category"];
    if (avgScore >= 85) category = "excellent";
    else if (avgScore >= 70) category = "good";
    else if (avgScore >= 50) category = "fair";
    else category = "poor";

    return {
      score: Math.round(avgScore),
      category,
      issues: allIssues,
    };
  }

  getCurrentStats(): NetworkStats | null {
    return this.previousStats;
  }

  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}
