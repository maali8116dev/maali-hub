import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  Download, 
  AlertCircle 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  useDocumentUpload, 
  type UploadedDocument,
  getDocumentDownloadUrl 
} from "@/hooks/useDocumentUpload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DocumentUploadSectionProps {
  applicationId?: string;
  projectId?: number;
  onDocumentsChange?: (documents: UploadedDocument[]) => void;
  initialDocumentIds?: string[];
}

const DocumentUploadSection = ({ 
  applicationId,
  projectId,
  onDocumentsChange,
  initialDocumentIds,
}: DocumentUploadSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UploadedDocument | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const {
    uploadDocuments,
    deleteDocument,
    isUploading,
    uploadProgress,
    documents,
  } = useDocumentUpload();

  // Notify parent when documents change (using ref to prevent infinite loops)
  const prevDocumentsRef = useRef<UploadedDocument[]>([]);
  
  useEffect(() => {
    // Only notify if documents actually changed (by comparing IDs)
    const prevIds = prevDocumentsRef.current.map(d => d.id).sort().join(',');
    const currentIds = documents.map(d => d.id).sort().join(',');
    
    if (prevIds !== currentIds) {
      prevDocumentsRef.current = documents;
      onDocumentsChange?.(documents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]); // onDocumentsChange intentionally omitted to prevent infinite loop

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        await uploadDocuments(Array.from(files), applicationId, projectId);
        // The useEffect will automatically notify parent when documents state updates
      } catch (error) {
        console.error("File upload error:", error);
      }
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      const success = await deleteDocument(deleteConfirm);
      if (success) {
        onDocumentsChange?.(documents.filter((d) => d.id !== deleteConfirm.id));
      }
      setDeleteConfirm(null);
    }
  };

  const handleDownload = async (doc: UploadedDocument) => {
    setDownloadingId(doc.id);
    try {
      const url = await getDocumentDownloadUrl(doc.filePath);
      if (url) {
        window.open(url, "_blank");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    // Could expand this for different file types
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isUploading 
            ? "border-primary/50 bg-primary/5" 
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.txt"
          disabled={isUploading}
        />
        
        {isUploading ? (
          <div className="space-y-3">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading files...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Files
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              PDF, DOC, DOCX, or TXT (max 10MB each)
            </p>
          </div>
        )}
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          {uploadProgress.map((progress) => (
            <div
              key={progress.fileName}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
            >
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{progress.fileName}</p>
                <Progress 
                  value={progress.status === "completed" ? 100 : 50} 
                  className="h-1 mt-1" 
                />
              </div>
              {progress.status === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              {progress.status === "error" && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Uploaded Documents ({documents.length})</p>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-background"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getFileIcon(doc.fileType)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                  >
                    {downloadingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(doc)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.fileName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentUploadSection;
