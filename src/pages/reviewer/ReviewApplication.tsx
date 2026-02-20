import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Building2,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Users,
  Download,
  User,
  Calendar,
  Target,
  Globe,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Award,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { getDocumentDownloadUrl } from "@/hooks/useDocumentUpload";
import { createNotification } from "@/hooks/useNotifications";
import { useActivityLogger } from "@/hooks/useActivityLogger";
// Email integration - uncomment to enable status update emails
// import { 
//   sendApplicationApprovedEmail, 
//   sendApplicationRejectedEmail,
//   sendApplicationUnderReviewEmail 
// } from "@/lib/email";

const ReviewApplication = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { logActivity } = useActivityLogger();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Determine the back route based on user role or location state
  const getBackRoute = () => {
    // Check if location state indicates admin context
    if (location.state?.fromAdmin) {
      return "/admin/applications";
    }
    // Check if user is admin
    if (profile?.role === "admin") {
      return "/admin/applications";
    }
    // Default to reviewer route
    return "/reviewer/applications";
  };

  // Check if user is a reviewer (only reviewers can perform review actions)
  const isReviewer = profile?.role === "reviewer";
  const isAdmin = profile?.role === "admin";

  // Fetch application data
  const { data: application, isLoading, error } = useQuery({
    queryKey: ["review-application", id],
    queryFn: async () => {
      if (!id) throw new Error("Application ID is required");

      // Fetch application
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

      // Fetch applicant profile
      const { data: applicantProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", app.user_id)
        .maybeSingle();

      const applicantName = applicantProfile
        ? `${applicantProfile.first_name || ""} ${applicantProfile.last_name || ""}`.trim() || "Unknown Applicant"
        : "Unknown Applicant";

      return {
        ...app,
        projectTitle: project?.title || "Unknown Project",
        applicantName,
        applicantEmail: app.contact_email,
        submittedAt: app.created_at,
      };
    },
    enabled: !!id,
  });

  // Fetch documents for this application
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["review-application-documents", id, application?.user_id],
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
      } else {
        console.log(`Found ${linkedDocs?.length || 0} linked documents for application ${id}`);
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
          console.log(`Found ${unlinkedDocs.length} unlinked documents for user ${application.user_id}`);
        }
      }

      // Combine and deduplicate
      const allDocs = [...(linkedDocs || []), ...unlinkedDocs];
      const uniqueDocs = allDocs.filter(
        (doc, index, self) => index === self.findIndex((d) => d.id === doc.id)
      );

      console.log(`Total documents found: ${uniqueDocs.length} (${linkedDocs?.length || 0} linked + ${unlinkedDocs.length} unlinked)`);

      return uniqueDocs.map((doc) => ({
        id: doc.id,
        fileName: doc.file_name,
        filePath: doc.file_path,
        fileSize: doc.file_size || 0,
        fileType: doc.file_type || "",
        createdAt: doc.created_at,
        applicationId: doc.application_id || undefined,
      }));
    },
    enabled: !!id && !!application,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "under_review":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            Under Review
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleApprove = async () => {
    // Strict role check - only reviewers can approve
    if (!isReviewer) {
      toast({
        title: "Access Denied",
        description: "Only reviewers can approve applications. Please use a reviewer account.",
        variant: "destructive",
      });
      return;
    }

    if (!id || !application) return;

    setIsSubmitting(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("applications")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: now,
          review_notes: reviewNotes.trim() || null,
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Log activity for approval
      await logActivity({
        actionType: "approve",
        entityType: "application",
        entityId: id,
        description: `Approved application for "${application.projectTitle}"`,
        metadata: {
          application_id: id,
          project_id: application.project_id,
          project_title: application.projectTitle,
          reviewer_id: user.id,
          review_notes: reviewNotes.trim() || null,
        },
      });

      // Create notification for the applicant
      await createNotification(
        application.user_id,
        "Application Approved!",
        `Congratulations! Your application for "${application.projectTitle}" has been approved.`,
        "application",
        `/dashboard/applications/${id}`,
        {
          application_id: id,
          project_id: application.project_id,
          status: "approved",
        }
      );

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["review-application", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      
      // Email integration - uncomment to send approval email
      // await sendApplicationApprovedEmail(
      //   application.contact_email,
      //   application.applicantName,
      //   application.projectTitle,
      //   application.id,
      //   reviewNotes || undefined
      // );
      
      toast({
        title: "Application Approved",
        description: "The application has been approved successfully.",
      });
      
      navigate(getBackRoute());
    } catch (error) {
      console.error("Error approving application:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    // Strict role check - only reviewers can reject
    if (!isReviewer) {
      toast({
        title: "Access Denied",
        description: "Only reviewers can reject applications. Please use a reviewer account.",
        variant: "destructive",
      });
      return;
    }

    if (!reviewNotes.trim()) {
      toast({
        title: "Review Notes Required",
        description: "Please provide review notes before rejecting an application.",
        variant: "destructive",
      });
      return;
    }

    if (!id || !application) return;

    setIsSubmitting(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("applications")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: now,
          review_notes: reviewNotes.trim() || null,
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Log activity for rejection
      await logActivity({
        actionType: "reject",
        entityType: "application",
        entityId: id,
        description: `Rejected application for "${application.projectTitle}"`,
        metadata: {
          application_id: id,
          project_id: application.project_id,
          project_title: application.projectTitle,
          reviewer_id: user.id,
          review_notes: reviewNotes.trim() || null,
        },
      });

      // Create notification for the applicant
      await createNotification(
        application.user_id,
        "Application Status Updated",
        `Your application for "${application.projectTitle}" has been reviewed. Please check your application details for more information.`,
        "application",
        `/dashboard/applications/${id}`,
        {
          application_id: id,
          project_id: application.project_id,
          status: "rejected",
        }
      );

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["review-application", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      
      // Email integration - uncomment to send rejection email
      // await sendApplicationRejectedEmail(
      //   application.contact_email,
      //   application.applicantName,
      //   application.projectTitle,
      //   reviewNotes,
      //   `${window.location.origin}/projects`
      // );
      
      toast({
        title: "Application Rejected",
        description: "The application has been rejected.",
      });
      
      navigate(getBackRoute());
    } catch (error) {
      console.error("Error rejecting application:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestMoreInfo = async () => {
    // Strict role check - only reviewers can request more info
    if (!isReviewer) {
      toast({
        title: "Access Denied",
        description: "Only reviewers can request additional information. Please use a reviewer account.",
        variant: "destructive",
      });
      return;
    }

    if (!reviewNotes.trim()) {
      toast({
        title: "Notes Required",
        description: "Please provide notes about what information is needed.",
        variant: "destructive",
      });
      return;
    }

    if (!id || !application) return;

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from("applications")
        .update({
          status: "under_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["review-application", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      
      // Email integration - uncomment to send under review email with info request
      // await sendApplicationUnderReviewEmail(
      //   application.contact_email,
      //   application.applicantName,
      //   application.projectTitle,
      //   application.id,
      //   `${window.location.origin}/dashboard/applications`
      // );
      
      toast({
        title: "Information Requested",
        description: "The applicant has been notified to provide additional information.",
      });
      
      navigate(getBackRoute());
    } catch (error) {
      console.error("Error requesting more info:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (doc: { id: string; filePath: string; fileName: string }) => {
    setDownloadingId(doc.id);
    try {
      console.log("Attempting to download document:", {
        fileName: doc.fileName,
        filePath: doc.filePath,
        docId: doc.id,
      });

      const url = await getDocumentDownloadUrl(doc.filePath);
      if (url) {
        window.open(url, "_blank");
        toast({
          title: "Download Started",
          description: `Downloading ${doc.fileName}...`,
        });
      } else {
        toast({
          title: "Download Failed",
          description: `Unable to download ${doc.fileName}. The file may not exist or you may not have permission to access it.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to download document. Please try again.";
      toast({
        title: "Download Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(getBackRoute())}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Applications
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              {error instanceof Error ? error.message : "Application not found"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(getBackRoute())} className="w-fit min-h-[44px]">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Review Application</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base break-all">
              ID: {application.id}
            </p>
          </div>
        </div>
        {getStatusBadge(application.status || "pending")}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Applicant Information */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Applicant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {application.applicant_type && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <User className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Applicant Type</p>
                      <p className="font-medium">{application.applicant_type}</p>
                    </div>
                  </div>
                )}
                {application.full_legal_name && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <User className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Full Legal Name</p>
                      <p className="font-medium break-words">{application.full_legal_name}</p>
                    </div>
                  </div>
                )}
                {application.organization_name && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Organization Name</p>
                      <p className="font-medium break-words">{application.organization_name}</p>
                    </div>
                  </div>
                )}
                {application.company_name && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Company Name</p>
                      <p className="font-medium break-words">{application.company_name}</p>
                    </div>
                  </div>
                )}
                {application.registration_id_number && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Registration ID Number</p>
                      <p className="font-medium break-words">{application.registration_id_number}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Contact Email</p>
                    <p className="font-medium break-all">{application.contact_email || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Contact Phone</p>
                    <p className="font-medium">{application.contact_phone || "N/A"}</p>
                  </div>
                </div>
                {application.country_of_residence && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Country of Residence</p>
                      <p className="font-medium">{application.country_of_residence}</p>
                    </div>
                  </div>
                )}
                {application.city_region && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">City/Region</p>
                      <p className="font-medium">{application.city_region}</p>
                    </div>
                  </div>
                )}
                {application.location && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">{application.location}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Organizational Background (if applicable) */}
          {application.applicant_type && application.applicant_type !== "Individual" && (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Organizational Background</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {application.year_established && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Year Established</p>
                        <p className="font-medium">{application.year_established}</p>
                      </div>
                    </div>
                  )}
                  {application.team_size && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Team Size</p>
                        <p className="font-medium">{application.team_size} members</p>
                      </div>
                    </div>
                  )}
                  {application.previous_grants_funding_received !== undefined && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <DollarSign className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Previous Grants/Funding Received</p>
                        <p className="font-medium">{application.previous_grants_funding_received ? "Yes" : "No"}</p>
                      </div>
                    </div>
                  )}
                </div>
                {application.core_mission_purpose && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Core Mission/Purpose</Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{application.core_mission_purpose}</p>
                  </div>
                )}
                {application.primary_sectors && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Primary Sectors</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Array.isArray(application.primary_sectors) ? (
                        application.primary_sectors.map((sector: string, idx: number) => (
                          <Badge key={idx} variant="outline">{sector}</Badge>
                        ))
                      ) : typeof application.primary_sectors === 'string' ? (
                        (() => {
                          try {
                            const sectors = JSON.parse(application.primary_sectors);
                            return Array.isArray(sectors) ? (
                              sectors.map((sector: string, idx: number) => (
                                <Badge key={idx} variant="outline">{sector}</Badge>
                              ))
                            ) : (
                              <Badge variant="outline">{application.primary_sectors}</Badge>
                            );
                          } catch {
                            return <Badge variant="outline">{application.primary_sectors}</Badge>;
                          }
                        })()
                      ) : null}
                    </div>
                  </div>
                )}
                {application.primary_sector_other && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Other Primary Sector</Label>
                    <p className="mt-1 text-sm">{application.primary_sector_other}</p>
                  </div>
                )}
                {application.key_team_members_roles && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Key Team Members & Roles</Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{application.key_team_members_roles}</p>
                  </div>
                )}
                {application.previous_grants_funding_details && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Previous Grants/Funding Details</Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{application.previous_grants_funding_details}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Project Details */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
              {application.project_title && (
                <div>
                  <Label className="text-sm text-muted-foreground">Project Title</Label>
                  <p className="font-medium mt-1">{application.project_title}</p>
                </div>
              )}
              {!application.project_title && application.projectTitle && (
                <div>
                  <Label className="text-sm text-muted-foreground">Project Title</Label>
                  <p className="font-medium mt-1">{application.projectTitle}</p>
                </div>
              )}
              {application.project_summary && (
                <div>
                  <Label className="text-sm text-muted-foreground">Project Summary</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{application.project_summary}</p>
                </div>
              )}
              {application.problem_statement && (
                <div>
                  <Label className="text-sm text-muted-foreground">Problem Statement</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{application.problem_statement}</p>
                </div>
              )}
              {application.proposed_solution && (
                <div>
                  <Label className="text-sm text-muted-foreground">Proposed Solution</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{application.proposed_solution}</p>
                </div>
              )}
              {application.target_beneficiaries && (
                <div>
                  <Label className="text-sm text-muted-foreground">Target Beneficiaries</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{application.target_beneficiaries}</p>
                </div>
              )}
              {application.geographic_focus && (
                <div>
                  <Label className="text-sm text-muted-foreground">Geographic Focus</Label>
                  <p className="mt-1 text-sm">{application.geographic_focus}</p>
                </div>
              )}
              {application.project_description && (
                <div>
                  <Label className="text-sm text-muted-foreground">Project Description</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{application.project_description}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {application.funding_amount_requested && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <DollarSign className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Funding Amount Requested</p>
                      <p className="font-medium">{application.funding_amount_requested}</p>
                    </div>
                  </div>
                )}
                {application.team_size && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Team Size</p>
                      <p className="font-medium">{application.team_size} members</p>
                    </div>
                  </div>
                )}
              </div>
              {application.business_plan && (
                <div>
                  <Label className="text-sm text-muted-foreground">Business Plan Summary</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{application.business_plan}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Social Links */}
          {(application.linkedin_url || application.github_url || application.twitter_url || application.website_url || application.other_social_links) && (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Social Links & Online Presence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {application.linkedin_url && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <LinkIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">LinkedIn</p>
                        <a 
                          href={application.linkedin_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline break-all"
                        >
                          {application.linkedin_url}
                        </a>
                      </div>
                    </div>
                  )}
                  {application.github_url && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <LinkIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">GitHub</p>
                        <a 
                          href={application.github_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline break-all"
                        >
                          {application.github_url}
                        </a>
                      </div>
                    </div>
                  )}
                  {application.twitter_url && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <LinkIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">Twitter</p>
                        <a 
                          href={application.twitter_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline break-all"
                        >
                          {application.twitter_url}
                        </a>
                      </div>
                    </div>
                  )}
                  {application.website_url && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Globe className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">Website</p>
                        <a 
                          href={application.website_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline break-all"
                        >
                          {application.website_url}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                {application.other_social_links && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Other Social Links</Label>
                    <p className="mt-1 text-sm break-all">{application.other_social_links}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Compliance & Declarations */}
          {(application.information_accurate_confirmed !== undefined || 
            application.conflict_of_interest_declared !== undefined || 
            application.reporting_requirements_agreed !== undefined || 
            application.data_processing_consented !== undefined) && (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Compliance & Declarations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="space-y-2">
                  {application.information_accurate_confirmed !== undefined && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      {application.information_accurate_confirmed ? (
                        <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">Information Accurate Confirmed</p>
                        <p className="text-xs text-muted-foreground">
                          {application.information_accurate_confirmed ? "Confirmed" : "Not confirmed"}
                        </p>
                      </div>
                    </div>
                  )}
                  {application.conflict_of_interest_declared !== undefined && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      {application.conflict_of_interest_declared ? (
                        <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">Conflict of Interest Declared</p>
                        <p className="text-xs text-muted-foreground">
                          {application.conflict_of_interest_declared ? "Declared" : "Not declared"}
                        </p>
                      </div>
                    </div>
                  )}
                  {application.reporting_requirements_agreed !== undefined && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      {application.reporting_requirements_agreed ? (
                        <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">Reporting Requirements Agreed</p>
                        <p className="text-xs text-muted-foreground">
                          {application.reporting_requirements_agreed ? "Agreed" : "Not agreed"}
                        </p>
                      </div>
                    </div>
                  )}
                  {application.data_processing_consented !== undefined && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      {application.data_processing_consented ? (
                        <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">Data Processing Consented</p>
                        <p className="text-xs text-muted-foreground">
                          {application.data_processing_consented ? "Consented" : "Not consented"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {application.declaration_date && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Declaration Date: {new Date(application.declaration_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          {documentsLoading ? (
            <Card>
              <CardHeader>
                <CardTitle>Supporting Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : documents && documents.length > 0 ? (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Supporting Documents</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.fileSize)}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        className="min-h-[44px] sm:min-h-0"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {downloadingId === doc.id ? "Downloading..." : "Download"}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Review Panel */}
        <div className="space-y-6">
          {isReviewer ? (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Review Actions</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Submit your review decision for this application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <div>
                  <Label htmlFor="reviewNotes">Review Notes</Label>
                  <Textarea
                    id="reviewNotes"
                    placeholder="Add your review notes, feedback, or questions here..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={6}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Notes are required when rejecting an application
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={isSubmitting || application.status === "approved"}
                    className="w-full min-h-[48px] bg-success hover:bg-success/90"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={isSubmitting || application.status === "rejected"}
                    variant="destructive"
                    className="w-full min-h-[48px]"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={handleRequestMoreInfo}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full min-h-[48px]"
                  >
                    Request Info
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : isAdmin ? (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                  Review Actions Restricted
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Administrative accounts cannot perform review actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                  <p className="text-sm text-foreground mb-2">
                    <strong>Role Separation Policy:</strong>
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    To maintain proper separation of concerns and audit trails, administrative accounts can view applications but cannot approve, reject, or request changes.
                  </p>
                  <p className="text-sm text-foreground font-medium">
                    To review this application, please use a reviewer account.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Admins manage users, projects, and system settings</p>
                  <p>• Reviewers evaluate and make decisions on applications</p>
                  <p>• This separation ensures clear accountability and audit trails</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-muted">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Access Restricted</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  You do not have permission to review applications
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <p className="text-sm text-muted-foreground">
                  Only reviewers can perform review actions on applications.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Application Metadata */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted:</span>
                <span className="font-medium">
                  {new Date(application.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                {getStatusBadge(application.status || "pending")}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Applicant:</span>
                <span className="font-medium">{application.applicantName}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReviewApplication;

