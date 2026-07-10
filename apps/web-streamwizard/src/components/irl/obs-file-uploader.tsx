"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, FileIcon, CheckCircle } from "lucide-react";
import { Button, Progress } from "@repo/ui";
import { cn } from "@repo/ui";

interface UploadFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  progress: number;
  done: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ObsFileUploader() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const newFiles: UploadFile[] = Array.from(incoming).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      type: f.type,
      url: URL.createObjectURL(f),
      progress: 0,
      done: false,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  // Simulate upload progress for newly added files
  useEffect(() => {
    const pending = files.filter((f) => !f.done && f.progress < 100);
    if (pending.length === 0) return;

    const id = setInterval(() => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.done || f.progress >= 100) return f;
          const next = Math.min(100, f.progress + Math.random() * 15 + 5);
          return { ...f, progress: parseFloat(next.toFixed(0)), done: next >= 100 };
        })
      );
    }, 200);

    return () => clearInterval(id);
  }, [files]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 px-6 cursor-pointer transition-all",
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <Upload className={cn("h-8 w-8 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
        <div className="text-center">
          <p className="text-sm font-medium">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Any file type · No size limit</p>
        </div>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={onInputChange} />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="rounded-lg border bg-card p-3 flex items-center gap-3">
              <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                    {file.done ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-xs text-muted-foreground tabular-nums">{file.progress}%</span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {!file.done && (
                  <Progress value={file.progress} className="h-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              files.forEach((f) => URL.revokeObjectURL(f.url));
              setFiles([]);
            }}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
