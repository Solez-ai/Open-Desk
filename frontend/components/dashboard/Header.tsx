import { APP_NAME } from "../../config";
import ThemeToggle from "../ui/ThemeToggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-emerald-500/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src="/logo.png"
              alt="OpenDesk Logo"
              className="h-7 w-7"
            />
            <span className="pointer-events-none absolute -inset-2 rounded-full ring-1 ring-emerald-500/10" />
          </div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight">
            {APP_NAME}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
