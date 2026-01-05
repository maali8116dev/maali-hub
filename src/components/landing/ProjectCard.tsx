import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Calendar, MapPin, DollarSign, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ProjectCardProps {
  id: string;
  title: string;
  description: string;
  sector: string;
  country: string;
  fundingAmount: string;
  deadline: string;
  applicants: number;
  status: 'open' | 'closing-soon' | 'closed';
}

const ProjectCard = ({
  id,
  title,
  description,
  sector,
  country,
  fundingAmount,
  deadline,
  applicants,
  status
}: ProjectCardProps) => {
  const navigate = useNavigate();
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-success text-success-foreground';
      case 'closing-soon':
        return 'bg-warning text-warning-foreground';
      case 'closed':
        return 'bg-muted text-muted-foreground';
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
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 border-border">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="secondary" className="text-xs">
            {sector}
          </Badge>
          <Badge className={getStatusColor(status)}>
            {getStatusText(status)}
          </Badge>
        </div>
        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
          {title}
        </h3>
      </CardHeader>
      
      <CardContent className="pb-4">
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
            <span>{deadline}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{applicants} applied</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-0">
        <Button 
          variant={status === 'open' ? 'hero' : 'outline'} 
          className="w-full"
          disabled={status === 'closed'}
          onClick={() => status !== 'closed' && navigate(`/application/${id}`)}
        >
          {status === 'closed' ? 'Application Closed' : 'Apply Now'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProjectCard;

