import { useAuth } from "../contexts/AuthContext";
import backend from "~backend/client";

export function useBackend() {
  const { getToken, isSignedIn } = useAuth();
  
  if (!isSignedIn) return backend;
  
  return backend.with({
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
    }
  });
}
