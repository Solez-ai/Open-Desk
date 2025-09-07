import { Header, Cookie, APIError, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";
import { jwtVerify, JWTPayload } from "jose";

const supabaseJWTSecret = secret("SupabaseJWTSecret");

interface AuthParams {
  // Standard Authorization: Bearer <jwt>
  authorization?: Header<"Authorization">;
  // Supabase cookie (when using auth helpers).
  sbAccessToken?: Cookie<"sb-access-token">;
}

export interface AuthData {
  userID: string;
  email: string | null;
  imageUrl: string | null;
  iss?: string | null;
}

// Verify a Supabase JWT signed with the project's JWT secret.
async function verifySupabaseJWT(token: string): Promise<JWTPayload> {
  try {
    const secretKey = new TextEncoder().encode(supabaseJWTSecret());
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
      // Be more flexible with issuer validation
      clockTolerance: 60, // Allow 60 seconds clock skew
    });
    return payload;
  } catch (err) {
    console.error("JWT verification failed:", err);
    throw APIError.unauthenticated("invalid token signature or claims", err as Error);
  }
}

const auth = authHandler<AuthParams, AuthData>(async (params) => {
  const authz = params.authorization?.trim();
  const bearer = authz?.startsWith("Bearer ") ? authz.slice("Bearer ".length) : undefined;
  const token = bearer ?? params.sbAccessToken?.value;

  if (!token) {
    throw APIError.unauthenticated("missing Authorization header or sb-access-token cookie");
  }

  try {
    const payload = await verifySupabaseJWT(token);
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) {
      throw APIError.unauthenticated("token missing subject");
    }

    const email = (typeof payload.email === "string" ? payload.email : null) ?? null;
    const picture =
      (typeof (payload as any).picture === "string" ? (payload as any).picture : null) ?? null;

    return {
      userID: sub,
      email,
      imageUrl: picture,
      iss: typeof payload.iss === "string" ? payload.iss : null,
    };
  } catch (err) {
    // Log the error for debugging but don't expose details to client
    console.error("Authentication error:", err);
    if (err instanceof APIError) {
      throw err;
    }
    throw APIError.unauthenticated("authentication failed");
  }
});

// Configure the API gateway to use the auth handler and permissive CORS for preview hosts.
export const gw = new Gateway({ authHandler: auth });

// Helper exported for other services if needed later.
export default auth;
