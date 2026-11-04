import { useRef, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pickLocalizedField, type OpportunityTranslations } from "@/lib/localizedContent";
import { ListItemsRenderer } from "@/components/projects/ListItemsRenderer";
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
  Loader2,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon
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
import { useApplicationFormStore } from "@/stores/applicationForm";

interface SelectedFile {
  file: File;
  id: string; // Unique ID for the file
}

interface DocumentUploadSectionProps {
  opportunityId?: number;
  onFilesChange?: (files: File[]) => void;
  onLibraryDocumentsChange?: (documentIds: string[]) => void;
  applicantType?: "Individual" | "Organization" | "Startup / SME" | "NGO / Non-profit" | "Research / Academic";
}

const DocumentUploadSection = ({ 
  opportunityId,
  onFilesChange,
  onLibraryDocumentsChange,
  applicantType,
}: DocumentUploadSectionProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const doc = "applications.form.documents";
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SelectedFile | null>(null);
  const fileIdCounter = useRef(0);

  // Get selected files from store (persists across navigation)
  const { selectedFiles: storeFiles, selectedLibraryDocIds: storeLibraryIds, setSelectedFiles, setSelectedLibraryDocIds } = useApplicationFormStore();
  
  // Local state for SelectedFile[] (includes IDs for UI)
  const [selectedFiles, setSelectedFilesLocal] = useState<SelectedFile[]>([]);
  const [selectedLibraryDocIds, setSelectedLibraryDocIdsLocal] = useState<string[]>([]);

  const { fetchLibraryDocuments, isLoading: isLoadingLibrary } = useDocumentUpload();
  const [libraryDocuments, setLibraryDocuments] = useState<UploadedDocument[]>([]);

  const { data: opportunityDocs } = useQuery({
    queryKey: ["opportunity-document-requirements", opportunityId, i18n.language],
    queryFn: async () => {
      if (!opportunityId) return null;
      const { data, error } = await supabase
        .from("opportunities")
        .select("requirements, translations")
        .eq("id", opportunityId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        requirements: string | null;
        translations: OpportunityTranslations | null;
      } | null;
    },
    enabled: !!opportunityId,
  });

  const localizedRequirements = useMemo(() => {
    if (!opportunityDocs?.requirements?.trim()) return "";
    return pickLocalizedField(
      i18n.language,
      opportunityDocs.requirements,
      opportunityDocs.translations,
      "requirements",
    );
  }, [opportunityDocs, i18n.language]);

  // Initialize from store on mount and when navigating back (store has files but local state is empty)
  useEffect(() => {
    // Only sync from store if:
    // 1. Store has files but local state is empty (navigated back), OR
    // 2. Store files are different from what we have (external update)
    const hasStoreFiles = storeFiles.length > 0;
    const hasLocalFiles = selectedFiles.length > 0;
    const storeFileNames = storeFiles.map(f => `${f.name}-${f.size}`).sort().join(',');
    const localFileNames = selectedFiles.map(sf => `${sf.file.name}-${sf.file.size}`).sort().join(',');
    
    if (hasStoreFiles && (!hasLocalFiles || storeFileNames !== localFileNames)) {
      const restoredFiles: SelectedFile[] = storeFiles.map((file, index) => ({
        file,
        id: `restored-${index}-${Date.now()}`,
      }));
      setSelectedFilesLocal(restoredFiles);
    }
    
    // Sync library document IDs similarly
    const hasStoreIds = storeLibraryIds.length > 0;
    const hasLocalIds = selectedLibraryDocIds.length > 0;
    const storeIdsStr = storeLibraryIds.sort().join(',');
    const localIdsStr = selectedLibraryDocIds.sort().join(',');
    
    if (hasStoreIds && (!hasLocalIds || storeIdsStr !== localIdsStr)) {
      setSelectedLibraryDocIdsLocal(storeLibraryIds);
    }
  }, [storeFiles, storeLibraryIds]); // Re-run when store values change

  // Load library documents on mount
  useEffect(() => {
    const loadLibrary = async () => {
      const docs = await fetchLibraryDocuments();
      setLibraryDocuments(docs);
      if (storeLibraryIds.length === 0) {
        const presetIds = docs
          .filter((d) => d.documentType === "cv" || d.documentType === "cover_letter")
          .map((d) => d.id);
        if (presetIds.length > 0) {
          setSelectedLibraryDocIdsLocal(presetIds);
        }
      }
    };
    loadLibrary();
  }, [fetchLibraryDocuments, storeLibraryIds.length]);

  const slotLabel = (type: UploadedDocument["documentType"]) => {
    if (type === "cv") return t(`${doc}.cv`);
    if (type === "cover_letter") return t(`${doc}.coverLetter`);
    return null;
  };

  const typedLibraryDocs = libraryDocuments.filter(
    (d) => d.documentType === "cv" || d.documentType === "cover_letter",
  );
  const otherLibraryDocs = libraryDocuments.filter(
    (d) => !d.documentType || d.documentType === null,
  );

  // Sync local state changes to store and notify parent
  useEffect(() => {
    const files = selectedFiles.map(sf => sf.file);
    setSelectedFiles(files); // Update store
    onFilesChange?.(files); // Notify parent
  }, [selectedFiles, onFilesChange, setSelectedFiles]);

  // Sync library document changes to store and notify parent
  useEffect(() => {
    setSelectedLibraryDocIds(selectedLibraryDocIds); // Update store
    onLibraryDocumentsChange?.(selectedLibraryDocIds); // Notify parent
  }, [selectedLibraryDocIds, onLibraryDocumentsChange, setSelectedLibraryDocIds]);

  const validateFile = (file: File): string | null => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = [
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      // Excel files
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // PowerPoint files
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      // Images
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (file.size > MAX_FILE_SIZE) {
      return t(`${doc}.fileTooLarge`, { fileName: file.name });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return t(`${doc}.invalidFileType`, { fileName: file.name });
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
          title: t(`${doc}.invalidFile`),
          description: errors[0],
          variant: "destructive",
        });
      }

      if (newFiles.length > 0) {
        setSelectedFilesLocal(prev => [...prev, ...newFiles]);
      }

      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      setSelectedFilesLocal(prev => prev.filter(sf => sf.id !== deleteConfirm.id));
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
    if (fileType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (fileType.includes("word") || fileType.includes("doc")) return <FileText className="h-5 w-5 text-blue-500" />;
    if (fileType.includes("excel") || fileType.includes("spreadsheet") || fileType.includes("xls")) {
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    }
    if (fileType.includes("powerpoint") || fileType.includes("presentation") || fileType.includes("ppt")) {
      return <Presentation className="h-5 w-5 text-orange-500" />;
    }
    if (fileType.includes("image") || fileType.includes("jpeg") || fileType.includes("jpg") || fileType.includes("png") || fileType.includes("gif") || fileType.includes("webp")) {
      return <ImageIcon className="h-5 w-5 text-purple-500" />;
    }
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  const handleLibraryDocToggle = (docId: string, checked: boolean) => {
    if (checked) {
      setSelectedLibraryDocIdsLocal(prev => [...prev, docId]);
    } else {
      setSelectedLibraryDocIdsLocal(prev => prev.filter(id => id !== docId));
    }
  };

  // Define required documents (marked with asterisk)
  const requiredDocuments = useMemo(() => {
    if (applicantType === "Individual") {
      return new Set([
        t(`${doc}.individualRecommended.id`),
        t(`${doc}.individualRecommended.proposal`),
      ]);
    }
    return new Set([
      t(`${doc}.organizationRecommended.registration`),
      t(`${doc}.organizationRecommended.proposal`),
    ]);
  }, [applicantType, t, i18n.language]);

  const recommendedDocuments = useMemo(() => {
    if (applicantType === "Individual") {
      return [
        t(`${doc}.individualRecommended.id`),
        t(`${doc}.individualRecommended.proposal`),
        t(`${doc}.startupRecommended.budget`),
        t(`${doc}.startupRecommended.cv`),
      ];
    }
    return [
      t(`${doc}.ngoRecommended.registration`),
      t(`${doc}.ngoRecommended.profile`),
      t(`${doc}.ngoRecommended.proposal`),
      t(`${doc}.ngoRecommended.budget`),
      t(`${doc}.ngoRecommended.team`),
    ];
  }, [applicantType, t, i18n.language]);

  return (
    <div className="space-y-6">
      {localizedRequirements && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t(`${doc}.opportunityRequirementsTitle`)}</CardTitle>
          </CardHeader>
          <CardContent>
            <ListItemsRenderer items={localizedRequirements} variant="primary" />
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t(`${doc}.recommendedTitle`)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t(`${doc}.recommendedIntro`)}</p>
          <ul className="space-y-1 text-sm">
            {recommendedDocuments.map((item) => (
              <li key={item} className="text-foreground">
                - {item}
                {requiredDocuments.has(item) && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground italic">
            {t(`${doc}.recommendedRequiredNote`)}
          </p>
        </CardContent>
      </Card>

      {/* Library Documents Section */}
      {libraryDocuments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Library className="h-4 w-4" />
              {t(`${doc}.selectFromLibraryTitle`)}
              {selectedLibraryDocIds.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  {t(`${doc}.selectedCount`, { count: selectedLibraryDocIds.length })}
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t(`${doc}.selectFromLibraryHint`)}
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {typedLibraryDocs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t(`${doc}.fromLibrarySection`)}
                    </p>
                    {typedLibraryDocs.map((doc) => (
                      <LibraryDocRow
                        key={doc.id}
                        doc={doc}
                        badge={slotLabel(doc.documentType)}
                        selected={selectedLibraryDocIds.includes(doc.id)}
                        onToggle={handleLibraryDocToggle}
                        formatFileSize={formatFileSize}
                      />
                    ))}
                  </div>
                )}
                {otherLibraryDocs.length > 0 && (
                  <div className="space-y-2">
                    {typedLibraryDocs.length > 0 && (
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t(`${doc}.otherLibrarySection`)}
                      </p>
                    )}
                    {otherLibraryDocs.map((doc) => (
                      <LibraryDocRow
                        key={doc.id}
                        doc={doc}
                        selected={selectedLibraryDocIds.includes(doc.id)}
                        onToggle={handleLibraryDocToggle}
                        formatFileSize={formatFileSize}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Separator */}
      {libraryDocuments.length > 0 && (
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-sm text-muted-foreground">{t(`${doc}.orSeparator`)}</span>
          <Separator className="flex-1" />
        </div>
      )}

      {/* Upload New Files Section */}
      <div>
        <h3 className="text-sm font-medium mb-3">{t(`${doc}.uploadNewDocuments`)}</h3>
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
            accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
          />
          
          <div className="space-y-3">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                {t(`${doc}.chooseFiles`)}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(`${doc}.fileTypesHint`)}
            </p>
            <p className="text-xs text-muted-foreground italic">
              {t(`${doc}.uploadOnSubmitHint`)}
            </p>
          </div>
        </div>
      </div>

      {/* New files only — library picks stay in the checklist above */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t(`${doc}.filesToUploadTitle`, { count: selectedFiles.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
                      {formatFileSize(selectedFile.file.size)} • {t(`${doc}.readyToUpload`)}
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
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`${doc}.deleteConfirmTitle`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(`${doc}.deleteConfirmDescription`, { name: deleteConfirm?.file.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t(`${doc}.cancel`)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t(`${doc}.remove`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function LibraryDocRow({
  doc,
  badge,
  selected,
  onToggle,
  formatFileSize,
}: {
  doc: UploadedDocument;
  badge?: string | null;
  selected: boolean;
  onToggle: (docId: string, checked: boolean) => void;
  formatFileSize: (bytes: number) => string;
}) {
  return (
    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
      <Checkbox
        id={`lib-doc-${doc.id}`}
        checked={selected}
        onCheckedChange={(checked) => onToggle(doc.id, checked as boolean)}
      />
      <label
        htmlFor={`lib-doc-${doc.id}`}
        className="flex-1 flex items-center gap-3 cursor-pointer min-w-0"
      >
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{doc.fileName}</p>
            {badge && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
          </p>
        </div>
      </label>
    </div>
  );
}

export default DocumentUploadSection;








