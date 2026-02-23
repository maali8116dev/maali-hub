import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Calendar, MapPin, DollarSign, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getProjectDisplayStatus, isProjectOpen } from "@/lib/projectAvailability";

// Props for legacy mock data (used in FeaturedProjects)
interface LegacyProjectCardProps {
  id: string;
  title: string;
  description: string;
  sector: string;
  country: string;
  fundingAmount: string;
  deadline: string;
  applicants: number;
  status: 'open' | 'closing-soon' | 'closed' | 'new';
}

// Props for database projects (used in Projects page)
interface DatabaseProjectCardProps {
  id: number;
  title: string;
  description: string;
  category: string;
  location: string;
  fundingAmount: string;
  deadline: string;
  currentApplicants: number;
  status: string;
  createdAt?: string;
  hasSubmittedApplication?: boolean;
}

type ProjectCardProps = LegacyProjectCardProps | DatabaseProjectCardProps;

// Type guard to check if it's a database project
function isDatabaseProject(props: ProjectCardProps): props is DatabaseProjectCardProps {
  return 'category' in props && 'location' in props && 'currentApplicants' in props;
}

const ProjectCard = (props: ProjectCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Normalize props based on type
  const id = props.id;
  const title = props.title;
  const description = props.description;
  const sector = isDatabaseProject(props) ? props.category : props.sector;
  const country = isDatabaseProject(props) ? props.location : props.country;
  const fundingAmount = props.fundingAmount;
  const deadline = props.deadline;
  const status = props.status;
  const createdAt = isDatabaseProject(props) ? props.createdAt : undefined;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New':
        return 'bg-blue-500 text-white';
      case 'Closing Soon':
        return 'bg-warning text-warning-foreground';
      case 'Open':
        return 'bg-success text-success-foreground';
      case 'Closed':
        return 'bg-muted text-muted-foreground';
      case 'Archived':
        return 'bg-slate-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => status;

  // Format deadline if it's a date string
  const formatDeadline = (deadline: string) => {
    try {
      const date = new Date(deadline);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {
      // Return as-is if parsing fails
    }
    return deadline;
  };

  const displayStatus = isDatabaseProject(props)
    ? getProjectDisplayStatus(status, deadline, createdAt)
    : status;

  const isDisabled = isDatabaseProject(props)
    ? !isProjectOpen(status, deadline)
    : status === 'closed';

  const hasSubmittedApplication = isDatabaseProject(props) && props.hasSubmittedApplication;
  const applyDisabled = isDisabled || hasSubmittedApplication;

  // Parse location string to handle multiple countries (comma-separated)
  const parseLocations = (locationString: string): string[] => {
    if (!locationString) return [];
    return locationString
      .split(',')
      .map(loc => loc.trim())
      .filter(loc => loc.length > 0);
  };

  const locations = parseLocations(country);

  return (
    <Card className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 border-border flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="secondary" className="text-xs">
            {sector}
          </Badge>
          <Badge className={getStatusColor(displayStatus)}>
            {getStatusText(displayStatus)}
          </Badge>
        </div>
        <Link to={`/projects/${id}`} className="block">
          <h3 className="text-lg font-semibold group-hover:text-primary transition-colors cursor-pointer hover:underline">
            {title}
          </h3>
        </Link>
      </CardHeader>
      
      <CardContent className="pb-4 flex-1">
        <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
          {description}
        </p>
        
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>{fundingAmount}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDeadline(deadline)}</span>
            </div>
          </div>
          <div className={`flex items-start gap-2 text-muted-foreground ${locations.length > 1 ? '' : ''}`}>
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {locations.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {locations.map((loc, index) => (
                  <Badge key={index} variant="outline" className="text-xs font-normal">
                    {loc}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="break-words">{locations[0] || country}</span>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            className="flex-1"
            asChild
          >
            <Link to={`/projects/${id}`}>
              View Details
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
          <Button 
            variant={!applyDisabled ? 'hero' : 'outline'} 
            className="w-full sm:w-36 shrink-0"
            
            disabled={applyDisabled}
            onClick={() => {
              if (applyDisabled) return;
              if (hasSubmittedApplication) {
                toast({
                  title: "Already Applied",
                  description: "You already submitted an application for this opportunity. You can view it from your dashboard.",
                  variant: "default",
                });
                return;
              }
              if (!user) {
                toast({
                  title: "Login Required",
                  description: "Please log in or create an account to apply for this opportunity.",
                  variant: "default",
                });
                navigate("/auth", { state: { from: { pathname: `/projects/${id}/apply` } } });
              } else {
                navigate(`/projects/${id}/apply`);
              }
            }}
          >
            {hasSubmittedApplication ? 'Applied' : isDisabled ? 'Closed' : 'Apply'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProjectCard;
