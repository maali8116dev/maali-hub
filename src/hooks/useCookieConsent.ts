import { useState, useEffect, useCallback } from "react";

export type ConsentStatus = "pending" | "accepted" | "rejected";

interface CookiePreferences {
  analytics: boolean;
  marketing: boolean;
}

const CONSENT_KEY = "cookie-consent";
const PREFERENCES_KEY = "cookie-preferences";

export const useCookieConsent = () => {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>(() => {
    if (typeof window === "undefined") return "pending";
    const stored = localStorage.getItem(CONSENT_KEY);
    return (stored as ConsentStatus) || "pending";
  });

  const [preferences, setPreferences] = useState<CookiePreferences>(() => {
    if (typeof window === "undefined") return { analytics: false, marketing: false };
    const stored = localStorage.getItem(PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : { analytics: false, marketing: false };
  });

  const acceptAll = useCallback(() => {
    const newPrefs = { analytics: true, marketing: true };
    localStorage.setItem(CONSENT_KEY, "accepted");
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPrefs));
    setConsentStatus("accepted");
    setPreferences(newPrefs);
  }, []);

  const rejectAll = useCallback(() => {
    const newPrefs = { analytics: false, marketing: false };
    localStorage.setItem(CONSENT_KEY, "rejected");
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPrefs));
    setConsentStatus("rejected");
    setPreferences(newPrefs);
  }, []);

  const savePreferences = useCallback((newPrefs: CookiePreferences) => {
    const status = newPrefs.analytics || newPrefs.marketing ? "accepted" : "rejected";
    localStorage.setItem(CONSENT_KEY, status);
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPrefs));
    setConsentStatus(status);
    setPreferences(newPrefs);
  }, []);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(CONSENT_KEY);
    localStorage.removeItem(PREFERENCES_KEY);
    setConsentStatus("pending");
    setPreferences({ analytics: false, marketing: false });
  }, []);

  return {
    consentStatus,
    preferences,
    acceptAll,
    rejectAll,
    savePreferences,
    resetConsent,
    hasConsented: consentStatus !== "pending",
    canTrack: consentStatus === "accepted" && preferences.analytics,
  };
};
