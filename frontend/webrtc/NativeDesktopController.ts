/**
 * Enhanced Native Desktop Controller
 * This provides the most comprehensive browser-based remote desktop control possible
 */

export interface DesktopControlCapabilities {
  mouse: boolean;
  keyboard: boolean;
  clipboard: boolean;
  fullscreen: boolean;
  fileSystem: boolean;
}

export class NativeDesktopController {
  private isInitialized = false;
  private capabilities: DesktopControlCapabilities;
  private virtualCursor = { x: 0, y: 0 };
  private keyboardState = new Set<string>();
  private mouseState = { buttons: 0, x: 0, y: 0 };
  private clipboardCache = '';
  private feedbackOverlay: HTMLDivElement | null = null;

  constructor() {
    this.capabilities = {
      mouse: true,
      keyboard: true,
      clipboard: true,
      fullscreen: true,
      fileSystem: false
    };
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('[DesktopController] Initializing native desktop controller...');
      
      // Create feedback overlay
      this.createFeedbackOverlay();
      
      // Request necessary permissions
      await this.requestPermissions();
      
      // Setup global event interceptors
      this.setupEventInterceptors();
      
      this.isInitialized = true;
      console.log('[DesktopController] Native desktop controller initialized successfully');
      return true;
    } catch (error) {
      console.error('[DesktopController] Failed to initialize:', error);
      return false;
    }
  }

  private async requestPermissions(): Promise<void> {
    try {
      // Request clipboard permissions
      if ('permissions' in navigator) {
        await (navigator as any).permissions.query({ name: 'clipboard-write' });
        await (navigator as any).permissions.query({ name: 'clipboard-read' });
      }
    } catch (error) {
      console.warn('[DesktopController] Permission request failed:', error);
    }
  }

  private createFeedbackOverlay(): void {
    this.feedbackOverlay = document.createElement('div');
    this.feedbackOverlay.id = 'desktop-control-overlay';
    this.feedbackOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 999999;
      background: transparent;
    `;
    document.body.appendChild(this.feedbackOverlay);
  }

  private setupEventInterceptors(): void {
    // Intercept and prevent default browser behaviors
    document.addEventListener('contextmenu', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('selectstart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('dragstart', (e) => e.preventDefault(), { passive: false });
    
    // Prevent keyboard shortcuts that might interfere
    document.addEventListener('keydown', (e) => {
      // Allow F5 refresh and F12 dev tools, but prevent others
      if (e.key === 'F5' || e.key === 'F12') return;
      
      // Prevent common browser shortcuts
      if (e.ctrlKey || e.metaKey) {
        const blockedKeys = ['s', 'o', 'p', 'n', 't', 'w', 'r', 'l', 'h', 'j', 'k', 'd', 'f', 'g'];
        if (blockedKeys.includes(e.key.toLowerCase())) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }, { passive: false, capture: true });
  }

  // Enhanced mouse control with precise positioning
  simulateMouseMove(normalizedX: number, normalizedY: number): void {
    if (!this.isInitialized) return;

    const screenX = Math.round(normalizedX * window.innerWidth);
    const screenY = Math.round(normalizedY * window.innerHeight);
    
    this.virtualCursor = { x: screenX, y: screenY };
    this.mouseState.x = screenX;
    this.mouseState.y = screenY;

    // Create and dispatch mouse move event
    const event = new MouseEvent('mousemove', {
      clientX: screenX,
      clientY: screenY,
      screenX: screenX,
      screenY: screenY,
      movementX: 0,
      movementY: 0,
      bubbles: true,
      cancelable: true,
      composed: true
    });

    // Find the topmost element at coordinates
    const element = document.elementFromPoint(screenX, screenY) || document.body;
    
    // Dispatch to element and bubble up
    element.dispatchEvent(event);
    document.dispatchEvent(event);
    window.dispatchEvent(event);

    // Update visual feedback
    this.showMouseFeedback(screenX, screenY, 'move');

    console.log(`[DesktopController] Mouse move: ${screenX}, ${screenY}`);
  }

  simulateMouseClick(normalizedX: number, normalizedY: number, button: number, action: 'down' | 'up'): void {
    if (!this.isInitialized) return;

    const screenX = Math.round(normalizedX * window.innerWidth);
    const screenY = Math.round(normalizedY * window.innerHeight);
    
    this.virtualCursor = { x: screenX, y: screenY };

    const eventType = action === 'down' ? 'mousedown' : 'mouseup';
    const buttonMask = Math.pow(2, button);
    
    if (action === 'down') {
      this.mouseState.buttons |= buttonMask;
    } else {
      this.mouseState.buttons &= ~buttonMask;
    }

    // Create mouse event with all properties
    const event = new MouseEvent(eventType, {
      clientX: screenX,
      clientY: screenY,
      screenX: screenX,
      screenY: screenY,
      button: button,
      buttons: this.mouseState.buttons,
      detail: 1,
      bubbles: true,
      cancelable: true,
      composed: true
    });

    // Find target element
    const element = document.elementFromPoint(screenX, screenY) || document.body;
    
    // Focus the element if it's focusable
    if (action === 'down' && element && 'focus' in element) {
      (element as HTMLElement).focus();
    }

    // Dispatch events
    element.dispatchEvent(event);
    document.dispatchEvent(event);

    // For mouse up, also dispatch click event
    if (action === 'up' && button === 0) {
      const clickEvent = new MouseEvent('click', {
        clientX: screenX,
        clientY: screenY,
        screenX: screenX,
        screenY: screenY,
        button: 0,
        buttons: 0,
        detail: 1,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      
      setTimeout(() => {
        element.dispatchEvent(clickEvent);
        document.dispatchEvent(clickEvent);
      }, 10);
    }

    // Show visual feedback
    const buttonName = button === 0 ? 'Left' : button === 1 ? 'Middle' : 'Right';
    this.showMouseFeedback(screenX, screenY, `${buttonName} ${action}`);

    console.log(`[DesktopController] Mouse ${action}: ${buttonName} at ${screenX}, ${screenY}`);
  }

  simulateScroll(deltaX: number, deltaY: number): void {
    if (!this.isInitialized) return;

    // Find element at cursor position
    const element = document.elementFromPoint(this.virtualCursor.x, this.virtualCursor.y) || document.body;
    
    // Create wheel event
    const wheelEvent = new WheelEvent('wheel', {
      clientX: this.virtualCursor.x,
      clientY: this.virtualCursor.y,
      deltaX: deltaX,
      deltaY: deltaY,
      deltaZ: 0,
      deltaMode: 0, // DOM_DELTA_PIXEL
      bubbles: true,
      cancelable: true,
      composed: true
    });

    // Dispatch to element and let it bubble
    element.dispatchEvent(wheelEvent);

    // Also try scrolling the element directly
    if ('scrollBy' in element) {
      (element as Element).scrollBy(deltaX, deltaY);
    } else if (element.parentElement && 'scrollBy' in element.parentElement) {
      element.parentElement.scrollBy(deltaX, deltaY);
    } else {
      // Fallback to window scroll
      window.scrollBy(deltaX, deltaY);
    }

    // Show visual feedback
    this.showScrollFeedback(deltaX, deltaY);

    console.log(`[DesktopController] Scroll: deltaX=${deltaX}, deltaY=${deltaY}`);
  }

  simulateKeyPress(key: string, code: string, action: 'down' | 'up'): void {
    if (!this.isInitialized) return;

    const eventType = action === 'down' ? 'keydown' : 'keyup';
    
    if (action === 'down') {
      this.keyboardState.add(code);
    } else {
      this.keyboardState.delete(code);
    }

    // Get the currently focused element or use document.body
    const target = document.activeElement || document.body;

    // Create keyboard event with comprehensive properties
    const keyboardEvent = new KeyboardEvent(eventType, {
      key: key,
      code: code,
      keyCode: this.getKeyCode(key),
      which: this.getKeyCode(key),
      charCode: key.length === 1 ? key.charCodeAt(0) : 0,
      shiftKey: this.keyboardState.has('ShiftLeft') || this.keyboardState.has('ShiftRight'),
      ctrlKey: this.keyboardState.has('ControlLeft') || this.keyboardState.has('ControlRight'),
      altKey: this.keyboardState.has('AltLeft') || this.keyboardState.has('AltRight'),
      metaKey: this.keyboardState.has('MetaLeft') || this.keyboardState.has('MetaRight'),
      repeat: false,
      bubbles: true,
      cancelable: true,
      composed: true
    });

    // Dispatch to focused element
    target.dispatchEvent(keyboardEvent);

    // For keydown on printable characters, also dispatch input event
    if (action === 'down' && key.length === 1 && !keyboardEvent.ctrlKey && !keyboardEvent.altKey) {
      const inputEvent = new InputEvent('input', {
        data: key,
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
        composed: true
      });
      
      setTimeout(() => {
        target.dispatchEvent(inputEvent);
        
        // If it's an input element, also update its value
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          const start = target.selectionStart || 0;
          const end = target.selectionEnd || 0;
          const currentValue = target.value;
          target.value = currentValue.slice(0, start) + key + currentValue.slice(end);
          target.selectionStart = target.selectionEnd = start + 1;
        }
      }, 5);
    }

    // Handle special keys
    this.handleSpecialKeys(key, code, action, target);

    // Show visual feedback
    this.showKeyFeedback(key, action);

    console.log(`[DesktopController] Key ${action}: ${key} (${code})`);
  }

  private handleSpecialKeys(key: string, code: string, action: 'down' | 'up', target: Element): void {
    if (action !== 'down') return;

    switch (key) {
      case 'Tab':
        // Handle tab navigation
        const focusableElements = document.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        );
        const currentIndex = Array.from(focusableElements).indexOf(target);
        const nextIndex = (currentIndex + 1) % focusableElements.length;
        (focusableElements[nextIndex] as HTMLElement)?.focus();
        break;
        
      case 'Enter':
        // Trigger click on focused element if it's clickable
        if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) {
          target.click();
        } else if (target instanceof HTMLFormElement) {
          target.submit();
        }
        break;
        
      case 'Escape':
        // Close modals or blur focused element
        if (target !== document.body) {
          (target as HTMLElement).blur();
        }
        break;
    }
  }

  async syncClipboard(content: string): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Write to system clipboard
      await navigator.clipboard.writeText(content);
      this.clipboardCache = content;
      
      console.log(`[DesktopController] Clipboard synced: ${content.slice(0, 50)}...`);
      
      // Show visual feedback
      this.showClipboardFeedback('Clipboard Synced');
    } catch (error) {
      console.error('[DesktopController] Clipboard sync failed:', error);
      this.showClipboardFeedback('Clipboard Failed');
    }
  }

  // Enhanced visual feedback system
  private showMouseFeedback(x: number, y: number, action: string): void {
    if (!this.feedbackOverlay) return;

    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 24px;
      height: 24px;
      border: 2px solid #ff4444;
      border-radius: 50%;
      background: rgba(255, 68, 68, 0.2);
      pointer-events: none;
      z-index: 1000000;
      animation: pulse 0.3s ease-out;
    `;

    const label = document.createElement('div');
    label.textContent = action;
    label.style.cssText = `
      position: absolute;
      left: 30px;
      top: -5px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
    `;

    feedback.appendChild(label);
    this.feedbackOverlay.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 1000);
  }

  private showScrollFeedback(deltaX: number, deltaY: number): void {
    if (!this.feedbackOverlay) return;

    const feedback = document.createElement('div');
    const direction = deltaY > 0 ? '↓' : deltaY < 0 ? '↑' : deltaX > 0 ? '→' : '←';
    
    feedback.textContent = `Scroll ${direction}`;
    feedback.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 100, 255, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      pointer-events: none;
      z-index: 1000000;
      animation: fadeInOut 0.5s ease-out;
    `;

    this.feedbackOverlay.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 500);
  }

  private showKeyFeedback(key: string, action: string): void {
    if (!this.feedbackOverlay) return;

    const feedback = document.createElement('div');
    feedback.textContent = `Key ${action}: ${key}`;
    feedback.style.cssText = `
      position: absolute;
      left: 20px;
      top: 20px;
      background: rgba(100, 0, 255, 0.9);
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      pointer-events: none;
      z-index: 1000000;
      animation: slideIn 0.3s ease-out;
    `;

    this.feedbackOverlay.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 800);
  }

  private showClipboardFeedback(message: string): void {
    if (!this.feedbackOverlay) return;

    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
      position: absolute;
      right: 20px;
      top: 20px;
      background: rgba(0, 150, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      pointer-events: none;
      z-index: 1000000;
      animation: slideIn 0.3s ease-out;
    `;

    this.feedbackOverlay.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 2000);
  }

  private getKeyCode(key: string): number {
    const keyCodeMap: { [key: string]: number } = {
      'Backspace': 8, 'Tab': 9, 'Enter': 13, 'Shift': 16, 'Control': 17, 'Alt': 18,
      'Pause': 19, 'CapsLock': 20, 'Escape': 27, 'Space': 32, 'PageUp': 33, 'PageDown': 34,
      'End': 35, 'Home': 36, 'ArrowLeft': 37, 'ArrowUp': 38, 'ArrowRight': 39, 'ArrowDown': 40,
      'Insert': 45, 'Delete': 46,
      '0': 48, '1': 49, '2': 50, '3': 51, '4': 52, '5': 53, '6': 54, '7': 55, '8': 56, '9': 57,
      'A': 65, 'B': 66, 'C': 67, 'D': 68, 'E': 69, 'F': 70, 'G': 71, 'H': 72, 'I': 73, 'J': 74,
      'K': 75, 'L': 76, 'M': 77, 'N': 78, 'O': 79, 'P': 80, 'Q': 81, 'R': 82, 'S': 83, 'T': 84,
      'U': 85, 'V': 86, 'W': 87, 'X': 88, 'Y': 89, 'Z': 90,
      'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116, 'F6': 117, 'F7': 118, 'F8': 119,
      'F9': 120, 'F10': 121, 'F11': 122, 'F12': 123,
      ';': 186, '=': 187, ',': 188, '-': 189, '.': 190, '/': 191, '`': 192,
      '[': 219, '\\': 220, ']': 221, "'": 222
    };

    return keyCodeMap[key] || key.charCodeAt(0);
  }

  destroy(): void {
    if (this.feedbackOverlay && this.feedbackOverlay.parentNode) {
      this.feedbackOverlay.parentNode.removeChild(this.feedbackOverlay);
    }
    this.feedbackOverlay = null;
    this.isInitialized = false;
    this.keyboardState.clear();
    this.mouseState = { buttons: 0, x: 0, y: 0 };
    
    console.log('[DesktopController] Native desktop controller destroyed');
  }

  getCapabilities(): DesktopControlCapabilities {
    return { ...this.capabilities };
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.8; }
    100% { transform: scale(1); opacity: 0.3; }
  }
  
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  }
  
  @keyframes slideIn {
    0% { opacity: 0; transform: translateX(-20px); }
    100% { opacity: 1; transform: translateX(0); }
  }
`;
document.head.appendChild(style);
