import { MousePointer2 } from "lucide-react";

interface RemoteCursorProps {
  position: { x: number; y: number };
  name?: string;
}

export default function RemoteCursor({ position, name }: RemoteCursorProps) {
  return (
    <div
      className="absolute top-0 left-0 pointer-events-none z-50 transition-transform duration-75"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <MousePointer2 className="h-6 w-6 text-blue-400" />
      {name && (
        <span className="absolute top-5 left-5 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {name}
        </span>
      )}
    </div>
  );
}
