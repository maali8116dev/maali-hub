import { useLocation } from "react-router-dom";
import { SEO } from "./SEO";

type Meta = { title: string; description: string };

const META: Record<string, Meta> = {
  "/": {
    title: "Empowering African Talent",
    description:
      "Discover grants, jobs, internships, trainings, scholarships, and more across Africa. Apply with confidence and track outcomes on the Maali opportunity hub.",
  },
  "/opportunities": {
    title: "Opportunities",
    description:
      "Browse open grants, jobs, scholarships, fellowships, and trainings for African talent. Filter by sector, region, and partner to find your next opportunity.",
  },
  "/about": {
    title: "About Maali",
    description:
      "Learn how Maali empowers African entrepreneurs and talent by connecting them with funding, mentorship, and career-defining opportunities.",
  },
  "/resources": {
    title: "Resources",
    description:
      "Guides, templates, videos, and toolkits to help you apply for funding, scholarships, and jobs across Africa with confidence.",
  },
  "/contact": {
    title: "Contact Us",
    description:
      "Get in touch with the Maali team for partnership, application help, or platform support. We typically reply within one business day.",
  },
  "/partners": {
    title: "Our Partners",
    description:
      "Meet the funding, support, and ecosystem partners working with Maali to unlock opportunities for African entrepreneurs and talent.",
  },
  "/success-stories": {
    title: "Success Stories",
    description:
      "Real stories of African founders and professionals who grew their impact through opportunities discovered on Maali.",
  },
  "/blog": {
    title: "Blog",
    description:
      "Insights, tips, and ecosystem updates on funding, careers, and entrepreneurship across Africa from the Maali editorial team.",
  },
  "/help": {
    title: "Help Center",
    description:
      "Find answers about applying, eligibility, payments, and account management on the Maali opportunity platform.",
  },
  "/faq": {
    title: "Frequently Asked Questions",
    description:
      "Answers to common questions about Maali — applications, eligibility, fees, reviews, and how opportunities work.",
  },
  "/mentors": {
    title: "Mentors",
    description:
      "Connect with experienced mentors across industries who guide African entrepreneurs and professionals on their journey.",
  },
  "/guide": {
    title: "Getting Started Guide",
    description:
      "Step-by-step guide to creating your Maali profile, discovering opportunities, and submitting strong applications.",
  },
  "/privacy": {
    title: "Privacy Policy",
    description:
      "How Maali collects, uses, and protects your personal data across the opportunity platform.",
  },
  "/terms": {
    title: "Terms of Service",
    description: "The terms and conditions that govern your use of the Maali opportunity platform.",
  },
  "/cookies": {
    title: "Cookie Policy",
    description: "How Maali uses cookies and similar technologies, and the choices available to you.",
  },
  "/auth": {
    title: "Sign In",
    description: "Sign in or create a Maali account to apply for opportunities across Africa.",
  },
};

const NOINDEX_PREFIXES = ["/dashboard", "/admin", "/partner", "/reviewer", "/auth", "/onboarding", "/apply"];

export const RouteSEO = () => {
  const { pathname } = useLocation();
  const meta = META[pathname];

  // Per-page SEO components (Index, ProjectDetails, BlogDetail-if-any) handle their own.
  if (pathname === "/" || pathname.startsWith("/opportunities/") || pathname.startsWith("/blog/")) {
    return null;
  }

  const noindex = NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!meta) {
    return <SEO noindex={noindex} />;
  }

  return <SEO title={meta.title} description={meta.description} noindex={noindex} />;
};
