import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  FileText, 
  Download, 
  Trash2, 
  Loader2, 
  Upload,
  Library,
  FileCheck
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const Documents = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation(['dashboard']);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<UploadedDocument | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"library" | "applications">("library");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    fetchUserDocuments,
    uploadToLibrary,
    deleteDocument,
    documents,
    isLoading,
    isUploading,
  } = useDocumentUpload();

  const [libraryDocuments, setLibraryDocuments] = useState<UploadedDocument[]>([]);
  const [applicationDocuments, setApplicationDocuments] = useState<UploadedDocument[]>([]);

  useEffect(() => {
    const loadDocuments = async () => {
      const allDocs = await fetchUserDocuments();
      
      setLibraryDocuments(allDocs.filter(doc => doc.isLibraryDocument && !doc.applicationId));
      setApplicationDocuments(allDocs.filter(doc => !doc.isLibraryDocument && doc.applicationId));
    };
    loadDocuments();
  }, [fetchUserDocuments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      const result = await uploadToLibrary(file);
      if (result) {
        setLibraryDocuments(prev => [result, ...prev]);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filteredLibraryDocuments = libraryDocuments.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredApplicationDocuments = applicationDocuments.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (deleteConfirm) {
      const success = await deleteDocument(deleteConfirm);
      if (success) {
        if (deleteConfirm.isLibraryDocument) {
          setLibraryDocuments(prev => prev.filter(d => d.id !== deleteConfirm.id));
        } else {
          setApplicationDocuments(prev => prev.filter(d => d.id !== deleteConfirm.id));
        }
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

  const getFileTypeLabel = (fileType: string): string => {
    if (fileType.includes("pdf")) return "PDF";
    if (fileType.includes("word") || fileType.includes("doc")) return "DOC";
    if (fileType.includes("text")) return "TXT";
    if (fileType.includes("excel") || fileType.includes("spreadsheet") || fileType.includes("xls")) return "XLS";
    if (fileType.includes("powerpoint") || fileType.includes("presentation") || fileType.includes("ppt")) return "PPT";
    if (fileType.includes("image") || fileType.includes("jpeg") || fileType.includes("jpg") || fileType.includes("png") || fileType.includes("gif") || fileType.includes("webp")) return "IMG";
    return "File";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('dashboard:documents.title')}</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            {t('dashboard:documents.subtitle')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            variant="outline"
            className="w-full sm:w-auto min-h-[44px]"
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? t('dashboard:documents.uploading') : t('dashboard:documents.uploadToLibrary')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp"
            onChange={handleFileSelect}
          />
          <Button onClick={() => navigate("/projects")} className="w-full sm:w-auto min-h-[44px]">
            <FileCheck className="h-4 w-4 mr-2" />
            {t('dashboard:documents.applyForFunding')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4 sm:pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('dashboard:documents.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 sm:h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Documents Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "library" | "applications")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Library className="h-4 w-4" />
            {t('dashboard:documents.tabs.library')} ({libraryDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            {t('dashboard:documents.tabs.applications')} ({applicationDocuments.length})
          </TabsTrigger>
        </TabsList>

        {/* Library Documents Tab */}
        <TabsContent value="library" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-4 sm:pt-6">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : filteredLibraryDocuments.length > 0 ? (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">
                  {t('dashboard:documents.library.title')} ({filteredLibraryDocuments.length})
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('dashboard:documents.library.description')}
                </p>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="space-y-3">
                  {filteredLibraryDocuments.map((doc) => (
                    <DocumentItem
                      key={doc.id}
                      doc={doc}
                      onDownload={handleDownload}
                      onDelete={() => setDeleteConfirm(doc)}
                      downloadingId={downloadingId}
                      formatFileSize={formatFileSize}
                      getFileTypeLabel={getFileTypeLabel}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  icon={Library}
                  title={t('dashboard:documents.emptyState.noLibraryDocuments')}
                  description={
                    searchQuery
                      ? t('dashboard:documents.emptyState.noLibraryDocumentsSearch')
                      : t('dashboard:documents.emptyState.noLibraryDocumentsDesc')
                  }
                  action={
                    !searchQuery
                      ? {
                          label: t('dashboard:documents.emptyState.uploadToLibrary'),
                          onClick: () => fileInputRef.current?.click(),
                          variant: "hero",
                        }
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Application Documents Tab */}
        <TabsContent value="applications" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-4 sm:pt-6">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : filteredApplicationDocuments.length > 0 ? (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">
                  {t('dashboard:documents.applicationDocuments.title')} ({filteredApplicationDocuments.length})
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('dashboard:documents.applicationDocuments.description')}
                </p>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="space-y-3">
                  {filteredApplicationDocuments.map((doc) => (
                    <DocumentItem
                      key={doc.id}
                      doc={doc}
                      onDownload={handleDownload}
                      onDelete={() => setDeleteConfirm(doc)}
                      downloadingId={downloadingId}
                      formatFileSize={formatFileSize}
                      getFileTypeLabel={getFileTypeLabel}
                      showApplicationBadge={true}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  icon={FileCheck}
                  title={t('dashboard:documents.emptyState.noApplicationDocuments')}
                  description={
                    searchQuery
                      ? t('dashboard:documents.emptyState.noApplicationDocumentsSearch')
                      : t('dashboard:documents.emptyState.noApplicationDocumentsDesc')
                  }
                  action={
                    !searchQuery
                      ? {
                          label: t('dashboard:documents.emptyState.browseOpportunities'),
                          onClick: () => navigate("/projects"),
                          variant: "hero",
                        }
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard:documents.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dashboard:documents.deleteDialog.description', { fileName: deleteConfirm?.fileName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dashboard:documents.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('dashboard:documents.deleteDialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Document Item Component
interface DocumentItemProps {
  doc: UploadedDocument;
  onDownload: (doc: UploadedDocument) => void;
  onDelete: () => void;
  downloadingId: string | null;
  formatFileSize: (bytes: number) => string;
  getFileTypeLabel: (fileType: string) => string;
  showApplicationBadge?: boolean;
}

const DocumentItem = ({
  doc,
  onDownload,
  onDelete,
  downloadingId,
  formatFileSize,
  getFileTypeLabel,
  showApplicationBadge = false,
}: DocumentItemProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-3">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate text-sm sm:text-base">{doc.fileName}</p>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
            <span>{formatFileSize(doc.fileSize)}</span>
            <span>•</span>
            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
            {showApplicationBadge && doc.applicationId && (
              <>
                <span>•</span>
                <Badge variant="outline" className="text-xs">
                  {t('dashboard:documents.badges.application')}
                </Badge>
              </>
            )}
            {doc.isLibraryDocument && (
              <>
                <span>•</span>
                <Badge variant="secondary" className="text-xs">
                  {t('dashboard:documents.badges.library')}
                </Badge>
              </>
            )}
          </div>
        </div>
        <Badge variant="secondary" className="flex-shrink-0 hidden sm:inline-flex">
          {getFileTypeLabel(doc.fileType)}
        </Badge>
      </div>
      <div className="flex items-center gap-2 justify-end sm:ml-4">
        <Badge variant="secondary" className="flex-shrink-0 sm:hidden">
          {getFileTypeLabel(doc.fileType)}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDownload(doc)}
          disabled={downloadingId === doc.id}
          className="min-h-[44px] min-w-[44px]"
        >
          {downloadingId === doc.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px]"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Documents;
