import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText, 
  X, 
  Download,
  Library,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { 
  useDocumentUpload, 
  type UploadedDocument 
} from "@/hooks/useDocumentUpload";
import { useToast } from "@/hooks/use-toast";

interface SelectedFile {
  file: File;
  id: string; // Unique ID for the file
}

interface DocumentUploadSectionProps {
  projectId?: number;
  onFilesChange?: (files: File[]) => void;
  onLibraryDocumentsChange?: (documentIds: string[]) => void;
}

const DocumentUploadSection = ({ 
  projectId,
  onFilesChange,
  onLibraryDocumentsChange,
}: DocumentUploadSectionProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [selectedLibraryDocIds, setSelectedLibraryDocIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<SelectedFile | null>(null);
  const fileIdCounter = useRef(0);

  const { fetchLibraryDocuments, isLoading: isLoadingLibrary } = useDocumentUpload();
  const [libraryDocuments, setLibraryDocuments] = useState<UploadedDocument[]>([]);

  // Load library documents on mount
  useEffect(() => {
    const loadLibrary = async () => {
      const docs = await fetchLibraryDocuments();
      setLibraryDocuments(docs);
    };
    loadLibrary();
  }, [fetchLibraryDocuments]);

  // Notify parent when files change
  useEffect(() => {
    const files = selectedFiles.map(sf => sf.file);
    onFilesChange?.(files);
  }, [selectedFiles, onFilesChange]);

  // Notify parent when library documents change
  useEffect(() => {
    onLibraryDocumentsChange?.(selectedLibraryDocIds);
  }, [selectedLibraryDocIds, onLibraryDocumentsChange]);

  const validateFile = (file: File): string | null => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" is too large. Maximum size is 10MB.`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File "${file.name}" has an invalid type. Allowed types: PDF, DOC, DOCX, TXT.`;
    }
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: SelectedFile[] = [];
      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          // Check for duplicates
          const isDuplicate = selectedFiles.some(
            sf => sf.file.name === file.name && sf.file.size === file.size
          );
          if (!isDuplicate) {
            fileIdCounter.current += 1;
            newFiles.push({
              file,
              id: `file-${fileIdCounter.current}-${Date.now()}`,
            });
          }
        }
      });

      if (errors.length > 0) {
        toast({
          title: "Invalid File",
          description: errors[0],
          variant: "destructive",
        });
      }

      if (newFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...newFiles]);
      }

      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      setSelectedFiles(prev => prev.filter(sf => sf.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    }
  };

  const handlePreview = (selectedFile: SelectedFile) => {
    const url = URL.createObjectURL(selectedFile.file);
    window.open(url, "_blank");
    // Clean up the URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const handleLibraryDocToggle = (docId: string, checked: boolean) => {
    if (checked) {
      setSelectedLibraryDocIds(prev => [...prev, docId]);
    } else {
      setSelectedLibraryDocIds(prev => prev.filter(id => id !== docId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Library Documents Section */}
      {libraryDocuments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Library className="h-4 w-4" />
              Select from Library
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose documents from your library to reuse for this application
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {libraryDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={`lib-doc-${doc.id}`}
                      checked={selectedLibraryDocIds.includes(doc.id)}
                      onCheckedChange={(checked) => handleLibraryDocToggle(doc.id, checked as boolean)}
                    />
                    <label
                      htmlFor={`lib-doc-${doc.id}`}
                      className="flex-1 flex items-center gap-3 cursor-pointer min-w-0"
                    >
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Separator */}
      {libraryDocuments.length > 0 && (
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-sm text-muted-foreground">OR</span>
          <Separator className="flex-1" />
        </div>
      )}

      {/* Upload New Files Section */}
      <div>
        <h3 className="text-sm font-medium mb-3">Upload New Documents</h3>
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.txt"
          />
          
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
            <p className="text-xs text-muted-foreground italic">
              Files will be uploaded when you submit your application
            </p>
          </div>
        </div>
      </div>

      {/* Summary of Selected Documents */}
      {(selectedFiles.length > 0 || selectedLibraryDocIds.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Selected Documents ({selectedFiles.length + selectedLibraryDocIds.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Selected Library Documents */}
            {selectedLibraryDocIds.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">From Library:</p>
                {libraryDocuments
                  .filter(doc => selectedLibraryDocIds.includes(doc.id))
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-2 border rounded bg-muted/30"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">Library</Badge>
                    </div>
                  ))}
              </div>
            )}

            {/* New Files to Upload */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedLibraryDocIds.length > 0 && (
                  <p className="text-sm font-medium text-muted-foreground mt-3">New Uploads:</p>
                )}
                {selectedFiles.map((selectedFile) => (
                  <div
                    key={selectedFile.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-background"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {getFileIcon(selectedFile.file.type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{selectedFile.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(selectedFile.file.size)} • Ready to upload
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(selectedFile)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(selectedFile)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteConfirm?.file.name}"? You can add it again before submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentUploadSection;
