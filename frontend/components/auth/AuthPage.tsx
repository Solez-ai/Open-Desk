import { Routes, Route } from "react-router-dom";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import AuthLayout from "./AuthLayout";

export default function AuthPage() {
  return (
    <AuthLayout>
      <Routes>
        <Route path="/" element={<SignInForm />} />
        <Route path="/sign-in" element={<SignInForm />} />
        <Route path="/sign-up" element={<SignUpForm />} />
        <Route path="/forgot-password" element={<ForgotPasswordForm />} />
      </Routes>
    </AuthLayout>
  );
}
