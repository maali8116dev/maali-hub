export type PartnerOrgRole = "admin" | "member";

export type PartnerTeamMember = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  partner_role: PartnerOrgRole | null;
  email: string | null;
};

export function formatPartnerMemberName(member: Pick<PartnerTeamMember, "first_name" | "last_name" | "email" | "user_id">) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (member.email) return member.email;
  return `${member.user_id.slice(0, 8)}…`;
}
