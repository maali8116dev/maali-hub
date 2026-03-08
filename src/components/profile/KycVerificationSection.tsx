import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Upload,
  Camera,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  useKycVerification,
  useSubmitKyc,
  useKycFileUpload,
  validateIdNumber,
  getIdNumberHint,
  type KycIdType,
} from "@/hooks/useKycVerification";
import { useProfile } from "@/hooks/useProfile";

const ID_TYPE_OPTIONS = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "business_registration", label: "Business Registration" },
];

const KycStatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "verified":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10">
          <ShieldCheck className="h-3 w-3 mr-1" /> Verified
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Clock className="h-3 w-3 mr-1" /> Pending Review
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive">
          <ShieldAlert className="h-3 w-3 mr-1" /> Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Not Started
        </Badge>
      );
  }
};

interface ImageUploadFieldProps {
  label: string;
  description: string;
  value: string | null;
  previewUrl: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  isUploading: boolean;
  disabled?: boolean;
}

const ImageUploadField = ({
  label,
  description,
  value,
  previewUrl,
  onUpload,
  onRemove,
  isUploading,
  disabled,
}: ImageUploadFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
        disabled={disabled}
      />
      {previewUrl ? (
        <div className="relative w-48 h-36 rounded-lg overflow-hidden border border-border">
          <img src={previewUrl} alt={label} className="w-full h-full object-cover" />
          {!disabled && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:opacity-80"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading || disabled}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : label.toLowerCase().includes("selfie") ? (
            <Camera className="h-4 w-4 mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {isUploading ? "Uploading..." : `Upload ${label}`}
        </Button>
      )}
    </div>
  );
};

export const KycVerificationSection = () => {
  const { data: kyc, isLoading } = useKycVerification();
  const { data: profile } = useProfile();
  const submitKyc = useSubmitKyc();
  const { upload, getSignedUrl, isUploading } = useKycFileUpload();

  const [idType, setIdType] = useState<KycIdType>("passport");
  const [idNumber, setIdNumber] = useState("");
  const [fullNameOnId, setFullNameOnId] = useState("");
  const [idDocPath, setIdDocPath] = useState<string | null>(null);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);
  const [idDocPreview, setIdDocPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [idNumberError, setIdNumberError] = useState<string | null>(null);

  // Pre-fill from existing KYC or profile
  useEffect(() => {
    if (kyc) {
      setIdType(kyc.id_type);
      setIdNumber(kyc.id_number);
      setFullNameOnId(kyc.full_name_on_id);
      setIdDocPath(kyc.id_document_url);
      setSelfiePath(kyc.selfie_url);
    } else if (profile) {
      const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
      if (name) setFullNameOnId(name);
    }
  }, [kyc, profile]);

  // Load signed URLs for previews
  useEffect(() => {
    if (idDocPath) {
      getSignedUrl(idDocPath).then(setIdDocPreview);
    }
    if (selfiePath) {
      getSignedUrl(selfiePath).then(setSelfiePreview);
    }
  }, [idDocPath, selfiePath]);

  const handleIdUpload = async (file: File) => {
    const path = await upload(file, "id");
    if (path) {
      setIdDocPath(path);
      const url = await getSignedUrl(path);
      setIdDocPreview(url);
    }
  };

  const handleSelfieUpload = async (file: File) => {
    const path = await upload(file, "selfie");
    if (path) {
      setSelfiePath(path);
      const url = await getSignedUrl(path);
      setSelfiePreview(url);
    }
  };

  const handleSubmit = () => {
    const error = validateIdNumber(idType, idNumber);
    if (error) {
      setIdNumberError(error);
      return;
    }
    if (!idDocPath) {
      setIdNumberError("Please upload your ID document");
      return;
    }
    if (!selfiePath) {
      setIdNumberError("Please upload a selfie");
      return;
    }
    setIdNumberError(null);

    submitKyc.mutate({
      id_type: idType,
      id_number: idNumber.trim(),
      full_name_on_id: fullNameOnId.trim(),
      id_document_url: idDocPath,
      selfie_url: selfiePath,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center min-h-[100px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isReadOnly = kyc?.status === "pending" || kyc?.status === "verified";
  const canEdit = !kyc || kyc.status === "rejected";

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Identity Verification (KYC)
          </CardTitle>
          <KycStatusBadge status={kyc?.status || "not_started"} />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
        {kyc?.status === "verified" && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 text-sm">
            <p className="text-emerald-700 dark:text-emerald-400 font-medium">
              Your identity has been verified
            </p>
            {kyc.verified_at && (
              <p className="text-muted-foreground text-xs mt-1">
                Verified on {new Date(kyc.verified_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {kyc?.status === "rejected" && kyc.rejection_reason && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <p className="text-destructive font-medium">Verification Rejected</p>
                <p className="text-muted-foreground mt-1">{kyc.rejection_reason}</p>
                <p className="text-muted-foreground text-xs mt-2">
                  Please update your information and resubmit.
                </p>
              </div>
            </div>
          </div>
        )}

        {kyc?.status === "pending" && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-sm">
            <p className="text-amber-700 dark:text-amber-400 font-medium">
              Your verification is under review
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              This usually takes 1-3 business days.
            </p>
          </div>
        )}

        {!kyc && (
          <p className="text-sm text-muted-foreground">
            Complete identity verification to apply for opportunities. This is done once and reused across all applications.
          </p>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>ID Type</Label>
            <Select
              value={idType}
              onValueChange={(v) => setIdType(v as KycIdType)}
              disabled={isReadOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ID_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ID Number</Label>
            <Input
              value={idNumber}
              onChange={(e) => {
                setIdNumber(e.target.value);
                setIdNumberError(null);
              }}
              placeholder={getIdNumberHint(idType)}
              disabled={isReadOnly}
            />
            {idNumberError && (
              <p className="text-xs text-destructive">{idNumberError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Full Name as on ID</Label>
            <Input
              value={fullNameOnId}
              onChange={(e) => setFullNameOnId(e.target.value)}
              placeholder="Enter name exactly as shown on your ID"
              disabled={isReadOnly}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUploadField
              label="ID Document"
              description="Upload a clear photo of your ID (JPG/PNG, max 5MB)"
              value={idDocPath}
              previewUrl={idDocPreview}
              onUpload={handleIdUpload}
              onRemove={() => {
                setIdDocPath(null);
                setIdDocPreview(null);
              }}
              isUploading={isUploading}
              disabled={isReadOnly}
            />

            <ImageUploadField
              label="Selfie Photo"
              description="Take a clear photo of your face, similar to your ID photo"
              value={selfiePath}
              previewUrl={selfiePreview}
              onUpload={handleSelfieUpload}
              onRemove={() => {
                setSelfiePath(null);
                setSelfiePreview(null);
              }}
              isUploading={isUploading}
              disabled={isReadOnly}
            />
          </div>

          {canEdit && (
            <Button
              onClick={handleSubmit}
              disabled={submitKyc.isPending || isUploading || !idNumber || !fullNameOnId}
              className="w-full sm:w-auto"
            >
              {submitKyc.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : kyc?.status === "rejected" ? (
                "Resubmit Verification"
              ) : (
                "Submit for Verification"
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
