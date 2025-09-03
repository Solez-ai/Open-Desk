export type ControlMessageType =
  | "mousemove"
  | "mousedown"
  | "mouseup"
  | "scroll"
  | "keydown"
  | "keyup"
  | "clipboard";

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

export type ControlMessage =
  | MouseMoveMessage
  | MouseDownMessage
  | MouseUpMessage
  | ScrollMessage
  | KeyMessage
  | ClipboardMessage;

export type SignalPayload = RTCSessionDescriptionInit | RTCIceCandidateInit;
