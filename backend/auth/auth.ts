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
      // Don't hard-enforce issuer/audience to support different Supabase setups;
      // optionally check 'iss' relative to project URL if desired.
    });
    return payload;
  } catch (err) {
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
});

// Configure the API gateway to use the auth handler.
export const gw = new Gateway({ authHandler: auth });

// Helper exported for other services if needed later.
export default auth;
