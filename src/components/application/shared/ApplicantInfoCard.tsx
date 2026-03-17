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

const ApplicantInfoCard = ({ application }: ApplicantInfoCardProps) => (
  <Card>
    <CardHeader className="p-4 sm:p-6">
      <CardTitle className="text-base sm:text-lg">Applicant Information</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {application.applicant_type && (
          <InfoField icon={User} label="Applicant Type" value={application.applicant_type} />
        )}
        {application.full_legal_name && (
          <InfoField icon={User} label="Full Legal Name" value={application.full_legal_name} breakWords />
        )}
        {application.organization_name && (
          <InfoField icon={Building2} label="Organization Name" value={application.organization_name} breakWords />
        )}
        {application.registration_id_number && (
          <InfoField icon={FileText} label="Registration ID Number" value={application.registration_id_number} breakWords />
        )}
        <InfoField icon={Mail} label="Contact Email" value={application.contact_email || "N/A"} breakAll />
        <InfoField icon={Phone} label="Contact Phone" value={application.contact_phone || "N/A"} />
        {application.country_of_residence && (
          <InfoField icon={MapPin} label="Country of Residence" value={application.country_of_residence} />
        )}
        {application.city_region && (
          <InfoField icon={MapPin} label="City/Region" value={application.city_region} />
        )}
      </div>
    </CardContent>
  </Card>
);

export default ApplicantInfoCard;









