import type { DocumentType, UploadedDocument } from "@/hooks/useDocumentUpload";

export const MAX_LIBRARY_DOCUMENTS = 20;

export type NamedSlotType = Exclude<DocumentType, null>;

export const REPLACEABLE_SLOT_TYPES: NamedSlotType[] = ["cv", "cover_letter"];

/** CV and cover letter: PDF or Word only */
export const SLOT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const SLOT_FILE_ACCEPT = ".pdf,.doc,.docx";

const SLOT_MIME_SET = new Set<string>(SLOT_MIME_TYPES);

export function validateSlotFile(file: File): string | null {
  if (!SLOT_MIME_SET.has(file.type)) {
    return `File "${file.name}" must be PDF, DOC, or DOCX.`;
  }
  return null;
}

export interface DocumentSlotConfig {
  type: NamedSlotType | "other";
  labelKey: string;
  descriptionKey: string;
  optional?: boolean;
  kycLink?: boolean;
}

export const DOCUMENT_SLOTS: DocumentSlotConfig[] = [
  {
    type: "cv",
    labelKey: "documents.slots.cv.label",
    descriptionKey: "documents.slots.cv.description",
  },
  {
    type: "id",
    labelKey: "documents.slots.id.label",
    descriptionKey: "documents.slots.id.description",
    kycLink: true,
  },
  {
    type: "cover_letter",
    labelKey: "documents.slots.coverLetter.label",
    descriptionKey: "documents.slots.coverLetter.description",
    optional: true,
  },
];

export function isLibraryDocument(doc: UploadedDocument): boolean {
  return !!doc.isLibraryDocument && !doc.applicationId;
}

export function getOtherLibraryDocuments(docs: UploadedDocument[]): UploadedDocument[] {
  return docs.filter(
    (d) => isLibraryDocument(d) && (!d.documentType || d.documentType === null),
  );
}

export function getSlotDocument(
  docs: UploadedDocument[],
  type: NamedSlotType,
): UploadedDocument | undefined {
  return docs.find((d) => isLibraryDocument(d) && d.documentType === type);
}

export function countLibraryDocuments(docs: UploadedDocument[]): number {
  return docs.filter(isLibraryDocument).length;
}

export function remainingLibraryCapacity(docs: UploadedDocument[]): number {
  return Math.max(0, MAX_LIBRARY_DOCUMENTS - countLibraryDocuments(docs));
}
