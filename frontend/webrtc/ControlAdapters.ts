export interface ControlAdapter {
  name: string;
  init(): Promise<boolean>;
  destroy(): void;
  onMouseMove(x: number, y: number): void;
  onMouseDown(x: number, y: number, button: number): void;
  onMouseUp(x: number, y: number, button: number): void;
  onScroll(deltaX: number, deltaY: number): void;
  onKeyDown(key: string, code: string, modifiers?: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }): void;
  onKeyUp(key: string, code: string, modifiers?: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }): void;
  onClipboard(content: string): Promise<void>;
}

import { NativeDesktopController } from './NativeDesktopController';

/**
 * Browser-based control adapter that simulates remote control
 * This is a fallback when native agent is not available
 */
export class BrowserEmulatedAdapter implements ControlAdapter {
  name = "Enhanced Browser Control";
  private isInitialized = false;
  private desktopController: NativeDesktopController;

  constructor() {
    this.desktopController = new NativeDesktopController();
    }

  async init(): Promise<boolean> {
    try {
      console.log('[BrowserEmulatedAdapter] Initializing enhanced browser control...');
      
      const success = await this.desktopController.initialize();
      if (success) {
        this.isInitialized = true;
        console.log('[BrowserEmulatedAdapter] Enhanced browser control initialized successfully');
      return true;
      } else {
        throw new Error('Desktop controller initialization failed');
      }
    } catch (error) {
      console.error('[BrowserEmulatedAdapter] Failed to initialize:', error);
      return false;
    }
  }

  destroy(): void {
    if (this.desktopController) {
      this.desktopController.destroy();
    }
    this.isInitialized = false;
  }

  onMouseMove(x: number, y: number): void {
    if (!this.isInitialized || !this.desktopController.isReady()) return;
    
    console.log(`[BrowserEmulatedAdapter] Mouse move: ${x.toFixed(3)}, ${y.toFixed(3)}`);
    this.desktopController.simulateMouseMove(x, y);
  }

  onMouseDown(x: number, y: number, button: number): void {
    if (!this.isInitialized || !this.desktopController.isReady()) return;
    
    const buttonName = button === 0 ? 'Left' : button === 1 ? 'Middle' : 'Right';
    console.log(`[BrowserEmulatedAdapter] Mouse down: ${buttonName} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
    this.desktopController.simulateMouseClick(x, y, button, 'down');
  }

  onMouseUp(x: number, y: number, button: number): void {
    if (!this.isInitialized || !this.desktopController.isReady()) return;
    
    const buttonName = button === 0 ? 'Left' : button === 1 ? 'Middle' : 'Right';
    console.log(`[BrowserEmulatedAdapter] Mouse up: ${buttonName} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
    this.desktopController.simulateMouseClick(x, y, button, 'up');
  }

  onScroll(deltaX: number, deltaY: number): void {
    if (!this.isInitialized || !this.desktopController.isReady()) return;
    
    console.log(`[BrowserEmulatedAdapter] Scroll: deltaX=${deltaX}, deltaY=${deltaY}`);
    this.desktopController.simulateScroll(deltaX, deltaY);
  }

  onKeyDown(key: string, code: string, modifiers?: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }): void {
    if (!this.isInitialized || !this.desktopController.isReady()) return;
    
    console.log(`[BrowserEmulatedAdapter] Key down: ${key} (${code}) with modifiers:`, modifiers);
    this.desktopController.simulateKeyPress(key, code, 'down', modifiers);
  }

  onKeyUp(key: string, code: string, modifiers?: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }): void {
    if (!this.isInitialized || !this.desktopController.isReady()) return;
    
    console.log(`[BrowserEmulatedAdapter] Key up: ${key} (${code}) with modifiers:`, modifiers);
    this.desktopController.simulateKeyPress(key, code, 'up', modifiers);
  }

  async onClipboard(content: string): Promise<void> {
    if (!this.isInitialized || !this.desktopController.isReady()) return;
    
    console.log(`[BrowserEmulatedAdapter] Clipboard content received: ${content.substring(0, 50)}...`);
    await this.desktopController.syncClipboard(content);
  }

}

/**
 * Native agent adapter for actual remote control
 * This would interface with a native application for real control
 */
export class LocalAgentAdapter implements ControlAdapter {
  name = "Native Agent with Browser Fallback";
  private isInitialized = false;
  private agentWindow: Window | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private desktopController: NativeDesktopController;

  constructor() {
    this.desktopController = new NativeDesktopController();
  }

  async init(): Promise<boolean> {
    try {
      console.log('[LocalAgentAdapter] Initializing native agent adapter...');
      
      // Always initialize the desktop controller as fallback
      await this.desktopController.initialize();
      
      // Check if native agent is available
      const agentAvailable = await this.checkNativeAgent();
      
      if (!agentAvailable) {
        console.log('[LocalAgentAdapter] Native agent not available, using browser fallback');
        this.isInitialized = true;
        return true;
      }

      // Set up communication with native agent
      this.setupAgentCommunication();
      
      this.isInitialized = true;
      console.log('[LocalAgentAdapter] Native agent adapter initialized with fallback');
      return true;
    } catch (error) {
      console.error('[LocalAgentAdapter] Failed to initialize:', error);
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
    if (this.desktopController) {
      this.desktopController.destroy();
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
    
    console.log(`[LocalAgentAdapter] Mouse move: ${x.toFixed(3)}, ${y.toFixed(3)}`);
    this.sendToAgent('mouse-move', { x, y });
    
    // Always use browser simulation as fallback
    if (this.desktopController.isReady()) {
      this.desktopController.simulateMouseMove(x, y);
    }
  }

  onMouseDown(x: number, y: number, button: number): void {
    if (!this.isInitialized) return;
    
    const buttonName = button === 0 ? 'Left' : button === 1 ? 'Middle' : 'Right';
    console.log(`[LocalAgentAdapter] Mouse down: ${buttonName} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
    this.sendToAgent('mouse-down', { x, y, button });
    
    // Always use browser simulation as fallback
    if (this.desktopController.isReady()) {
      this.desktopController.simulateMouseClick(x, y, button, 'down');
    }
  }

  onMouseUp(x: number, y: number, button: number): void {
    if (!this.isInitialized) return;
    
    const buttonName = button === 0 ? 'Left' : button === 1 ? 'Middle' : 'Right';
    console.log(`[LocalAgentAdapter] Mouse up: ${buttonName} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
    this.sendToAgent('mouse-up', { x, y, button });
    
    // Always use browser simulation as fallback
    if (this.desktopController.isReady()) {
      this.desktopController.simulateMouseClick(x, y, button, 'up');
    }
  }

  onScroll(deltaX: number, deltaY: number): void {
    if (!this.isInitialized) return;
    
    console.log(`[LocalAgentAdapter] Scroll: deltaX=${deltaX}, deltaY=${deltaY}`);
    this.sendToAgent('scroll', { deltaX, deltaY });
    
    // Always use browser simulation as fallback
    if (this.desktopController.isReady()) {
      this.desktopController.simulateScroll(deltaX, deltaY);
    }
  }

  onKeyDown(key: string, code: string, modifiers?: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }): void {
    if (!this.isInitialized) return;
    
    console.log(`[LocalAgentAdapter] Key down: ${key} (${code}) with modifiers:`, modifiers);
    this.sendToAgent('key-down', { key, code, modifiers });
    
    // Always use browser simulation as fallback
    if (this.desktopController.isReady()) {
      this.desktopController.simulateKeyPress(key, code, 'down', modifiers);
    }
  }

  onKeyUp(key: string, code: string, modifiers?: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }): void {
    if (!this.isInitialized) return;
    
    console.log(`[LocalAgentAdapter] Key up: ${key} (${code}) with modifiers:`, modifiers);
    this.sendToAgent('key-up', { key, code, modifiers });
    
    // Always use browser simulation as fallback
    if (this.desktopController.isReady()) {
      this.desktopController.simulateKeyPress(key, code, 'up', modifiers);
    }
  }

  async onClipboard(content: string): Promise<void> {
    if (!this.isInitialized) return;
    
    console.log(`[LocalAgentAdapter] Clipboard content received: ${content.substring(0, 50)}...`);
    this.sendToAgent('clipboard', { content });
    
    // Always use browser simulation as fallback
    if (this.desktopController.isReady()) {
      await this.desktopController.syncClipboard(content);
    }
  }

}
