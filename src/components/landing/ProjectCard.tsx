import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Calendar, MapPin, DollarSign, Users, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

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
}

type ProjectCardProps = LegacyProjectCardProps | DatabaseProjectCardProps;

// Type guard to check if it's a database project
function isDatabaseProject(props: ProjectCardProps): props is DatabaseProjectCardProps {
  return 'category' in props && 'location' in props && 'currentApplicants' in props;
}

const ProjectCard = (props: ProjectCardProps) => {
  const navigate = useNavigate();
  
  // Normalize props based on type
  const id = props.id;
  const title = props.title;
  const description = props.description;
  const sector = isDatabaseProject(props) ? props.category : props.sector;
  const country = isDatabaseProject(props) ? props.location : props.country;
  const fundingAmount = props.fundingAmount;
  const deadline = props.deadline;
  const applicants = isDatabaseProject(props) ? props.currentApplicants : props.applicants;
  const status = props.status;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-success text-success-foreground';
      case 'closing-soon':
        return 'bg-warning text-warning-foreground';
      case 'closed':
        return 'bg-muted text-muted-foreground';
      case 'new':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return 'Open';
      case 'closing-soon':
        return 'Closing Soon';
      case 'closed':
        return 'Closed';
      case 'new':
        return 'New';
      default:
        return 'Unknown';
    }
  };

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

  const isDisabled = status === 'closed';

  return (
    <Card className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 border-border flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="secondary" className="text-xs">
            {sector}
          </Badge>
          <Badge className={getStatusColor(status)}>
            {getStatusText(status)}
          </Badge>
        </div>
        <Link to={`/application/${id}`} className="block">
          <h3 className="text-lg font-semibold group-hover:text-primary transition-colors cursor-pointer hover:underline">
            {title}
          </h3>
        </Link>
      </CardHeader>
      
      <CardContent className="pb-4 flex-1">
        <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
          {description}
        </p>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{country}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>{fundingAmount}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formatDeadline(deadline)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{applicants} applied</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 flex gap-2">
        <Button 
          variant="outline" 
          className="flex-1"
          asChild
        >
          <Link to={`/application/${id}`}>
            View Details
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
        <Button 
          variant={!isDisabled ? 'hero' : 'outline'} 
          className="flex-1"
          disabled={isDisabled}
          onClick={() => !isDisabled && navigate(`/application-form/${id}`)}
        >
          {isDisabled ? 'Closed' : 'Apply'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProjectCard;
