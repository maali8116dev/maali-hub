import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
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
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Mock data - replace with API call
  const application = {
    id: id || "1",
    applicantName: "John Doe",
    applicantEmail: "john.doe@example.com",
    projectTitle: "AgriTech Innovation Fund",
    submittedAt: "2024-01-15",
    status: "pending",
    companyName: "AgriTech Solutions",
    contactEmail: "contact@agritech.com",
    contactPhone: "+1234567890",
    location: "Nairobi, Kenya",
    projectDescription:
      "We are developing innovative agricultural solutions using IoT sensors and AI to help small-scale farmers increase crop yields and reduce waste. Our platform provides real-time monitoring of soil conditions, weather patterns, and crop health.",
    fundingAmountRequested: "$50,000",
    businessPlan: "Our business plan focuses on sustainable agriculture practices and technology adoption in rural African communities.",
    teamSize: 5,
    documents: [
      { id: "1", fileName: "business-plan.pdf", fileSize: 245000 },
      { id: "2", fileName: "financial-projections.xlsx", fileSize: 89000 },
    ],
  };

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

    setIsSubmitting(true);
    try {
      // API call to approve application
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      
      // Email integration - uncomment to send approval email
      // await sendApplicationApprovedEmail(
      //   application.contactEmail,
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
      toast({
        title: "Error",
        description: "Failed to approve application. Please try again.",
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

    setIsSubmitting(true);
    try {
      // API call to reject application
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      
      // Email integration - uncomment to send rejection email
      // await sendApplicationRejectedEmail(
      //   application.contactEmail,
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
      toast({
        title: "Error",
        description: "Failed to reject application. Please try again.",
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

    setIsSubmitting(true);
    try {
      // API call to request more info
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      
      // Email integration - uncomment to send under review email with info request
      // await sendApplicationUnderReviewEmail(
      //   application.contactEmail,
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
      toast({
        title: "Error",
        description: "Failed to send request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(getBackRoute())}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Applications
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Review Application</h1>
            <p className="text-muted-foreground mt-1">
              Application ID: {application.id}
            </p>
          </div>
        </div>
        {getStatusBadge(application.status)}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Applicant Information */}
          <Card>
            <CardHeader>
              <CardTitle>Applicant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Company Name</p>
                    <p className="font-medium">{application.companyName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Email</p>
                    <p className="font-medium">{application.contactEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Phone</p>
                    <p className="font-medium">{application.contactPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{application.location}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Details */}
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Project Title</Label>
                <p className="font-medium mt-1">{application.projectTitle}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Project Description</Label>
                <p className="mt-1 text-sm">{application.projectDescription}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Funding Amount Requested</p>
                    <p className="font-medium">{application.fundingAmountRequested}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Team Size</p>
                    <p className="font-medium">{application.teamSize} members</p>
                  </div>
                </div>
              </div>
              {application.businessPlan && (
                <div>
                  <Label className="text-sm text-muted-foreground">Business Plan Summary</Label>
                  <p className="mt-1 text-sm">{application.businessPlan}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          {application.documents && application.documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Supporting Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {application.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {(doc.fileSize / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Review Panel */}
        <div className="space-y-6">
          {isReviewer ? (
            <Card>
              <CardHeader>
                <CardTitle>Review Actions</CardTitle>
                <CardDescription>
                  Submit your review decision for this application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    className="w-full bg-success hover:bg-success/90"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Application
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={isSubmitting || application.status === "rejected"}
                    variant="destructive"
                    className="w-full"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Application
                  </Button>
                  <Button
                    onClick={handleRequestMoreInfo}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full"
                  >
                    Request More Information
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : isAdmin ? (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-warning" />
                  Review Actions Restricted
                </CardTitle>
                <CardDescription>
                  Administrative accounts cannot perform review actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              <CardHeader>
                <CardTitle>Access Restricted</CardTitle>
                <CardDescription>
                  You do not have permission to review applications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Only reviewers can perform review actions on applications.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Application Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted:</span>
                <span className="font-medium">
                  {new Date(application.submittedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                {getStatusBadge(application.status)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReviewApplication;

