import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  type KycStatus,
} from "@/hooks/useKycVerification";
import { useAuth } from "@/hooks/useAuth";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending: {
    label: "Pending Review",
    icon: <Clock className="h-3 w-3" />,
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  verified: {
    label: "Verified",
    icon: <ShieldCheck className="h-3 w-3" />,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    icon: <ShieldAlert className="h-3 w-3" />,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const ID_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  national_id: "National ID",
  drivers_license: "Driver's License",
  business_registration: "Business Registration",
};

interface KycReviewCardProps {
  userId: string;
  profileName?: string;
}

export const KycReviewCard = ({ userId, profileName }: KycReviewCardProps) => {
  const { user: currentAdmin } = useAuth();
  const { data: kyc, isLoading } = useAdminKycForUser(userId);
  const updateKyc = useAdminUpdateKyc();
  const { getSignedUrl } = useKycFileUpload();

  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [idDocUrl, setIdDocUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  useEffect(() => {
    if (kyc?.id_document_url) {
      getSignedUrl(kyc.id_document_url).then(setIdDocUrl);
    }
    if (kyc?.selfie_url) {
      getSignedUrl(kyc.selfie_url).then(setSelfieUrl);
    }
    if (kyc?.admin_notes) setAdminNotes(kyc.admin_notes);
  }, [kyc]);

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
            KYC Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This user has not submitted identity verification.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maskedIdNumber =
    kyc.id_number.length > 4
      ? "•".repeat(kyc.id_number.length - 4) + kyc.id_number.slice(-4)
      : kyc.id_number;

  const statusConfig = STATUS_CONFIG[kyc.status] || STATUS_CONFIG.pending;

  // Name mismatch detection
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
            KYC Verification
          </CardTitle>
          <Badge variant="outline" className={statusConfig.className}>
            {statusConfig.icon}
            <span className="ml-1">{statusConfig.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ID Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">ID Type</span>
            <p className="font-medium">{ID_TYPE_LABELS[kyc.id_type] || kyc.id_type}</p>
          </div>
          <div>
            <span className="text-muted-foreground">ID Number</span>
            <p className="font-medium font-mono">{maskedIdNumber}</p>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Name on ID</span>
            <div className="flex items-center gap-2">
              <p className="font-medium">{kyc.full_name_on_id}</p>
              {nameMismatch && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Name differs from profile
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Side-by-side images */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ID Document</Label>
            {idDocUrl ? (
              <img
                src={idDocUrl}
                alt="ID Document"
                className="w-full h-48 object-cover rounded-lg border border-border"
              />
            ) : (
              <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                No document
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Selfie</Label>
            {selfieUrl ? (
              <img
                src={selfieUrl}
                alt="Selfie"
                className="w-full h-48 object-cover rounded-lg border border-border"
              />
            ) : (
              <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                No selfie
              </div>
            )}
          </div>
        </div>

        {/* Admin actions */}
        {kyc.status === "pending" && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="space-y-2">
              <Label>Admin Notes (optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes about this verification..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Rejection Reason (required to reject)</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the verification is being rejected..."
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
                Verify
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={updateKyc.isPending || !rejectionReason.trim()}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        )}

        {/* Show previous admin notes for non-pending */}
        {kyc.status !== "pending" && kyc.admin_notes && (
          <div className="border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Admin Notes:</span>
            <p className="mt-1">{kyc.admin_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
