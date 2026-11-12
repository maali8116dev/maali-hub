import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, parseEdgeFunctionError } from "@/lib/invokeWithAuth";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PartnerInvite {
  id: string;
  partner_org_name: string;
}

const AcceptInvite = () => {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  // Captured once: Supabase rewrites the URL while it processes the magic link.
  const [searchParams] = useSearchParams();
  const [inviteToken] = useState(() => searchParams.get("invite_token"));

  const { data: invites, isLoading, refetch } = useQuery({
    queryKey: ["partner-invites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // partner_invites is not in the generated types yet.
      const { data, error } = await supabase
        .from("partner_invites" as any)
        .select("id, partner_org_name")
        .is("accepted_at", null)
        .is("declined_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PartnerInvite[];
    },
  });

  const respond = async (inviteId: string, action: "accept" | "decline") => {
    setBusy(true);
    const { error } = await invokeWithAuth("accept-partner-invite", {
      inviteId,
      action,
      inviteToken,
    });
    if (error) {
      setBusy(false);
      toast({
        title: t("partner.invitePage.error"),
        description: (await parseEdgeFunctionError(error)) ?? undefined,
        variant: "destructive",
      });
      return;
    }
    if (action === "accept") {
      // Full reload so role, profile and route guards pick up the partner account.
      window.location.assign("/partner");
      return;
    }
    setBusy(false);
    toast({ title: t("partner.invitePage.declined") });
    refetch();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-4">
        {isLoading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : !invites?.length ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("partner.invitePage.title")}</CardTitle>
              <CardDescription>{t("partner.invitePage.empty")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/dashboard">{t("partner.invitePage.goHome")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          invites.map((invite) => (
            <Card key={invite.id}>
              <CardHeader>
                <CardTitle>{t("partner.invitePage.title")}</CardTitle>
                <CardDescription>
                  {t("partner.invitePage.description", { org: invite.partner_org_name })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>{t("partner.invitePage.warning")}</AlertDescription>
                </Alert>
                {!inviteToken && (
                  <Alert variant="destructive">
                    <AlertDescription>{t("partner.invitePage.needLink")}</AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-2">
                  <Button
                    disabled={busy || !inviteToken}
                    onClick={() => respond(invite.id, "accept")}
                  >
                    {t("partner.invitePage.accept")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => respond(invite.id, "decline")}
                  >
                    {t("partner.invitePage.decline")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
