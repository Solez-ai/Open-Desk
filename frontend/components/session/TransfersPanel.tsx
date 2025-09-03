import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Download, File as FileIcon, Trash2 } from "lucide-react";

export interface ReceivedFile {
  id: string;
  name: string;
  size: number;
  mime?: string;
  fromUserId: string;
  blob: Blob;
  receivedAt: Date;
}

interface TransfersPanelProps {
  files: ReceivedFile[];
  onClose: () => void;
  onClear: (id: string) => void;
  onClearAll: () => void;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default function TransfersPanel({ files, onClose, onClear, onClearAll }: TransfersPanelProps) {
  const sorted = useMemo(() => {
    return [...files].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  }, [files]);

  const handleDownload = (f: ReceivedFile) => {
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name || "download";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="font-semibold text-white">Transfers ({sorted.length})</h3>
        <div className="flex items-center gap-2">
          {sorted.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              className="text-gray-300 border-gray-600 hover:bg-gray-800"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>No transfers yet.</p>
            </div>
          ) : (
            sorted.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileIcon className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{f.name}</div>
                    <div className="text-xs text-gray-400">
                      {humanSize(f.size)} • From {f.fromUserId.slice(0, 8)} • {f.receivedAt.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(f)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onClear(f.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
