import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie, Settings, X } from "lucide-react";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { Link } from "react-router-dom";

export const CookieConsent = () => {
  const { consentStatus, preferences, acceptAll, rejectAll, savePreferences } = useCookieConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [tempPrefs, setTempPrefs] = useState(preferences);

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
                  <h3 className="font-semibold text-lg mb-2">We value your privacy</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. 
                    By clicking "Accept All", you consent to our use of cookies. Read our{" "}
                    <Link to="/privacy" className="text-primary underline hover:no-underline">
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link to="/cookies" className="text-primary underline hover:no-underline">
                      Cookie Policy
                    </Link>{" "}
                    for more information.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <Button variant="outline" onClick={rejectAll} className="flex-1">
                  Reject All
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                  className="flex-1"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Customize
                </Button>
                <Button onClick={acceptAll} className="flex-1">
                  Accept All
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Cookie Preferences</h3>
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
                    <Label className="font-medium">Essential Cookies</Label>
                    <p className="text-sm text-muted-foreground">
                      Required for the website to function. Cannot be disabled.
                    </p>
                  </div>
                  <Switch checked disabled />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <Label htmlFor="analytics" className="font-medium">
                      Analytics Cookies
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Help us understand how visitors interact with our website.
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
                      Marketing Cookies
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Used to deliver personalized advertisements.
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
                  Cancel
                </Button>
                <Button onClick={handleSavePreferences} className="flex-1">
                  Save Preferences
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
