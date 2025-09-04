export interface ControlAdapter {
  name: string;
  isConnected(): boolean;
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
 * LocalAgentAdapter
 * Attempts to connect to a local native agent via WebSocket to perform real OS-level inputs.
 * If the agent is installed and running, this enables full remote control.
 * Default URL can be overridden by localStorage key "opendesk_agent_url".
 */
export class LocalAgentAdapter implements ControlAdapter {
  name = "Native Agent";
  private ws: WebSocket | null = null;
  private connected = false;
  private readonly url: string;

  constructor() {
    const override = typeof window !== "undefined" ? localStorage.getItem("opendesk_agent_url") : null;
    this.url = override || "ws://127.0.0.1:9223/opendesk";
  }

  isConnected(): boolean {
    return this.connected;
    }

  async init(): Promise<boolean> {
    try {
      await new Promise<void>((resolve, reject) => {
        try {
          this.ws = new WebSocket(this.url);
        } catch (err) {
          reject(err);
          return;
        }

        const timer = setTimeout(() => {
          try {
            this.ws?.close();
          } catch {}
          this.ws = null;
          reject(new Error("Agent connection timeout"));
        }, 1500);

        this.ws.onopen = () => {
          clearTimeout(timer);
          this.connected = true;
          // Send handshake
          this.send({ type: "hello", client: "opendesk-web" });
          resolve();
        };
        this.ws.onerror = (e) => {
          clearTimeout(timer);
          reject(new Error("WebSocket error"));
        };
        this.ws.onclose = () => {
          this.connected = false;
        };
      });

      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }

  destroy(): void {
    try {
      this.ws?.close();
    } catch {}
    this.ws = null;
    this.connected = false;
  }

  private send(msg: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      // ignore
    }
  }

  onMouseMove(x: number, y: number): void {
    this.send({ type: "mousemove", x, y });
  }
  onMouseDown(x: number, y: number, button: number): void {
    this.send({ type: "mousedown", x, y, button });
  }
  onMouseUp(x: number, y: number, button: number): void {
    this.send({ type: "mouseup", x, y, button });
  }
  onScroll(deltaX: number, deltaY: number): void {
    this.send({ type: "scroll", deltaX, deltaY });
  }
  onKeyDown(key: string, code: string): void {
    this.send({ type: "keydown", key, code });
  }
  onKeyUp(key: string, code: string): void {
    this.send({ type: "keyup", key, code });
  }
  async onClipboard(content: string): Promise<void> {
    this.send({ type: "clipboard", content });
  }
}

/**
 * BrowserEmulatedAdapter
 * Fallback for when the native agent is not available.
 * It cannot control the OS; it only serves as a stub so the session remains usable.
 */
export class BrowserEmulatedAdapter implements ControlAdapter {
  name = "Browser Emulation (Limited)";
  private connected = false;

  isConnected(): boolean {
    return this.connected;
  }

  async init(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  destroy(): void {
    this.connected = false;
  }

  onMouseMove(_x: number, _y: number): void {
    // No-op: cannot control OS via browser alone
  }
  onMouseDown(_x: number, _y: number, _button: number): void {
    // No-op
  }
  onMouseUp(_x: number, _y: number, _button: number): void {
    // No-op
  }
  onScroll(_dx: number, _dy: number): void {
    // No-op
  }
  onKeyDown(_key: string, _code: string): void {
    // No-op
  }
  onKeyUp(_key: string, _code: string): void {
    // No-op
  }
  async onClipboard(content: string): Promise<void> {
    // Best-effort: try to write to browser clipboard
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // ignore
    }
  }
}
