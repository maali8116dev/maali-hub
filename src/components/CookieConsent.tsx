import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie, Settings, X } from "lucide-react";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";

export const CookieConsent = () => {
  const { consentStatus, preferences, acceptAll, rejectAll, savePreferences } = useCookieConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [tempPrefs, setTempPrefs] = useState(preferences);
  const { t } = useTranslation('common');

  if (consentStatus !== "pending") return null;

  const handleSavePreferences = () => {
    savePreferences(tempPrefs);
    setShowSettings(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl">
        <Card className="p-6 shadow-2xl border-2 bg-background/95 backdrop-blur-sm">
          {!showSettings ? (
            <>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Cookie className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{t('cookieConsent.title')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    <Trans
                      i18nKey="cookieConsent.description"
                      ns="common"
                      components={{
                        privacyLink: <Link to="/privacy" className="text-primary underline hover:no-underline" />,
                        cookieLink: <Link to="/cookies" className="text-primary underline hover:no-underline" />
                      }}
                    />
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <Button variant="outline" onClick={rejectAll} className="flex-1">
                  {t('cookieConsent.rejectAll')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                  className="flex-1"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {t('cookieConsent.customize')}
                </Button>
                <Button onClick={acceptAll} className="flex-1">
                  {t('cookieConsent.acceptAll')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">{t('cookieConsent.preferences.title')}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <Label className="font-medium">{t('cookieConsent.preferences.essential.label')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('cookieConsent.preferences.essential.description')}
                    </p>
                  </div>
                  <Switch checked disabled />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <Label htmlFor="analytics" className="font-medium">
                      {t('cookieConsent.preferences.analytics.label')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('cookieConsent.preferences.analytics.description')}
                    </p>
                  </div>
                  <Switch
                    id="analytics"
                    checked={tempPrefs.analytics}
                    onCheckedChange={(checked) =>
                      setTempPrefs((prev) => ({ ...prev, analytics: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <Label htmlFor="marketing" className="font-medium">
                      {t('cookieConsent.preferences.marketing.label')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('cookieConsent.preferences.marketing.description')}
                    </p>
                  </div>
                  <Switch
                    id="marketing"
                    checked={tempPrefs.marketing}
                    onCheckedChange={(checked) =>
                      setTempPrefs((prev) => ({ ...prev, marketing: checked }))
                    }
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                  className="flex-1"
                >
                  {t('cookieConsent.preferences.cancel')}
                </Button>
                <Button onClick={handleSavePreferences} className="flex-1">
                  {t('cookieConsent.preferences.save')}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CookieConsent;








