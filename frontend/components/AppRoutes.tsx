import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AuthPage from "./auth/AuthPage";
import Dashboard from "./dashboard/Dashboard";
import SessionRoom from "./session/SessionRoom";
import LoadingSpinner from "./ui/LoadingSpinner";

export default function AppRoutes() {
  const { loading, isSignedIn } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/auth/*" 
        element={isSignedIn ? <Navigate to="/dashboard" replace /> : <AuthPage />} 
      />
      <Route 
        path="/dashboard" 
        element={isSignedIn ? <Dashboard /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/session/:sessionId" 
        element={isSignedIn ? <SessionRoom /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/" 
        element={<Navigate to={isSignedIn ? "/dashboard" : "/auth"} replace />} 
      />
    </Routes>
  );
}
