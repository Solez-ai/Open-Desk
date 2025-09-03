export type ControlMessageType =
  | "mousemove"
  | "mousedown"
  | "mouseup"
  | "scroll"
  | "keydown"
  | "keyup"
  | "clipboard"
  | "file-meta"
  | "file-chunk"
  | "file-complete";

export interface MouseMoveMessage {
  type: "mousemove";
  x: number; // normalized 0-1
  y: number; // normalized 0-1
}

export interface MouseDownMessage {
  type: "mousedown";
  x: number;
  y: number;
  button: number;
}

export interface MouseUpMessage {
  type: "mouseup";
  x: number;
  y: number;
  button: number;
}

export interface ScrollMessage {
  type: "scroll";
  deltaX: number;
  deltaY: number;
}

export interface KeyMessage {
  type: "keydown" | "keyup";
  key: string;
  code: string;
}

export interface ClipboardMessage {
  type: "clipboard";
  content: string;
}

export interface FileMetaMessage {
  type: "file-meta";
  id: string; // unique file transfer id
  name: string;
  size: number;
  mime?: string;
  fromUserId: string;
}

export interface FileChunkMessage {
  type: "file-chunk";
  id: string; // file transfer id
  index: number; // chunk index
  dataB64: string; // base64 encoded chunk
}

export interface FileCompleteMessage {
  type: "file-complete";
  id: string; // file transfer id
  totalChunks: number;
}

export type ControlMessage =
  | MouseMoveMessage
  | MouseDownMessage
  | MouseUpMessage
  | ScrollMessage
  | KeyMessage
  | ClipboardMessage
  | FileMetaMessage
  | FileChunkMessage
  | FileCompleteMessage;

export type SignalPayload = RTCSessionDescriptionInit | RTCIceCandidateInit;
