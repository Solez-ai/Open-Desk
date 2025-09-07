import { useAuth } from "../contexts/AuthContext";
import { Client } from "~backend/client";

function inferBackendBaseURL(): string {
  try {
    const { origin, host, protocol } = window.location;
    // leap.new / lp.dev preview and Encore cloud: use same-origin to avoid CORS
    if (host.endsWith(".lp.dev") || host.endsWith(".encr.app")) return origin;
    // Fallback to env or local
    const envTarget = (import.meta as any)?.env?.VITE_CLIENT_TARGET as string | undefined;
    return envTarget || `${protocol}//localhost:4000`;
  } catch {
    return "http://localhost:4000";
  }
}

export function useBackend() {
  const { getToken, isSignedIn } = useAuth();
  const baseURL = inferBackendBaseURL();
  const baseClient = new Client(baseURL, { requestInit: { credentials: "include" } });

  if (!isSignedIn) return baseClient;

  return baseClient.with({
    auth: async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.warn("No auth token available");
          return {};
        }
        return { authorization: `Bearer ${token}` };
      } catch (error) {
        console.error("Failed to get auth token:", error);
        return {};
      }
    },
  });
}
