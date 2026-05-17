import { useMemo } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Users, DollarSign } from "lucide-react";

const STATUS_BADGE: Record<string, JSX.Element> = {
  "open": <Badge className="bg-success text-success-foreground">Open</Badge>,
  "closing-soon": <Badge className="bg-warning text-warning-foreground">Closing Soon</Badge>,
  "closed": <Badge variant="secondary">Closed</Badge>,
};

const RAW_PROJECTS = [
  {
    id: 1,
    title: "African Women Tech Entrepreneurs Grant",
    description: "Supporting women-led tech startups across Africa with funding and mentorship.",
    deadline: "2024-12-15",
    funding: "$50,000",
    location: "Pan-African",
    applicants: 234,
    status: "open",
    category: "Technology"
  },
  {
    id: 2,
    title: "Sustainable Agriculture Innovation Fund",
    description: "Funding innovative agricultural solutions for food security in rural communities.",
    deadline: "2024-11-30",
    funding: "$25,000",
    location: "East Africa",
    applicants: 156,
    status: "open",
    category: "Agriculture"
  },
  {
    id: 3,
    title: "FinTech for Financial Inclusion",
    description: "Supporting fintech solutions that promote financial inclusion across Africa.",
    deadline: "2024-10-20",
    funding: "$75,000",
    location: "West Africa",
    applicants: 89,
    status: "closing-soon",
    category: "FinTech"
  }
];

const PROJECTS = RAW_PROJECTS.map((p) => ({
  ...p,
  deadlineFormatted: new Date(p.deadline).toLocaleDateString(),
}));

type Project = (typeof PROJECTS)[number];

const ProjectCard = ({ project }: { project: Project }) => (
  <Card className="hover:shadow-elegant transition-all duration-300">
    <CardHeader>
      <div className="flex items-start justify-between">
        <CardTitle className="text-lg leading-tight">{project.title}</CardTitle>
        {STATUS_BADGE[project.status] ?? <Badge variant="outline">{project.status}</Badge>}
      </div>
      <CardDescription className="text-sm">{project.description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>Due: {project.deadlineFormatted}</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span>{project.funding}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{project.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{project.applicants} applied</span>
        </div>
      </div>
      <Button className="w-full" variant="hero">
        Apply Now
      </Button>
    </CardContent>
  </Card>
);

const ProjectList = ({ projects }: { projects: Project[] }) => (
  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {projects.map((project) => (
      <ProjectCard key={project.id} project={project} />
    ))}
  </div>
);

const Projects = () => {
  const byCategory = useMemo(() => ({
    technology: PROJECTS.filter((p) => p.category === "Technology"),
    agriculture: PROJECTS.filter((p) => p.category === "Agriculture"),
    fintech: PROJECTS.filter((p) => p.category === "FinTech"),
  }), []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Current Opportunities
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover funding opportunities and projects designed to empower African entrepreneurs
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Projects</TabsTrigger>
            <TabsTrigger value="technology">Technology</TabsTrigger>
            <TabsTrigger value="agriculture">Agriculture</TabsTrigger>
            <TabsTrigger value="fintech">FinTech</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-8">
            <ProjectList projects={PROJECTS} />
          </TabsContent>
          <TabsContent value="technology" className="mt-8">
            <ProjectList projects={byCategory.technology} />
          </TabsContent>
          <TabsContent value="agriculture" className="mt-8">
            <ProjectList projects={byCategory.agriculture} />
          </TabsContent>
          <TabsContent value="fintech" className="mt-8">
            <ProjectList projects={byCategory.fintech} />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Projects;
