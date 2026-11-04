import { useTranslation } from "react-i18next";

export function Step9Submit() {
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t("applications.form.step8.title")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("applications.form.step8.description")}
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">{t("applications.form.step8.notice")}</p>
      </div>
    </div>
  );
}
