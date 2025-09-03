import { APP_NAME } from "../../config";
import ThemeToggle from "../ui/ThemeToggle";

export default function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src="/logo.png" alt="OpenDesk Logo" className="h-8 w-8" />
          <h1 className="text-xl font-bold">{APP_NAME}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
