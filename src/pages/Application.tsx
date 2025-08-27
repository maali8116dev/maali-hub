import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, DollarSign, Calendar, Users } from "lucide-react";

// Mock project data - in a real app, this would come from your backend
const mockProjects = [
  {
    id: "1",
    title: "Smart Irrigation System for Smallholder Farmers",
    description: "Develop affordable IoT-based irrigation solutions to help smallholder farmers optimize water usage and increase crop yields in sub-Saharan Africa.",
    sector: "Agriculture",
    country: "Kenya",
    fundingAmount: "$50,000",
    deadline: "March 30, 2024",
    applicants: 45,
    status: "open" as const
  },
  // Add more mock projects as needed
];

const Application = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    // Find the project by ID
    const foundProject = mockProjects.find(p => p.id === projectId);
    setProject(foundProject);
  }, [projectId]);

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
            <Button onClick={() => navigate("/projects")}>
              Back to Projects
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate("/projects")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Project Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="secondary">{project.sector}</Badge>
                  <Badge className="bg-success text-success-foreground">
                    {project.status === 'open' ? 'Open' : 'Closed'}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{project.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  {project.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <span>{project.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <span>{project.fundingAmount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <span>Deadline: {project.deadline}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span>{project.applicants} applications</span>
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Requirements</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Business plan document</li>
                    <li>Financial projections</li>
                    <li>Team member resumes</li>
                    <li>Letters of support</li>
                    <li>Technical specifications</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Application Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Start Your Application</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Ready to apply for this grant? Click below to begin the application process.
                </p>
                <Button className="w-full" size="lg">
                  Begin Application
                </Button>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Application fee: $25 (processed at submission)
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Application;