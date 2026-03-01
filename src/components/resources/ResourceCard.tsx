import { Download, ExternalLink, FileText, Video, Table2, Presentation, Link as LinkIcon, Clock, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Resource } from "@/hooks/useResources";
import { useTranslation } from "react-i18next";

interface ResourceCardProps {
  resource: Resource;
  onDownload: (resource: Resource) => void;
  variant?: "default" | "featured";
}

const getFileIcon = (fileType: string) => {
  const iconClass = "h-5 w-5";
  switch (fileType) {
    case "pdf":
      return <FileText className={iconClass} />;
    case "video":
    case "webinar":
      return <Video className={iconClass} />;
    case "excel":
      return <Table2 className={iconClass} />;
    case "powerpoint":
      return <Presentation className={iconClass} />;
    case "word":
      return <FileText className={iconClass} />;
    case "link":
    case "directory":
    case "event":
      return <LinkIcon className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
  }
};

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getTypeLabel = (fileType: string, t: any): string => {
  const labels: Record<string, string> = {
    pdf: t('dashboard:resources.card.typeLabels.pdfDocument'),
    video: t('dashboard:resources.card.typeLabels.video'),
    webinar: t('dashboard:resources.card.typeLabels.webinar'),
    excel: t('dashboard:resources.card.typeLabels.spreadsheet'),
    powerpoint: t('dashboard:resources.card.typeLabels.presentation'),
    word: t('dashboard:resources.card.typeLabels.document'),
    link: t('dashboard:resources.card.typeLabels.externalLink'),
    directory: t('dashboard:resources.card.typeLabels.directory'),
    event: t('dashboard:resources.card.typeLabels.event')
  };
  return labels[fileType] || fileType;
};

const isExternalType = (fileType: string): boolean => {
  return ["link", "directory", "event", "video", "webinar"].includes(fileType);
};

export function ResourceCard({ resource, onDownload, variant = "default" }: ResourceCardProps) {
  const { t } = useTranslation(['dashboard']);
  const isFeatured = variant === "featured";
  
  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-lg",
        "border-border/50 hover:border-primary/30",
        isFeatured && "ring-1 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
      )}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Mobile: Stack layout, Desktop: Row layout */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          {/* Icon */}
          <div 
            className={cn(
              "flex-shrink-0 p-2.5 sm:p-3 rounded-xl transition-colors w-fit",
              "bg-muted group-hover:bg-primary/10",
              isFeatured && "bg-primary/10"
            )}
          >
            <span className="text-primary">{getFileIcon(resource.file_type)}</span>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 sm:line-clamp-1">
                {resource.title}
              </h3>
              {resource.is_featured && variant === "default" && (
                <Badge variant="secondary" className="flex-shrink-0 text-xs w-fit">
                  {t('dashboard:resources.card.featured')}
                </Badge>
              )}
            </div>
            
            {resource.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {resource.description}
              </p>
            )}
            
            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
              <Badge variant="outline" className="text-xs font-normal">
                {getTypeLabel(resource.file_type, t)}
              </Badge>
              
              {resource.duration && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {resource.duration}
                </span>
              )}
              
              {resource.file_size && !resource.duration && (
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(resource.file_size)}
                </span>
              )}
              
              {resource.download_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  {resource.download_count}
                </span>
              )}
            </div>
          </div>
          
          {/* Action button - Full width on mobile, auto on desktop */}
          <div className="flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
            {resource.title === "Find a Mentor" ? (
              <Button size="sm" variant="outline" asChild className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
                <Link to="/mentors">
                  {t('dashboard:resources.card.view')}
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant={isFeatured ? "default" : "outline"}
                onClick={() => onDownload(resource)}
                disabled={!resource.file_url}
                className="group/btn w-full sm:w-auto min-h-[44px] sm:min-h-0"
              >
                {isExternalType(resource.file_type) ? (
                  <>
                    {t('dashboard:resources.card.open')}
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                  </>
                ) : (
                  <>
                    {t('dashboard:resources.card.download')}
                    <Download className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover/btn:translate-y-0.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
