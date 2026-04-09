export const stepTitles = [
  "Applicant Information",
  "Organization Details (Optional)",
  "Project Overview",
  "Social Links",
  "Upload Documents",
  "Review",
  "Compliance & Declarations",
  "Submit",
];

export const PRIMARY_sectorS = [
  { value: "Health", label: "Health" },
  { value: "Education", label: "Education" },
  { value: "Technology", label: "Technology" },
  { value: "Agriculture", label: "Agriculture" },
  { value: "Environment", label: "Environment" },
  { value: "Creative", label: "Creative" },
  { value: "Other", label: "Other" },
];

export const APPLICANT_TYPES = [
  { value: "Individual", label: "Individual" },
  { value: "Organization", label: "Organization" },
  { value: "Startup / SME", label: "Startup / SME" },
  { value: "NGO / Non-profit", label: "NGO / Non-profit" },
  {
    value: "Research / Academic",
    label: "Research / Academic",
  },
] as const;

export interface ProjectOverviewCopy {
  sectionTitle: string;
  sectionHint: string;
  titleLabel: string;
  titlePlaceholder: string;
  summaryLabel: string;
  summaryPlaceholder: string;
  locationLabel: string;
  locationPlaceholder: string;
}

export const getProjectOverviewCopy = (isGrantType = true): ProjectOverviewCopy => ({
  sectionTitle: isGrantType ? "Project Overview" : "Application Overview",
  sectionHint: isGrantType
    ? "Tell us what you want funding for. All fields marked with"
    : "Tell us about your goals and why you're a strong fit for this opportunity. All fields marked with",
  titleLabel: isGrantType ? "Project Title" : "Application Title",
  titlePlaceholder: isGrantType ? "Enter project title" : "Enter application title",
  summaryLabel: isGrantType ? "Project Summary" : "Statement of Purpose",
  summaryPlaceholder: isGrantType
    ? "Provide a summary of your project (minimum 30 words)..."
    : "Briefly describe your goals, fit, and expected outcomes (minimum 30 words)...",
  locationLabel: isGrantType ? "Geographic Focus" : "Location / Geographic Focus",
  locationPlaceholder: isGrantType
    ? "Where will the project run?"
    : "Where are you based or where will this opportunity apply?",
});









