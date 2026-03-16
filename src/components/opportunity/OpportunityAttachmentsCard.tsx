import { useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilePlus, Plus, Trash2 } from "lucide-react";
import type { OpportunityDocument } from "@/hooks/useOpportunityFiles";

const FILE_ACCEPT = ".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,image/*";
const HELP_TEXT = "PDF, Word, Excel, PowerPoint, text, images. Max 10MB each.";

export interface OpportunityAttachmentsCardProps {
  isEditing: boolean;
  documents: OpportunityDocument[];
  isUploading: boolean;
  upload: (file: File) => Promise<OpportunityDocument | null>;
  remove: (doc: OpportunityDocument) => Promise<boolean>;
  /** When creating: pending files and setter; parent uploads these after opportunity is created. */
  pendingFiles?: File[];
  setPendingFiles?: React.Dispatch<React.SetStateAction<File[]>>;
  /** Optional class for card header/content (e.g. admin uses p-4 sm:p-6) */
  className?: string;
}

export function OpportunityAttachmentsCard({
  isEditing,
  documents,
  isUploading,
  upload,
  remove,
  pendingFiles = [],
  setPendingFiles,
  className,
}: OpportunityAttachmentsCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const descriptionCreate = "Add files after creating the opportunity, or select files now to attach once saved.";
  const descriptionEdit = "Add PDFs, documents, or images for applicants to view.";

  return (
    <Card className={className}>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <FilePlus className="h-4 w-4" />
          Attachments
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {isEditing ? descriptionEdit : descriptionCreate}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        {isEditing ? (
          <>
            {documents.length > 0 && (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <span className="truncate">{doc.fileName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => remove(doc)}
                      aria-label={`Remove ${doc.fileName}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={FILE_ACCEPT}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : "Add file"}
              </Button>
            </div>
          </>
        ) : (
          <>
            {pendingFiles.length > 0 && setPendingFiles && (
              <ul className="space-y-2">
                {pendingFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <span className="truncate">{f.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${f.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={FILE_ACCEPT}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && setPendingFiles) setPendingFiles((prev) => [...prev, f]);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add file (uploaded when saved)
              </Button>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">{HELP_TEXT}</p>
      </CardContent>
    </Card>
  );
}
