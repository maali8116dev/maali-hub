import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  TrendingUp,
  Award,
  Briefcase,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDocumentDownloadUrl, type UploadedDocument } from "@/hooks/useDocumentUpload";
import { isProjectOpen } from "@/lib/projectAvailability";

type ApplicationDetailsRpcRow = {
  application: Record<string, any> | null;
  project: Record<string, any> | null;
  documents: Record<string, any>[] | null;
};

const mapRpcDocuments = (docs: Record<string, any>[] | null | undefined): UploadedDocument[] =>
  (docs || []).map((doc) => ({
    id: doc.id,
    fileName: doc.file_name,
    filePath: doc.file_path,
    fileSize: doc.file_size || 0,
    fileType: doc.file_type || "",
    createdAt: doc.created_at,
    applicationId: doc.application_id || undefined,
  })) as UploadedDocument[];

// ExpandableText component for long text sections
const ExpandableText = ({ 
  text, 
  maxLength = 300, 
  title 
}: { 
  text: string; 
  maxLength?: number; 
  title?: string;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = text.length > maxLength;
  const displayText = isExpanded || !shouldTruncate ? text : `${text.slice(0, maxLength)}...`;

  return (
    <div>
      <div className="prose prose-sm max-w-none">
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">
          {displayText}
        </p>
      </div>
      {shouldTruncate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      )}
    </div>
  );
};

const ApplicationDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: application, isLoading, error } = useQuery({
    queryKey: ["application", id],
    queryFn: async () => {
      if (!id) throw new Error("Application ID is required");

      const { data, error: rpcError } = await supabase.rpc(
        "get_application_details",
        { p_application_id: id }
      );

      if (rpcError) throw rpcError;
      const row = (data as ApplicationDetailsRpcRow[] | null)?.[0];
      if (!row?.application) throw new Error("Application not found");

      return {
        ...row.application,
        project: row.project,
        documents: mapRpcDocuments(row.documents),
      };
    },
    enabled: !!id,
  });

  const documents = (application?.documents || []) as UploadedDocument[];

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
    if (fileType.includes("excel") || fileType.includes("spreadsheet") || fileType.includes("xls")) return "XLS";
    if (fileType.includes("powerpoint") || fileType.includes("presentation") || fileType.includes("ppt")) return "PPT";
    if (fileType.includes("image") || fileType.includes("jpeg") || fileType.includes("jpg") || fileType.includes("png") || fileType.includes("gif") || fileType.includes("webp")) return "IMG";
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
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-6 sm:p-8">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(-1)} 
                className="flex-shrink-0 h-10 w-10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold line-clamp-2 mb-1">
                      {application.project?.title || "Application Details"}
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant="outline" 
                        className="text-xs font-medium"
                      >
                        {application.id.slice(0, 8).toUpperCase()}...
                      </Badge>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(application.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Badge 
              className={`${getStatusBadge(application.status || "pending")} flex-shrink-0 px-4 py-2 text-sm font-semibold`}
            >
              {formatStatus(application.status || "pending")}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {documents.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {documents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Application Info */}
            <Card className="border-2">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  Application Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid gap-5">
                  <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Company Name</p>
                      <p className="font-semibold text-base">{application.company_name || "Not provided"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contact Email</p>
                      <p className="font-semibold text-base break-all">{application.contact_email || "Not provided"}</p>
                    </div>
                  </div>

                  {application.contact_phone && (
                    <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <Phone className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contact Phone</p>
                        <p className="font-semibold text-base">{application.contact_phone}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Location</p>
                      <p className="font-semibold text-base">{application.location || "Not provided"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Funding Requested</p>
                      <p className="font-semibold text-base">{application.funding_amount_requested || "Not specified"}</p>
                    </div>
                  </div>

                  {application.team_size && (
                    <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-pink-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Team Size</p>
                        <p className="font-semibold text-base">{application.team_size} members</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Project Info */}
            <Card className="border-2">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Award className="h-4 w-4 text-primary" />
                  </div>
                  Project Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {application.project ? (
                  <div className="space-y-5">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Project Title</p>
                      <p className="font-bold text-lg">{application.project.title}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Category</p>
                        <Badge variant="outline" className="font-semibold">{(application.project as any).category}</Badge>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Funding Amount</p>
                        <p className="font-semibold text-base">{application.project.funding_amount}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Location</p>
                        <p className="font-semibold text-base">{application.project.location}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Deadline</p>
                        <p className="font-semibold text-base">
                          {new Date(application.project.deadline).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <Link to={`/projects/${application.project_id}`}>
                      <Button variant="outline" className="w-full h-11 font-semibold">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Project Details
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground font-medium">Project information unavailable</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Description Tab */}
        <TabsContent value="description" className="space-y-6 mt-6">
          {/* Project Description */}
          <Card className="border-2">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                Project Description
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ExpandableText 
                text={application.project_description || "No description provided"}
                maxLength={300}
              />
            </CardContent>
          </Card>

          {/* Business Plan */}
          {application.business_plan && (
            <Card className="border-2">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  Business Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ExpandableText 
                  text={application.business_plan}
                  maxLength={300}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <Card className="border-2">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
                Supporting Documents
                {documents.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {documents.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {documents.length > 0 ? (
                <div className="grid gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border-2 rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-base truncate mb-1">{doc.fileName}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {getFileTypeLabel(doc.fileType)}
                            </Badge>
                            <span>•</span>
                            <span>{formatFileSize(doc.fileSize)}</span>
                            <span>•</span>
                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        className="ml-4 h-10 w-10"
                      >
                        {downloadingId === doc.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Download className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No documents uploaded for this application</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-6">
          <Card className="border-2">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                Timeline & Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-lg border-2 bg-gradient-to-br from-blue-500/5 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted</p>
                  </div>
                  <p className="font-bold text-base">
                    {new Date(application.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(application.created_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="p-4 rounded-lg border-2 bg-gradient-to-br from-purple-500/5 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Updated</p>
                  </div>
                  <p className="font-bold text-base">
                    {new Date(application.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(application.updated_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="p-4 rounded-lg border-2 bg-gradient-to-br from-emerald-500/5 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    {application.application_fee_paid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-orange-600" />
                    )}
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Status</p>
                  </div>
                  <Badge 
                    variant={application.application_fee_paid ? "default" : "secondary"}
                    className="font-semibold"
                  >
                    {application.application_fee_paid ? "Paid" : "Unpaid"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Button variant="outline" onClick={() => navigate("/dashboard/applications")} className="min-h-[48px] w-full sm:w-auto">
          Back to Applications
        </Button>
        {application.status === "draft" && (
          isProjectOpen(application.project?.status, application.project?.deadline) ? (
            <Link to={`/projects/${application.project_id}/apply`} className="w-full sm:w-auto">
              <Button className="min-h-[48px] w-full">Continue Application</Button>
            </Link>
          ) : (
            <Button className="min-h-[48px] w-full sm:w-auto" variant="outline" disabled>
              Application Closed
            </Button>
          )
        )}
      </div>
    </div>
  );
};

export default ApplicationDetails;
