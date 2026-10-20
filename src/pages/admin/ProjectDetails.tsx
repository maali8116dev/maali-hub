import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Calendar, MapPin, DollarSign, Users, Star, ExternalLink } from "lucide-react";
import { useProject } from "@/hooks/useAdminProjects";
import { useLocalizedOpportunity } from "@/lib/localizedContent";
import { getProjectStatusBadge } from "@/lib/statusBadges";

const AdminProjectDetails = () => {
  const { t, i18n } = useTranslation("dashboard");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = id ? parseInt(id) : undefined;

  const { data: projectRaw, isLoading, error } = useProject(projectId);
  const project = useLocalizedOpportunity(projectRaw);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(i18n.language);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">{t("admin.projectDetailsPage.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/admin/opportunities")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("admin.projectDetailsPage.back")}
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">{t("admin.projectDetailsPage.notFound")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin/opportunities")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("admin.projectDetailsPage.back")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/opportunities/${project.id}`} target="_blank">
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("admin.projectDetailsPage.viewPublic")}
            </Button>
          </Link>
          <Button onClick={() => navigate(`/admin/opportunities/${project.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            {t("admin.projectDetailsPage.edit")}
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
                        {t("admin.projectDetailsPage.featured")}
                      </Badge>
                    )}
                    {getProjectStatusBadge(project.status, t)}
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
                <CardTitle>{t("admin.projectDetailsPage.requirementsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.requirements && (
                  <div>
                    <h4 className="font-semibold mb-2">{t("admin.projectDetailsPage.requirements")}</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">{project.requirements}</p>
                  </div>
                )}
                {project.eligibilityCriteria && (
                  <div>
                    <h4 className="font-semibold mb-2">{t("admin.projectDetailsPage.eligibility")}</h4>
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
              <CardTitle>{t("admin.projectDetailsPage.sidebarTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.projectDetailsPage.fundingAmount")}</p>
                  <p className="font-semibold">{project.fundingAmount}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.projectDetailsPage.deadline")}</p>
                  <p className="font-semibold">{formatDate(project.deadline)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.projectDetailsPage.location")}</p>
                  <p className="font-semibold">{project.location}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.projectDetailsPage.applicants")}</p>
                  <p className="font-semibold">
                    {project.currentApplicants || 0}
                    {project.maxApplicants ? ` / ${project.maxApplicants}` : ""}
                  </p>
                </div>
              </div>
{/* 
              {applicationFee > 0 && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Application Fee</p>
                    <p className="font-semibold">${applicationFee.toFixed(2)}</p>
                  </div>
                </div>
              )} */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.projectDetailsPage.metadata")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project ID</span>
                <span className="font-mono">{project.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("admin.projectDetailsPage.created")}</span>
                <span>{formatDate(project.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("admin.projectDetailsPage.updated")}</span>
                <span>{formatDate(project.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminProjectDetails;








