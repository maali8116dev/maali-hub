import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SEO } from "./SEO";

const PATH_TO_SEO_KEY: Record<string, string> = {
  "/": "home",
  "/opportunities": "opportunities",
  "/about": "about",
  "/resources": "resources",
  "/contact": "contact",
  "/partners": "partners",
  "/success-stories": "successStories",
  "/blog": "blog",
  "/help": "help",
  "/faq": "faq",
  "/mentors": "mentors",
  "/guide": "guide",
  "/privacy": "privacy",
  "/terms": "terms",
  "/cookies": "cookies",
  "/auth": "auth",
};

const NOINDEX_PREFIXES = ["/dashboard", "/admin", "/partner", "/reviewer", "/auth", "/onboarding", "/apply"];

export const RouteSEO = () => {
  const { pathname } = useLocation();
  const { t } = useTranslation("landing");
  const seoKey = PATH_TO_SEO_KEY[pathname];

  if (pathname === "/" || pathname.startsWith("/opportunities/") || pathname.startsWith("/blog/")) {
    return null;
  }

  const noindex = NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!seoKey) {
    return <SEO noindex={noindex} />;
  }

  return (
    <SEO
      title={t(`seo.routes.${seoKey}.title`)}
      description={t(`seo.routes.${seoKey}.description`)}
      noindex={noindex}
    />
  );
};
