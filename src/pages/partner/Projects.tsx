import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Edit, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerProjects } from "@/hooks/usePartnerProjects";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  "closing-soon": "bg-amber-500/10 text-amber-600 border-amber-200",
  closed: "bg-red-500/10 text-red-600 border-red-200",
  new: "bg-blue-500/10 text-blue-600 border-blue-200",
  archived: "bg-muted text-muted-foreground",
};

const PartnerProjects = () => {
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = usePartnerProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="text-muted-foreground">Create and manage your funding opportunities</p>
        </div>
        <Button onClick={() => navigate("/partner/projects/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading projects...</div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">You haven't created any projects yet.</p>
            <Button onClick={() => navigate("/partner/projects/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{project.title}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{project.location}</span>
                    <span>•</span>
                    <span>{project.fundingAmount}</span>
                    <span>•</span>
                    <span>Deadline: {format(new Date(project.deadline), "MMM d, yyyy")}</span>
                  </div>
                </div>
                <Badge variant="outline" className={statusColors[project.status] || ""}>
                  {project.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{project.description}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/partner/projects/${project.id}/applications`)}>
                    <FileText className="h-4 w-4 mr-1" />
                    Applications ({project.currentApplicants})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/partner/projects/${project.id}/edit`)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PartnerProjects;
