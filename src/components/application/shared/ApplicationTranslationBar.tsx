import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Languages, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

type ApplicationTranslationBarProps = {
  visible: boolean;
  showTranslated: boolean;
  hasCache: boolean;
  isTranslating: boolean;
  sourceLocale: string;
  targetLocale: string;
  onTranslate: () => void | Promise<void>;
  onShowOriginal: () => void;
};

const ApplicationTranslationBar = ({
  visible,
  showTranslated,
  hasCache,
  isTranslating,
  sourceLocale,
  targetLocale,
  onTranslate,
  onShowOriginal,
}: ApplicationTranslationBarProps) => {
  const { t } = useTranslation("dashboard");

  if (!visible) return null;

  return (
    <Alert className="border-primary/20 bg-primary/5">
      <Languages className="h-4 w-4" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-sm">
          {showTranslated
            ? t("applications.detail.translation.showingTranslated", {
                source: sourceLocale.toUpperCase(),
                target: targetLocale.toUpperCase(),
              })
            : t("applications.detail.translation.offer", {
                source: sourceLocale.toUpperCase(),
              })}
        </span>
        <div className="flex flex-wrap gap-2">
          {showTranslated ? (
            <Button type="button" variant="outline" size="sm" onClick={onShowOriginal}>
              {t("applications.detail.translation.viewOriginal")}
            </Button>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={onTranslate} disabled={isTranslating}>
              {isTranslating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("applications.detail.translation.translating")}
                </>
              ) : hasCache ? (
                t("applications.detail.translation.viewTranslation")
              ) : (
                t("applications.detail.translation.translateForMe")
              )}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default ApplicationTranslationBar;
