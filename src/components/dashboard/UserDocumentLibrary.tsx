import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Trash2,
  Loader2,
  Upload,
  FileCheck,
  ShieldCheck,
  Replace,
} from "lucide-react";
import {
  useDocumentUpload,
  type UploadedDocument,
  type DocumentType,
  getDocumentDownloadUrl,
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
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useKycVerification } from "@/hooks/useKycVerification";
import {
  DOCUMENT_SLOTS,
  MAX_LIBRARY_DOCUMENTS,
  countLibraryDocuments,
  getOtherLibraryDocuments,
  getSlotDocument,
  remainingLibraryCapacity,
  SLOT_FILE_ACCEPT,
  type NamedSlotType,
} from "@/lib/documentLibrary";

export function UserDocumentLibrary() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation(["dashboard"]);
  const { data: kyc, isLoading: kycLoading } = useKycVerification();
  const {
    fetchLibraryDocuments,
    uploadToLibrary,
    deleteDocument,
    isUploading,
  } = useDocumentUpload();

  const [libraryDocuments, setLibraryDocuments] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<UploadedDocument | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const cvInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const otherInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    setIsLoading(true);
    const docs = await fetchLibraryDocuments();
    setLibraryDocuments(docs);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const libraryCount = countLibraryDocuments(libraryDocuments);
  const remaining = remainingLibraryCapacity(libraryDocuments);
  const otherDocs = getOtherLibraryDocuments(libraryDocuments);

  const handleSlotUpload = async (
    files: FileList | null,
    documentType: DocumentType,
  ) => {
    const file = files?.[0];
    if (!file) return;
    const result = await uploadToLibrary(file, documentType);
    if (result) await loadDocs();
  };

  const handleOtherUpload = async (files: FileList | null) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    if (list.length > remaining) {
      toast({
        title: t("dashboard:documents.limitReached.title"),
        description: t("dashboard:documents.limitReached.description", {
          max: MAX_LIBRARY_DOCUMENTS,
          remaining,
        }),
        variant: "destructive",
      });
      return;
    }
    let added = 0;
    for (const file of list) {
      if (countLibraryDocuments(libraryDocuments) + added >= MAX_LIBRARY_DOCUMENTS) break;
      const result = await uploadToLibrary(file, null);
      if (result) added += 1;
    }
    await loadDocs();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const success = await deleteDocument(deleteConfirm);
    if (success) {
      setLibraryDocuments((prev) => prev.filter((d) => d.id !== deleteConfirm.id));
    }
    setDeleteConfirm(null);
  };

  const handleDownload = async (doc: UploadedDocument) => {
    setDownloadingId(doc.id);
    try {
      const url = await getDocumentDownloadUrl(doc.filePath);
      if (url) window.open(url, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t("dashboard:documents.title")}</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            {t("dashboard:documents.subtitleSlots")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("dashboard:documents.usageCount", {
              count: libraryCount,
              max: MAX_LIBRARY_DOCUMENTS,
            })}
          </p>
        </div>
        <Button
          onClick={() => navigate("/opportunities")}
          className="w-full sm:w-auto min-h-[44px]"
        >
          <FileCheck className="h-4 w-4 mr-2" />
          {t("dashboard:documents.applyForFunding")}
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">
                {t("dashboard:documents.slots.sectionTitle")}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {t("dashboard:documents.fileTypes.slots")}
              </p>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
              {DOCUMENT_SLOTS.map((slot) => {
                if (slot.kycLink) {
                  const verified = kyc?.status === "verified";
                  return (
                    <SlotRow
                      key={slot.type}
                      title={t(`dashboard:${slot.labelKey}`)}
                      description={t(`dashboard:${slot.descriptionKey}`)}
                    >
                      {kycLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : verified ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            {t("dashboard:documents.slots.id.verified")}
                          </Badge>
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/dashboard/profile">
                              {t("dashboard:documents.slots.id.viewKyc")}
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/dashboard/profile">
                            {t("dashboard:documents.slots.id.completeKyc")}
                          </Link>
                        </Button>
                      )}
                    </SlotRow>
                  );
                }

                const typed = slot.type as NamedSlotType;
                const doc = getSlotDocument(libraryDocuments, typed);
                const inputRef = typed === "cv" ? cvInputRef : coverInputRef;

                return (
                  <SlotRow
                    key={slot.type}
                    title={t(`dashboard:${slot.labelKey}`)}
                    description={t(`dashboard:${slot.descriptionKey}`)}
                    optional={slot.optional}
                  >
                    {doc ? (
                      <DocumentRow
                        doc={doc}
                        onDownload={handleDownload}
                        onDelete={() => setDeleteConfirm(doc)}
                        downloadingId={downloadingId}
                        formatFileSize={formatFileSize}
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUploading}
                            onClick={() => inputRef.current?.click()}
                          >
                            <Replace className="h-4 w-4 mr-1" />
                            {t("dashboard:documents.slots.replace")}
                          </Button>
                        }
                      />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUploading || remaining === 0}
                        onClick={() => inputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        {t("dashboard:documents.slots.upload")}
                      </Button>
                    )}
                    <input
                      ref={inputRef}
                      type="file"
                      className="hidden"
                      accept={SLOT_FILE_ACCEPT}
                      onChange={(e) => {
                        void handleSlotUpload(e.target.files, typed);
                        e.target.value = "";
                      }}
                    />
                  </SlotRow>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 sm:p-6">
              <div>
                <CardTitle className="text-base sm:text-lg">
                  {t("dashboard:documents.other.title")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("dashboard:documents.other.description")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard:documents.fileTypes.other")}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={isUploading || remaining === 0}
                onClick={() => otherInputRef.current?.click()}
                className="min-h-[44px]"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading
                  ? t("dashboard:documents.uploading")
                  : t("dashboard:documents.other.upload")}
              </Button>
              <input
                ref={otherInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  void handleOtherUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              {otherDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("dashboard:documents.other.empty")}
                </p>
              ) : (
                <div className="space-y-3">
                  {otherDocs.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      doc={doc}
                      onDownload={handleDownload}
                      onDelete={() => setDeleteConfirm(doc)}
                      downloadingId={downloadingId}
                      formatFileSize={formatFileSize}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard:documents.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard:documents.deleteDialog.description", {
                fileName: deleteConfirm?.fileName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dashboard:documents.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("dashboard:documents.deleteDialog.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SlotRow({
  title,
  description,
  optional,
  children,
}: {
  title: string;
  description: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg">
      <div>
        <p className="font-medium text-sm sm:text-base">
          {title}
          {optional && (
            <span className="text-muted-foreground font-normal ml-1">(optional)</span>
          )}
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

function DocumentRow({
  doc,
  onDownload,
  onDelete,
  downloadingId,
  formatFileSize,
  action,
}: {
  doc: UploadedDocument;
  onDownload: (doc: UploadedDocument) => void;
  onDelete: () => void;
  downloadingId: string | null;
  formatFileSize: (bytes: number) => string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-md bg-muted/30">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <FileText className="h-5 w-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{doc.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        {action}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDownload(doc)}
          disabled={downloadingId === doc.id}
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
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
