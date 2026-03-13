import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon, HelpCircle, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "hero";
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  helpLink?: string;
  tips?: string[];
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  helpLink,
  tips,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      {Icon && (
        <Icon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-md">{description}</p>
      )}
      
      {/* Tips Section */}
      {tips && tips.length > 0 && (
        <div className="w-full max-w-md mb-6">
          <div className="bg-muted/50 rounded-lg p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Quick Tips</span>
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">-¢</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
        {action && (
          <Button 
            variant={action.variant || "default"} 
            onClick={action.onClick}
            className="w-full sm:w-auto"
          >
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button 
            variant={secondaryAction.variant || "outline"} 
            onClick={secondaryAction.onClick}
            className="w-full sm:w-auto"
          >
            {secondaryAction.label}
          </Button>
        )}
        {helpLink && (
          <Link to={helpLink}>
            <Button variant="ghost" className="w-full sm:w-auto">
              <BookOpen className="h-4 w-4 mr-2" />
              Learn More
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}









