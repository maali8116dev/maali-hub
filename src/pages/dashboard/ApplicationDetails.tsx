import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  MapPin, 
  Building2, 
  Mail, 
  Phone, 
  DollarSign,
  Users,
  ExternalLink,
  Download,
  FolderOpen,
  Loader2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDocumentDownloadUrl, type UploadedDocument } from "@/hooks/useDocumentUpload";

const ApplicationDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: application, isLoading, error } = useQuery({
    queryKey: ["application", id],
    queryFn: async () => {
      if (!id) throw new Error("Application ID is required");

      const { data: app, error: appError } = await supabase
        .from("applications")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (appError) throw appError;
      if (!app) throw new Error("Application not found");

      // Fetch project details
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", app.project_id)
        .maybeSingle();

      return {
        ...app,
        project,
      };
    },
    enabled: !!id,
  });

  // Fetch documents for this application
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["application-documents", id, application?.user_id],
    queryFn: async () => {
      if (!id) return [];

      // First, try to get documents linked to this application
      const { data: linkedDocs, error: linkedError } = await supabase
        .from("application_documents")
        .select("*")
        .eq("application_id", id)
        .order("created_at", { ascending: false });

      if (linkedError) {
        console.error("Error fetching linked documents:", linkedError);
      }

      // Also get unlinked documents from the same user and project (fallback for documents 
      // uploaded during application process but not properly linked)
      let unlinkedDocs: typeof linkedDocs = [];
      if (application?.user_id && application?.project_id) {
        const { data: userDocs, error: userError } = await (supabase
          .from("application_documents")
          .select("*")
          .eq("user_id", application.user_id)
          .eq("project_id", application.project_id)
          .is("application_id", null)
          .order("created_at", { ascending: false }) as any);

        if (userError) {
          console.error("Error fetching user documents:", userError);
        } else {
          unlinkedDocs = userDocs || [];
        }
      }

      // Combine and deduplicate
      const allDocs = [...(linkedDocs || []), ...unlinkedDocs];
      const uniqueDocs = allDocs.filter(
        (doc, index, self) => index === self.findIndex((d) => d.id === doc.id)
      );

      return uniqueDocs.map((doc) => ({
        id: doc.id,
        fileName: doc.file_name,
        filePath: doc.file_path,
        fileSize: doc.file_size || 0,
        fileType: doc.file_type || "",
        createdAt: doc.created_at,
        applicationId: doc.application_id || undefined,
      })) as UploadedDocument[];
    },
    enabled: !!id && !!application,
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-warning/10 text-warning border-warning/20",
      under_review: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      approved: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
      draft: "bg-muted text-muted-foreground border-border",
    };
    return styles[status] || styles.pending;
  };

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
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
    return "File";
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Application Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The application you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={() => navigate("/dashboard/applications")}>
                View All Applications
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="w-fit sm:w-10 h-10 min-w-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold line-clamp-2">
              {application.project?.title || "Application Details"}
            </h1>
            <p className="text-muted-foreground text-sm break-all">
              ID: {application.id.slice(0, 8)}...
            </p>
          </div>
        </div>
        <Badge className={`${getStatusBadge(application.status || "pending")} flex-shrink-0 w-fit`}>
          {formatStatus(application.status || "pending")}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Application Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Application Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Company Name</p>
                  <p className="font-medium">{application.company_name || "Not provided"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contact Email</p>
                  <p className="font-medium">{application.contact_email || "Not provided"}</p>
                </div>
              </div>

              {application.contact_phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Contact Phone</p>
                    <p className="font-medium">{application.contact_phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  <p className="font-medium">{application.location || "Not provided"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Funding Requested</p>
                  <p className="font-medium">{application.funding_amount_requested || "Not specified"}</p>
                </div>
              </div>

              {application.team_size && (
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Team Size</p>
                    <p className="font-medium">{application.team_size} members</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Project Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {application.project ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Project Title</p>
                  <p className="font-medium">{application.project.title}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <Badge variant="outline">{application.project.category}</Badge>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Funding Amount</p>
                  <p className="font-medium">{application.project.funding_amount}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  <p className="font-medium">{application.project.location}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Deadline</p>
                  <p className="font-medium">
                    {new Date(application.project.deadline).toLocaleDateString()}
                  </p>
                </div>

                <Separator />

                <Link to={`/projects/${application.project_id}`}>
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Project Details
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-muted-foreground">Project information unavailable</p>
            )}
          </CardContent>
        </Card>

        {/* Project Description */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Project Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {application.project_description || "No description provided"}
            </p>
          </CardContent>
        </Card>

        {/* Business Plan */}
        {application.business_plan && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Business Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {application.business_plan}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Supporting Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{doc.fileName}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatFileSize(doc.fileSize)}</span>
                          <span>•</span>
                          <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {getFileTypeLabel(doc.fileType)}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id}
                      className="ml-4"
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No documents uploaded for this application</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                <p className="font-medium">
                  {new Date(application.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="font-medium">
                  {new Date(application.updated_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
                <Badge variant={application.application_fee_paid ? "default" : "secondary"}>
                  {application.application_fee_paid ? "Paid" : "Unpaid"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Button variant="outline" onClick={() => navigate("/dashboard/applications")} className="min-h-[48px] w-full sm:w-auto">
          Back to Applications
        </Button>
        {application.status === "draft" && (
          <Link to={`/projects/${application.project_id}/apply`} className="w-full sm:w-auto">
            <Button className="min-h-[48px] w-full">Continue Application</Button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default ApplicationDetails;
