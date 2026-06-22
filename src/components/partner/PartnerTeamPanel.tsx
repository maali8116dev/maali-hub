import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form } from "@/components/ui/form";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Mail, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  usePartnerTeam,
  useInvitePartnerTeamMember,
  useUpdatePartnerTeamMemberRole,
  useRemovePartnerTeamMember,
} from "@/hooks/usePartnerTeam";
import { formatPartnerMemberName, type PartnerOrgRole } from "@/lib/partnerTeam";

type PartnerTeamPanelProps = {
  partnerOrgId: number;
  partnerOrgName: string;
  canManage: boolean;
};

export function PartnerTeamPanel({ partnerOrgId, partnerOrgName, canManage }: PartnerTeamPanelProps) {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: members = [], isLoading } = usePartnerTeam(partnerOrgId);
  const inviteMember = useInvitePartnerTeamMember(partnerOrgId);
  const updateRole = useUpdatePartnerTeamMemberRole(partnerOrgId);
  const removeMember = useRemovePartnerTeamMember(partnerOrgId);

  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const inviteSchema = z.object({
    email: z.string().email(t("partner.teamPage.invalidEmail")),
    role: z.enum(["admin", "member"]),
  });
  type InviteValues = z.infer<typeof inviteSchema>;

  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "member" },
  });

  const handleInvite = async (values: InviteValues) => {
    try {
      await inviteMember.mutateAsync({ email: values.email, partnerRole: values.role });
      toast({
        title: t("partner.teamPage.inviteSuccess"),
        description: t("partner.teamPage.inviteSuccessDescription", { email: values.email }),
      });
      inviteForm.reset({ email: "", role: "member" });
    } catch (e) {
      toast({
        title: t("partner.teamPage.inviteError"),
        description: e instanceof Error ? e.message : t("partner.teamPage.inviteError"),
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async (userId: string, role: PartnerOrgRole) => {
    try {
      await updateRole.mutateAsync({ userId, role });
      toast({ title: t("partner.teamPage.roleUpdated") });
    } catch (e) {
      toast({
        title: t("partner.teamPage.roleUpdateError"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeMember.mutateAsync(removeTarget);
      toast({ title: t("partner.teamPage.memberRemoved") });
      setRemoveTarget(null);
    } catch (e) {
      toast({
        title: t("partner.teamPage.removeError"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("partner.teamPage.title")}</CardTitle>
          <CardDescription>
            {t("partner.teamPage.description", { name: partnerOrgName })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {canManage && (
            <Form {...inviteForm}>
              <form
                onSubmit={inviteForm.handleSubmit(handleInvite)}
                className="rounded-lg border p-4 space-y-4"
              >
                <CustomFormField
                  control={inviteForm.control}
                  name="email"
                  fieldType={FormFieldType.EMAIL}
                  label={t("partner.teamPage.inviteEmail")}
                  placeholder={t("partner.teamPage.inviteEmailPlaceholder")}
                />
                <CustomFormField
                  control={inviteForm.control}
                  name="role"
                  fieldType={FormFieldType.SELECT}
                  label={t("partner.teamPage.inviteRole")}
                  options={[
                    { value: "admin", label: t("partner.teamPage.roles.admin") },
                    { value: "member", label: t("partner.teamPage.roles.member") },
                  ]}
                />
                <Button type="submit" disabled={inviteMember.isPending}>
                  {inviteMember.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  {t("partner.teamPage.sendInvite")}
                </Button>
              </form>
            </Form>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("partner.teamPage.loading")}</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("partner.teamPage.empty")}</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const isSelf = member.user_id === user?.id;
                const role = member.partner_role ?? "member";
                return (
                  <div
                    key={member.user_id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium truncate">
                        {formatPartnerMemberName(member)}
                        {isSelf ? (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            ({t("partner.teamPage.you")})
                          </span>
                        ) : null}
                      </p>
                      {member.email ? (
                        <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {canManage && !isSelf ? (
                        <Select
                          value={role}
                          onValueChange={(v) => handleRoleChange(member.user_id, v as PartnerOrgRole)}
                          disabled={updateRole.isPending}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t("partner.teamPage.roles.admin")}</SelectItem>
                            <SelectItem value="member">{t("partner.teamPage.roles.member")}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">
                          {role === "admin"
                            ? t("partner.teamPage.roles.admin")
                            : t("partner.teamPage.roles.member")}
                        </Badge>
                      )}
                      {canManage && !isSelf ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setRemoveTarget(member.user_id)}
                          disabled={removeMember.isPending}
                        >
                          <UserMinus className="h-4 w-4 mr-1" />
                          {t("partner.teamPage.remove")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("partner.teamPage.removeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("partner.teamPage.removeConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("partner.teamPage.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>{t("partner.teamPage.remove")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
