/**
 * Enterprise-grade validation utilities for OpenDesk
 * Ensures data integrity and security for enterprise clients
 */

export class SessionValidator {
  static validateSessionCode(code: string): boolean {
    // Session codes should be 6-8 characters, alphanumeric
    const cleaned = code.trim().toUpperCase();
    return /^[A-Z0-9]{6,8}$/.test(cleaned);
  }

  static validateFileName(filename: string): boolean {
    // Prevent path traversal and dangerous files
    const dangerous = /[<>:"|?*\x00-\x1f]/;
    const pathTraversal = /\.\./;
    const maxLength = 255;
    
    return !dangerous.test(filename) && 
           !pathTraversal.test(filename) && 
           filename.length > 0 && 
           filename.length <= maxLength;
  }

  static validateFileSize(size: number): boolean {
    const maxSize = 100 * 1024 * 1024; // 100MB
    return size > 0 && size <= maxSize;
  }

  static validateChatMessage(message: string): boolean {
    const trimmed = message.trim();
    return trimmed.length > 0 && trimmed.length <= 1000;
  }

  static sanitizeInput(input: string): string {
    // Remove potentially dangerous characters but preserve readability
    return input.replace(/[<>]/g, '').trim();
  }
}

export class ConnectionValidator {
  static validateWebRTCSupport(): boolean {
    return typeof RTCPeerConnection !== 'undefined' &&
           typeof RTCDataChannel !== 'undefined' &&
           typeof RTCIceCandidate !== 'undefined';
  }

  static validateScreenShareSupport(): boolean {
    return navigator.mediaDevices && 
           typeof navigator.mediaDevices.getDisplayMedia === 'function';
  }

  static validateClipboardSupport(): boolean {
    return navigator.clipboard && 
           typeof navigator.clipboard.writeText === 'function' &&
           typeof navigator.clipboard.readText === 'function';
  }

  static validateBrowserSupport(): { supported: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!this.validateWebRTCSupport()) {
      issues.push('WebRTC not supported');
    }
    
    if (!this.validateScreenShareSupport()) {
      issues.push('Screen sharing not supported');
    }
    
    if (!window.crypto || !window.crypto.subtle) {
      issues.push('Crypto API not available');
    }
    
    if (!window.Worker) {
      issues.push('Web Workers not supported');
    }

    return {
      supported: issues.length === 0,
      issues
    };
  }
}

export class SecurityValidator {
  static validateOrigin(origin: string, allowedOrigins: string[]): boolean {
    return allowedOrigins.includes(origin);
  }

  static validateUserId(userId: string): boolean {
    // UUIDs or similar secure identifiers
    return /^[a-f0-9-]{36}$/.test(userId) || /^[a-zA-Z0-9_-]{10,50}$/.test(userId);
  }

  static validateSessionId(sessionId: string): boolean {
    // UUIDs for session IDs
    return /^[a-f0-9-]{36}$/.test(sessionId);
  }

  static isSecureContext(): boolean {
    return window.isSecureContext || location.protocol === 'https:';
  }
}

export class QualityValidator {
  static validateVideoConstraints(constraints: any): boolean {
    try {
      return constraints.video &&
             typeof constraints.video.width === 'object' &&
             typeof constraints.video.height === 'object' &&
             typeof constraints.video.frameRate === 'object';
    } catch {
      return false;
    }
  }

  static validateBitrateSettings(bitrate: number): boolean {
    const minBitrate = 50000; // 50 kbps
    const maxBitrate = 10000000; // 10 Mbps
    return bitrate >= minBitrate && bitrate <= maxBitrate;
  }

  static validateNetworkQuality(rtt: number, bandwidth: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (rtt < 50 && bandwidth > 5000000) return 'excellent';
    if (rtt < 100 && bandwidth > 2000000) return 'good';
    if (rtt < 300 && bandwidth > 500000) return 'fair';
    return 'poor';
  }
}
