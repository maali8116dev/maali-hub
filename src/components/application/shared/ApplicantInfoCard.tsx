import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User,
  Building2,
  FileText,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import InfoField from "./InfoField";

interface ApplicantInfoCardProps {
  application: Record<string, any>;
}

const ApplicantInfoCard = ({ application }: ApplicantInfoCardProps) => {
  const { t } = useTranslation("dashboard");

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg">{t("applications.detail.applicantInfo.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {application.applicant_type && (
            <InfoField icon={User} label={t("applications.detail.applicantInfo.applicantType")} value={application.applicant_type} />
          )}
          {application.full_legal_name && (
            <InfoField icon={User} label={t("applications.detail.applicantInfo.fullLegalName")} value={application.full_legal_name} breakWords />
          )}
          {application.organization_name && (
            <InfoField icon={Building2} label={t("applications.detail.applicantInfo.organizationName")} value={application.organization_name} breakWords />
          )}
          {application.registration_id_number && (
            <InfoField icon={FileText} label={t("applications.detail.applicantInfo.registrationId")} value={application.registration_id_number} breakWords />
          )}
          <InfoField icon={Mail} label={t("applications.detail.applicantInfo.contactEmail")} value={application.contact_email || t("applications.detail.values.na")} breakAll />
          <InfoField icon={Phone} label={t("applications.detail.applicantInfo.contactPhone")} value={application.contact_phone || t("applications.detail.values.na")} />
          {application.country_of_residence && (
            <InfoField icon={MapPin} label={t("applications.detail.applicantInfo.countryOfResidence")} value={application.country_of_residence} />
          )}
          {application.city_region && (
            <InfoField icon={MapPin} label={t("applications.detail.applicantInfo.cityRegion")} value={application.city_region} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApplicantInfoCard;
