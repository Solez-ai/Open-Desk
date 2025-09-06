import { Service } from "encore.dev/service";

export default new Service("session");

// Export all session endpoints
export * from "./create";
export * from "./get";
export * from "./join";
export * from "./join_by_token";
export * from "./leave";
export * from "./terminate";
export * from "./list";
export * from "./list_participants";
export * from "./generate_link";
export * from "./list_tokens";
export * from "./revoke_token";
export * from "./broadcast_status";