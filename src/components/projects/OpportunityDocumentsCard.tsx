import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";
import { useOpportunityFiles } from "@/hooks/useOpportunityFiles";
import { Skeleton } from "@/components/ui/skeleton";

interface OpportunityDocumentsCardProps {
  opportunityId: number;
}

/**
 * Read-only card that lists opportunity documents with download links for the public opportunity details page.
 */
export function OpportunityDocumentsCard({ opportunityId }: OpportunityDocumentsCardProps) {
  const { documents, isLoading, getSignedUrl } = useOpportunityFiles(opportunityId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (filePath: string, fileName: string, docId: string) => {
    setDownloadingId(docId);
    try {
      const url = await getSignedUrl(filePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-2" />
          <Skeleton className="h-10 w-full mb-2" />
          <Skeleton className="h-10 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (!documents.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Documents
        </CardTitle>
        <CardDescription>
          Download guidelines and attachments for this opportunity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <span className="truncate font-medium" title={doc.fileName}>
                {doc.fileName}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={downloadingId === doc.id}
                onClick={() => handleDownload(doc.filePath, doc.fileName, doc.id)}
                aria-label={`Download ${doc.fileName}`}
              >
                {downloadingId === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
