import type { ParticipantRole, SessionStatus } from "../common/utils";

export interface Session {
  id: string;
  code: string;
  name?: string | null;
  ownerId: string;
  targetUserId?: string | null;
  status: SessionStatus;
  allowClipboard: boolean;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  id: string;
  sessionId: string;
  userId: string;
  role: ParticipantRole;
  status: "joined" | "left";
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionRequest {
  name?: string;
  targetUserId?: string;
  allowClipboard?: boolean;
  isPublic?: boolean;
}

export interface CreateSessionResponse {
  session: Session;
}

export interface JoinSessionRequest {
  sessionId?: string;
  code?: string;
  role: ParticipantRole;
  // Optional session token to authorize non-owner controllers.
  token?: string;
}

export interface JoinSessionResponse {
  session: Session;
  participant: Participant;
}

export interface LeaveSessionRequest {
  sessionId: string;
}

export interface LeaveSessionResponse {
  success: boolean;
}

export interface TerminateSessionRequest {
  sessionId: string;
}

export interface TerminateSessionResponse {
  session: Session;
}

export interface ListMySessionsResponse {
  sessions: Session[];
}
