import { useAuth } from "../contexts/AuthContext";
import backend from "~backend/client";

export function useBackend() {
  const { getToken, isSignedIn } = useAuth();
  
  if (!isSignedIn) return backend;
  
  return backend.with({
    auth: async () => {
      const token = await getToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    }
  });
}
