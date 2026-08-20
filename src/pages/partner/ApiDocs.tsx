import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PartnerOrgRequiredAlert } from "@/components/partner/PartnerOrgRequiredAlert";
import { usePartnerOrg } from "@/hooks/usePartnerOrg";
import { getPartnerApiBaseUrl } from "@/lib/partnerApiConstants";
import { getPartnerApiDocsMarkdown } from "@/lib/partnerApiDocsContent";
import { partnerApiMarkdownComponents } from "@/components/partner/partnerApiMarkdownComponents";

const PartnerApiDocs = () => {
  const { t, i18n } = useTranslation("dashboard");
  const { data: partnerOrg, isLoading } = usePartnerOrg();
  const apiBaseUrl = getPartnerApiBaseUrl();

  const content = useMemo(
    () => getPartnerApiDocsMarkdown(i18n.language).replaceAll(
      "{{API_BASE_URL}}",
      apiBaseUrl || "https://your-project.supabase.co/functions/v1/partner-api/v1",
    ),
    [apiBaseUrl, i18n.language],
  );

  if (isLoading) {
    return <p className="text-muted-foreground">{t("partner.apiPage.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
            <Link to="/partner/api">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("partner.apiDocs.back")}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            {t("partner.apiDocs.title")}
          </h1>
          <p className="text-muted-foreground">{t("partner.apiDocs.subtitle")}</p>
        </div>
      </div>

      <PartnerOrgRequiredAlert />

      {partnerOrg ? (
        <Card>
          <CardContent className="pt-6">
            <article className="partner-api-docs max-w-none text-sm md:text-base">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={partnerApiMarkdownComponents}
              >
                {content}
              </ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default PartnerApiDocs;
