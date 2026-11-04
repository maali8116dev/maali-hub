import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/useProfile";
import type { ApplicationFormData } from "@/stores/applicationForm";
import { PRIMARY_sectorS } from "@/components/application/form/constants";

const SECTOR_VALUES = new Set(PRIMARY_sectorS.map((s) => s.value));

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Fill only fields that are still empty in the form store. */
export function mergePrefill(
  current: ApplicationFormData,
  prefill: Partial<ApplicationFormData>,
): Partial<ApplicationFormData> {
  const patch: Partial<ApplicationFormData> = {};
  for (const key of Object.keys(prefill) as (keyof ApplicationFormData)[]) {
    const next = prefill[key];
    if (isEmpty(next)) continue;
    if (isEmpty(current[key])) {
      (patch as Record<string, unknown>)[key] = next;
    }
  }
  return patch;
}

function mapBusinessSectorToPrimarysectors(
  businesssector: string | null | undefined,
): { primarysectors?: string[]; primarysectorOther?: string } {
  if (!businesssector?.trim()) return {};
  const trimmed = businesssector.trim();
  if (SECTOR_VALUES.has(trimmed) && trimmed !== "Other") {
    return { primarysectors: [trimmed] };
  }
  return { primarysectors: ["Other"], primarysectorOther: trimmed };
}

export function mapProfileToApplicantAutofill(
  profile: Profile | null | undefined,
  email: string | undefined,
): Partial<ApplicationFormData> {
  if (!profile) {
    return email ? { emailAddress: email } : {};
  }

  const fullLegalName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    ...(fullLegalName ? { fullLegalName } : {}),
    ...(profile.businessName?.trim()
      ? { organizationName: profile.businessName.trim() }
      : {}),
    ...(profile.country?.trim()
      ? { countryOfResidence: profile.country.trim() }
      : {}),
    ...(profile.cityRegion?.trim()
      ? { cityRegion: profile.cityRegion.trim() }
      : {}),
    ...(email?.trim() ? { emailAddress: email.trim() } : {}),
    ...(profile.phoneNumber?.trim()
      ? { phoneNumber: profile.phoneNumber.trim() }
      : {}),
    ...(profile.bio?.trim()
      ? { coreMissionPurpose: profile.bio.trim() }
      : {}),
    ...mapBusinessSectorToPrimarysectors(profile.businesssector),
  };
}

function parsePrimarysectors(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function mapApplicationRowToAutofill(
  row: Record<string, unknown>,
): Partial<ApplicationFormData> {
  return {
    applicantType: (row.applicant_type as ApplicationFormData["applicantType"]) || undefined,
    fullLegalName: (row.full_legal_name as string) || undefined,
    organizationName: (row.organization_name as string) || undefined,
    registrationIdNumber: (row.registration_id_number as string) || undefined,
    countryOfResidence: (row.country_of_residence as string) || undefined,
    cityRegion: (row.city_region as string) || undefined,
    emailAddress: (row.contact_email as string) || undefined,
    phoneNumber: (row.contact_phone as string) || undefined,
    yearEstablished: (row.year_established as number) || undefined,
    coreMissionPurpose: (row.core_mission_purpose as string) || undefined,
    primarysectors: parsePrimarysectors(row.primary_sectors),
    primarysectorOther: (row.primary_sector_other as string) || undefined,
    numberOfTeamMembers: (row.team_size as number) || undefined,
    keyTeamMembersRoles: (row.key_team_members_roles as string) || undefined,
    previousGrantsFundingReceived:
      (row.previous_grants_funding_received as boolean) || undefined,
    previousGrantsFundingDetails:
      (row.previous_grants_funding_details as string) || undefined,
    linkedinUrl: (row.linkedin_url as string) || undefined,
    githubUrl: (row.github_url as string) || undefined,
    twitterUrl: (row.twitter_url as string) || undefined,
    websiteUrl: (row.website_url as string) || undefined,
    otherSocialLinks: (row.other_social_links as string) || undefined,
  };
}

/** Most recent submitted application (any opportunity) for repeat applicants. */
export async function fetchLatestSubmittedApplicationAutofill(
  userId: string,
): Promise<Partial<ApplicationFormData>> {
  const { data, error } = await supabase
    .from("applications")
    .select(
      "applicant_type, full_legal_name, organization_name, registration_id_number, country_of_residence, city_region, contact_email, contact_phone, year_established, core_mission_purpose, primary_sectors, primary_sector_other, team_size, key_team_members_roles, previous_grants_funding_received, previous_grants_funding_details, linkedin_url, github_url, twitter_url, website_url, other_social_links",
    )
    .eq("user_id", userId)
    .eq("is_draft", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return {};
  return mapApplicationRowToAutofill(data as Record<string, unknown>);
}

export async function buildApplicantAutofillPatch(
  userId: string,
  email: string | undefined,
  profile: Profile | null | undefined,
  current: ApplicationFormData,
): Promise<Partial<ApplicationFormData>> {
  const fromLatest = await fetchLatestSubmittedApplicationAutofill(userId);
  const fromProfile = mapProfileToApplicantAutofill(profile, email);
  const combined = { ...fromLatest, ...fromProfile };
  return mergePrefill(current, combined);
}
