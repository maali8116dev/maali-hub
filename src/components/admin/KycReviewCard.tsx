import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  useAdminKycForUser,
  useAdminUpdateKyc,
  useKycFileUpload,
} from "@/hooks/useKycVerification";
import { useAuth } from "@/hooks/useAuth";

interface KycReviewCardProps {
  userId: string;
  profileName?: string;
}

export const KycReviewCard = ({ userId, profileName }: KycReviewCardProps) => {
  const { t } = useTranslation(["dashboard", "common"]);
  const { user: currentAdmin } = useAuth();
  const { data: kyc, isLoading } = useAdminKycForUser(userId);
  const updateKyc = useAdminUpdateKyc();
  const { getSignedUrl } = useKycFileUpload();

  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [idDocUrl, setIdDocUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<{
    label: string;
    url: string;
  } | null>(null);

  const statusConfig = useMemo(() => ({
    pending: {
      label: t("admin.kycCard.status.pendingReview"),
      icon: <Clock className="h-3 w-3" />,
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    verified: {
      label: t("common:status.kyc.verified"),
      icon: <ShieldCheck className="h-3 w-3" />,
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    rejected: {
      label: t("common:status.kyc.rejected"),
      icon: <ShieldAlert className="h-3 w-3" />,
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
  }), [t]);

  const idTypeLabel = useMemo(
    () => (idType: string) =>
      t(`admin.kycCard.idTypes.${idType}`, { defaultValue: idType }),
    [t],
  );

  useEffect(() => {
    if (kyc?.id_document_url) {
      getSignedUrl(kyc.id_document_url).then(setIdDocUrl);
    }
    if (kyc?.selfie_url) {
      getSignedUrl(kyc.selfie_url).then(setSelfieUrl);
    }
    if (kyc?.admin_notes) setAdminNotes(kyc.admin_notes);
  }, [kyc, getSignedUrl]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!kyc) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t("admin.kycCard.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("admin.kycCard.notSubmitted")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const maskedIdNumber =
    kyc.id_number.length > 4
      ? "*".repeat(kyc.id_number.length - 4) + kyc.id_number.slice(-4)
      : kyc.id_number;

  const currentStatusConfig = statusConfig[kyc.status as keyof typeof statusConfig] || statusConfig.pending;

  const nameMismatch =
    profileName &&
    kyc.full_name_on_id &&
    profileName.toLowerCase().trim() !== kyc.full_name_on_id.toLowerCase().trim();

  const handleVerify = () => {
    if (!currentAdmin?.id) return;
    updateKyc.mutate({
      userId,
      status: "verified",
      admin_notes: adminNotes || undefined,
      verified_by: currentAdmin.id,
    });
  };

  const handleReject = () => {
    if (!currentAdmin?.id || !rejectionReason.trim()) return;
    updateKyc.mutate({
      userId,
      status: "rejected",
      admin_notes: adminNotes || undefined,
      rejection_reason: rejectionReason,
      verified_by: currentAdmin.id,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t("admin.kycCard.title")}
          </CardTitle>
          <Badge variant="outline" className={currentStatusConfig.className}>
            {currentStatusConfig.icon}
            <span className="ml-1">{currentStatusConfig.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t("admin.kycCard.fields.idType")}</span>
            <p className="font-medium">{idTypeLabel(kyc.id_type)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t("admin.kycCard.fields.idNumber")}</span>
            <p className="font-medium font-mono">{maskedIdNumber}</p>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">{t("admin.kycCard.fields.nameOnId")}</span>
            <div className="flex items-center gap-2">
              <p className="font-medium">{kyc.full_name_on_id}</p>
              {nameMismatch && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {t("admin.kycCard.fields.nameMismatch")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{t("admin.kycCard.fields.idDocument")}</Label>
              {idDocUrl && (
                <button
                  type="button"
                  onClick={() => setActivePreview({ label: t("admin.kycCard.fields.idDocument"), url: idDocUrl })}
                  className="text-xs text-primary hover:underline"
                >
                  {t("admin.kycCard.fields.viewFull")}
                </button>
              )}
            </div>
            {idDocUrl ? (
              <div className="group relative overflow-hidden rounded-lg border border-border bg-muted/40">
                <img
                  src={idDocUrl}
                  alt={t("admin.kycCard.fields.idDocument")}
                  className="h-96 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              </div>
            ) : (
              <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                {t("admin.kycCard.fields.noDocument")}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{t("admin.kycCard.fields.selfie")}</Label>
              {selfieUrl && (
                <button
                  type="button"
                  onClick={() => setActivePreview({ label: t("admin.kycCard.fields.selfie"), url: selfieUrl })}
                  className="text-xs text-primary hover:underline"
                >
                  {t("admin.kycCard.fields.viewFull")}
                </button>
              )}
            </div>
            {selfieUrl ? (
              <div className="group relative overflow-hidden rounded-lg border border-border bg-muted/40">
                <img
                  src={selfieUrl}
                  alt={t("admin.kycCard.fields.selfie")}
                  className="h-96 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              </div>
            ) : (
              <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                {t("admin.kycCard.fields.noSelfie")}
              </div>
            )}
          </div>
        </div>

        <Dialog open={!!activePreview} onOpenChange={(open) => !open && setActivePreview(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{activePreview?.label}</DialogTitle>
            </DialogHeader>
            {activePreview?.url && (
              <div className="w-full">
                <img
                  src={activePreview.url}
                  alt={activePreview.label}
                  className="w-full max-h-[70vh] object-contain rounded-md border border-border bg-muted/30"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {kyc.status === "pending" && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="space-y-2">
              <Label>{t("admin.kycCard.adminNotes")}</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={t("admin.kycCard.adminNotesPlaceholder")}
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("admin.kycCard.rejectionReason")}</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t("admin.kycCard.rejectionReasonPlaceholder")}
                className="min-h-[60px]"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleVerify}
                disabled={updateKyc.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {t("admin.kycCard.verify")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={updateKyc.isPending || !rejectionReason.trim()}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {t("admin.kycCard.reject")}
              </Button>
            </div>
          </div>
        )}

        {kyc.status !== "pending" && kyc.admin_notes && (
          <div className="border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">{t("admin.kycCard.previousAdminNotes")}</span>
            <p className="mt-1">{kyc.admin_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
