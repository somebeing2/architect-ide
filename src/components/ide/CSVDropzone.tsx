import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';

interface CSVDropzoneProps {
  onFileLoaded: (data: string, fileName: string) => void;
  fileName?: string;
  onClear: () => void;
}

export function CSVDropzone({ onFileLoaded, fileName, onClear }: CSVDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onFileLoaded(text, file.name);
    };
    reader.readAsText(file);
  }, [onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (fileName) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded text-sm">
        <FileSpreadsheet className="w-4 h-4 text-accent" />
        <span className="text-foreground font-mono text-xs">{fileName}</span>
        <button onClick={onClear} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200
        ${isDragging 
          ? 'border-primary bg-dropzone-bg/10 animate-pulse-glow' 
          : 'border-border hover:border-primary/50 hover:bg-secondary/50'
        }
      `}
    >
      <Upload className={`w-10 h-10 ${isDragging ? 'text-primary' : 'text-muted-foreground'} transition-colors`} />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Drop CSV here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Supports .csv files</p>
      </div>
      <input type="file" accept=".csv" onChange={handleInputChange} className="hidden" />
    </label>
  );
}
