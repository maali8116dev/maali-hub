import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | null) => void;
  onUpload: (file: File) => Promise<string | null>;
  onDelete?: (url: string) => Promise<boolean>;
  isUploading?: boolean;
  uploadProgress?: number;
  className?: string;
  placeholder?: string;
  accept?: string;
  variant?: "avatar" | "banner";
}

export const ImageUpload = ({
  value,
  onChange,
  onUpload,
  onDelete,
  isUploading = false,
  uploadProgress = 0,
  className,
  placeholder = "Upload Image",
  accept = "image/jpeg,image/png,image/webp,image/gif",
  variant = "avatar",
}: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = async (file: File) => {
    const url = await onUpload(file);
    if (url && typeof onChange === "function") {
      onChange(url);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelect(file);
    }
  };

  const handleRemove = async () => {
    if (value && onDelete) {
      const deleted = await onDelete(value);
      if (deleted && typeof onChange === "function") {
        onChange(null);
      }
    } else if (typeof onChange === "function") {
      onChange(null);
    }
  };

  if (variant === "avatar") {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <Avatar className="h-20 w-20">
          <AvatarImage src={value} alt="Avatar" />
          <AvatarFallback>
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
          />
          
          {isUploading ? (
            <div className="w-32">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Loading...</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {value ? "Change" : placeholder}
              </Button>
              
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Banner variant
  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-lg transition-colors",
        dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        className
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />
      
      {value ? (
        <div className="relative">
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-48 object-cover rounded-lg"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Change
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : isUploading ? (
        <div className="p-8 text-center">
          <Progress value={uploadProgress} className="h-2 mb-2" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full p-8 text-center cursor-pointer"
        >
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Drag and drop an image, or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            JPG, PNG, WebP, GIF up to 5MB
          </p>
        </button>
      )}
    </div>
  );
};








