import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SessionProvider } from "./contexts/SessionContext";
import { SupabaseProvider } from "./contexts/SupabaseContext";
import AppRoutes from "./components/AppRoutes";
import { clerkPublishableKey } from "./config";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SupabaseProvider>
            <SessionProvider>
              <BrowserRouter>
                <div className="min-h-screen bg-background text-foreground">
                  <AppRoutes />
                  <Toaster />
                </div>
              </BrowserRouter>
            </SessionProvider>
          </SupabaseProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
