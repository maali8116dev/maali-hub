import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Globe, Link as LinkIcon } from "lucide-react";

interface SocialLinksCardProps {
  application: Record<string, any>;
}

interface SocialLinkFieldProps {
  label: string;
  url: string;
  icon?: React.ElementType;
}

const SocialLinkField = ({ label, url, icon: Icon = LinkIcon }: SocialLinkFieldProps) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
    <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-primary hover:underline break-all"
      >
        {url}
      </a>
    </div>
  </div>
);

const SocialLinksCard = ({ application }: SocialLinksCardProps) => {
  const hasLinks =
    application.linkedin_url ||
    application.github_url ||
    application.twitter_url ||
    application.website_url ||
    application.other_social_links;

  if (!hasLinks) return null;

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg">Social Links & Online Presence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {application.linkedin_url && (
            <SocialLinkField label="LinkedIn" url={application.linkedin_url} />
          )}
          {application.github_url && (
            <SocialLinkField label="GitHub" url={application.github_url} />
          )}
          {application.twitter_url && (
            <SocialLinkField label="Twitter" url={application.twitter_url} />
          )}
          {application.website_url && (
            <SocialLinkField label="Website" url={application.website_url} icon={Globe} />
          )}
        </div>
        {application.other_social_links && (
          <div>
            <Label className="text-sm text-muted-foreground">Other Social Links</Label>
            <p className="mt-1 text-sm break-all">{application.other_social_links}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SocialLinksCard;

