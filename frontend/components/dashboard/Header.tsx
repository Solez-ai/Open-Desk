import { Monitor } from "lucide-react";
import { APP_NAME } from "../../config";
import ThemeToggle from "../ui/ThemeToggle";

export default function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Monitor className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold">{APP_NAME}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
