import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Calendar, MapPin, DollarSign, Users, Star, ExternalLink } from "lucide-react";
import { useProject } from "@/hooks/useAdminProjects";

const AdminProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = id ? parseInt(id) : undefined;

  const { data: project, isLoading, error } = useProject(projectId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-success text-success-foreground">Open</Badge>;
      case "closing-soon":
        return <Badge className="bg-warning text-warning-foreground">Closing Soon</Badge>;
      case "closed":
        return <Badge variant="secondary">Closed</Badge>;
      case "new":
        return <Badge variant="default">New</Badge>;
      case "archived":
        return <Badge className="bg-slate-500 text-white">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/admin/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Project not found or an error occurred.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/projects/${project.id}`} target="_blank">
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Public Page
            </Button>
          </Link>
          <Button onClick={() => navigate(`/admin/projects/${project.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {project.featured && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                        <Star className="h-3 w-3 mr-1 fill-yellow-500" />
                        Featured
                      </Badge>
                    )}
                    {getStatusBadge(project.status)}
                    <Badge variant="outline">{project.sector}</Badge>
                  </div>
                  <CardTitle className="text-2xl">{project.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>
            </CardContent>
          </Card>

          {(project.requirements || project.eligibilityCriteria) && (
            <Card>
              <CardHeader>
                <CardTitle>Requirements & Eligibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.requirements && (
                  <div>
                    <h4 className="font-semibold mb-2">Requirements</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">{project.requirements}</p>
                  </div>
                )}
                {project.eligibilityCriteria && (
                  <div>
                    <h4 className="font-semibold mb-2">Eligibility Criteria</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">{project.eligibilityCriteria}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {project.imageUrl && (
            <Card>
              <CardContent className="pt-6">
                <img
                  src={project.imageUrl}
                  alt={project.title}
                  className="w-full h-48 object-cover rounded-lg"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Funding Amount</p>
                  <p className="font-semibold">{project.fundingAmount}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Deadline</p>
                  <p className="font-semibold">{new Date(project.deadline).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-semibold">{project.location}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Applicants</p>
                  <p className="font-semibold">
                    {project.currentApplicants || 0}
                    {project.maxApplicants ? ` / ${project.maxApplicants}` : ""}
                  </p>
                </div>
              </div>

              {project.applicationFee !== undefined && project.applicationFee > 0 && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Application Fee</p>
                    <p className="font-semibold">${project.applicationFee}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project ID</span>
                <span className="font-mono">{project.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminProjectDetails;








