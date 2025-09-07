export interface ControlAdapter {
  name: string;
  init(): Promise<boolean>;
  destroy(): void;
  onMouseMove(x: number, y: number): void;
  onMouseDown(x: number, y: number, button: number): void;
  onMouseUp(x: number, y: number, button: number): void;
  onScroll(deltaX: number, deltaY: number): void;
  onKeyDown(key: string, code: string): void;
  onKeyUp(key: string, code: string): void;
  onClipboard(content: string): Promise<void>;
}

/**
 * Browser-based control adapter that simulates remote control
 * This is a fallback when native agent is not available
 */
export class BrowserEmulatedAdapter implements ControlAdapter {
  name = "Browser Emulation";
  private isInitialized = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private overlay: HTMLDivElement | null = null;

  async init(): Promise<boolean> {
    try {
      // Create a hidden canvas for drawing cursor feedback
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'fixed';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100vw';
      this.canvas.style.height = '100vh';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '9999';
      this.canvas.style.display = 'none';
      
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) {
        throw new Error('Could not get canvas context');
      }

      // Create overlay for visual feedback
      this.overlay = document.createElement('div');
      this.overlay.style.position = 'fixed';
      this.overlay.style.top = '0';
      this.overlay.style.left = '0';
      this.overlay.style.width = '100vw';
      this.overlay.style.height = '100vh';
      this.overlay.style.pointerEvents = 'none';
      this.overlay.style.zIndex = '9998';
      this.overlay.style.display = 'none';

      document.body.appendChild(this.canvas);
      document.body.appendChild(this.overlay);

      this.isInitialized = true;
      console.log('Browser emulation adapter initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize browser emulation adapter:', error);
      return false;
    }
  }

  destroy(): void {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.canvas = null;
    this.ctx = null;
    this.overlay = null;
    this.isInitialized = false;
  }

  private showVisualFeedback(x: number, y: number, action: string): void {
    if (!this.canvas || !this.ctx || !this.overlay) return;

    // Convert normalized coordinates to screen coordinates
    const screenX = x * window.innerWidth;
    const screenY = y * window.innerHeight;

    // Show canvas
    this.canvas.style.display = 'block';
    this.overlay.style.display = 'block';

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Draw cursor
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, 12, 0, 2 * Math.PI);
    this.ctx.fill();

    // Draw inner dot
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, 4, 0, 2 * Math.PI);
    this.ctx.fill();

    // Draw action indicator
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(screenX + 20, screenY - 25, 100, 30);
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.fillText(action, screenX + 25, screenY - 5);

    // Hide after a short delay
    setTimeout(() => {
      if (this.canvas) this.canvas.style.display = 'none';
      if (this.overlay) this.overlay.style.display = 'none';
    }, 1500);
  }

  onMouseMove(x: number, y: number): void {
    if (!this.isInitialized) return;
    console.log(`[Host] Mouse move: ${x.toFixed(3)}, ${y.toFixed(3)}`);
    this.showVisualFeedback(x, y, 'Mouse Move');
  }

  onMouseDown(x: number, y: number, button: number): void {
    if (!this.isInitialized) return;
    const buttonName = button === 0 ? 'Left' : button === 1 ? 'Middle' : 'Right';
    console.log(`[Host] Mouse down: ${buttonName} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
    this.showVisualFeedback(x, y, `${buttonName} Click`);
  }

  onMouseUp(x: number, y: number, button: number): void {
    if (!this.isInitialized) return;
    const buttonName = button === 0 ? 'Left' : button === 1 ? 'Middle' : 'Right';
    console.log(`[Host] Mouse up: ${buttonName} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
  }

  onScroll(deltaX: number, deltaY: number): void {
    if (!this.isInitialized) return;
    console.log(`[Host] Scroll: deltaX=${deltaX}, deltaY=${deltaY}`);
    // Show scroll indicator in center of screen
    this.showVisualFeedback(0.5, 0.5, `Scroll ${deltaY > 0 ? '↓' : '↑'}`);
  }

  onKeyDown(key: string, code: string): void {
    if (!this.isInitialized) return;
    console.log(`[Host] Key down: ${key} (${code})`);
    // Show key indicator in center of screen
    this.showVisualFeedback(0.5, 0.3, `Key: ${key}`);
  }

  onKeyUp(key: string, code: string): void {
    if (!this.isInitialized) return;
    console.log(`[Host] Key up: ${key} (${code})`);
  }

  async onClipboard(content: string): Promise<void> {
    if (!this.isInitialized) return;
    console.log(`[Host] Clipboard content received: ${content.substring(0, 50)}...`);
    
    try {
      // Try to write to system clipboard
      await navigator.clipboard.writeText(content);
      console.log('[Host] Clipboard content written to system clipboard');
      
      // Show visual feedback
      this.showVisualFeedback(0.5, 0.7, 'Clipboard Synced');
    } catch (error) {
      console.error('[Host] Failed to write to clipboard:', error);
      this.showVisualFeedback(0.5, 0.7, 'Clipboard Failed');
    }
  }
}

/**
 * Native agent adapter for actual remote control
 * This would interface with a native application for real control
 */
export class LocalAgentAdapter implements ControlAdapter {
  name = "Native Agent";
  private isInitialized = false;
  private agentWindow: Window | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  async init(): Promise<boolean> {
    try {
      // Check if native agent is available
      // In a real implementation, this would check for a native app
      const agentAvailable = await this.checkNativeAgent();
      
      if (!agentAvailable) {
        console.log('Native agent not available');
        return false;
      }

      // Set up communication with native agent
      this.setupAgentCommunication();
      
      this.isInitialized = true;
      console.log('Native agent adapter initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize native agent adapter:', error);
      return false;
    }
  }

  private async checkNativeAgent(): Promise<boolean> {
    // In a real implementation, this would check for a native app
    // For now, we'll simulate by checking for a specific window or service
    try {
      // Check if we're in a development environment or if native agent is available
      // For now, we'll return true in development to avoid the popup
      if (import.meta.env.DEV) {
        console.log('Development mode: Simulating native agent availability');
    return true;
      }
      
      // Try to communicate with native agent via postMessage or other mechanism
      // This is a placeholder - real implementation would use proper IPC
      return false; // For now, always return false to use browser emulation
    } catch {
      return false;
    }
  }

  private setupAgentCommunication(): void {
    // Set up message handling for communication with native agent
    this.messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      const { type, data } = event.data;
      if (type === 'agent-response') {
        console.log('Agent response:', data);
      }
    };

    window.addEventListener('message', this.messageHandler);
  }

  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.agentWindow = null;
    this.isInitialized = false;
  }

  private sendToAgent(command: string, data: any): void {
    if (!this.isInitialized) return;
    
    // Send command to native agent
    // In a real implementation, this would use proper IPC
    console.log(`[Host] Sending to native agent: ${command}`, data);
    
    // Simulate agent communication
    if (this.agentWindow) {
      this.agentWindow.postMessage({
        type: 'agent-command',
        command,
        data
      }, '*');
    }

    // For development, simulate successful execution
    if (import.meta.env.DEV) {
      console.log(`[Host] Native agent executed: ${command}`);
    }
  }

  onMouseMove(x: number, y: number): void {
    if (!this.isInitialized) return;
    this.sendToAgent('mouse-move', { x, y });
  }

  onMouseDown(x: number, y: number, button: number): void {
    if (!this.isInitialized) return;
    this.sendToAgent('mouse-down', { x, y, button });
  }

  onMouseUp(x: number, y: number, button: number): void {
    if (!this.isInitialized) return;
    this.sendToAgent('mouse-up', { x, y, button });
  }

  onScroll(deltaX: number, deltaY: number): void {
    if (!this.isInitialized) return;
    this.sendToAgent('scroll', { deltaX, deltaY });
  }

  onKeyDown(key: string, code: string): void {
    if (!this.isInitialized) return;
    this.sendToAgent('key-down', { key, code });
  }

  onKeyUp(key: string, code: string): void {
    if (!this.isInitialized) return;
    this.sendToAgent('key-up', { key, code });
  }

  async onClipboard(content: string): Promise<void> {
    if (!this.isInitialized) return;
    this.sendToAgent('clipboard', { content });
    
    // Also update local clipboard as fallback
    try {
      await navigator.clipboard.writeText(content);
      console.log('[Host] Clipboard content written to system clipboard via native agent');
    } catch (error) {
      console.error('[Host] Failed to write to clipboard via native agent:', error);
    }
  }
}
