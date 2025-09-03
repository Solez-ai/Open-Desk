import { type ReactNode } from "react";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME, GITHUB_URL } from "../../config";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-800 to-emerald-900 text-white flex-col justify-center items-center p-12">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center space-x-3">
            <img src="/logo.png" alt="OpenDesk Logo" className="h-12 w-12" />
            <h1 className="text-4xl font-bold">{APP_NAME}</h1>
          </div>
          <p className="text-xl opacity-90">
            Free, secure, open-source remote desktop
          </p>
          <p className="text-lg opacity-75 max-w-md">
            Connect to any computer from anywhere with our lightweight TeamViewer alternative.
          </p>
          <Button 
            variant="outline" 
            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            onClick={() => window.open(GITHUB_URL, "_blank")}
          >
            <Github className="h-4 w-4 mr-2" />
            Star on GitHub
          </Button>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex flex-col justify-center items-center p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center space-y-4 mb-8">
            <div className="flex items-center justify-center space-x-3">
              <img src="/logo.png" alt="OpenDesk Logo" className="h-8 w-8" />
              <h1 className="text-2xl font-bold">{APP_NAME}</h1>
            </div>
            <p className="text-muted-foreground">
              Free, secure, open-source remote desktop
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
