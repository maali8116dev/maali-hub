import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Users, Building2, FileText, Mail, Edit2 } from "lucide-react";
import type { ApplicationFormData } from "@/stores/applicationForm";
import { getProjectOverviewCopy } from "../constants";
import { applicantLocationLabel, resolveGeographicFocus } from "@/lib/applicationGeography";

interface Step6ReviewProps {
  formData: ApplicationFormData;
  selectedFiles: File[];
  selectedLibraryDocIds: string[];
  goToStep: (step: number) => void;
  isGrantType?: boolean;
}

export function Step6Review({
  formData,
  selectedFiles,
  selectedLibraryDocIds,
  goToStep,
  isGrantType = true,
}: Step6ReviewProps) {
  const { t } = useTranslation("dashboard");
  const d = "applications.detail";
  const f = "applications.form";
  const { sectionTitle, titleLabel, summaryLabel, locationLabel } = getProjectOverviewCopy(
    t,
    isGrantType,
  );
  const resolvedLocation = resolveGeographicFocus(formData, isGrantType);
  const showProjectGeography = isGrantType && !!formData.geographicFocus?.trim();
  const notProvided = t(`${f}.notProvided`);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t(`${f}.step6.title`)}</h3>
        <p className="text-sm text-muted-foreground mb-4">{t(`${f}.step6.description`)}</p>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t(`${d}.applicantInfo.title`)}
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => goToStep(1)}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <Edit2 className="h-3 w-3" />
            {t(`${f}.edit`)}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t(`${d}.applicantInfo.applicantType`)}:</span>
            <p className="font-medium">
              {formData.applicantType
                ? t(`${f}.options.applicantTypes.${formData.applicantType}`)
                : notProvided}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">{t(`${d}.applicantInfo.fullLegalName`)}:</span>
            <p className="font-medium">{formData.fullLegalName || notProvided}</p>
          </div>
          {formData.organizationName && (
            <div>
              <span className="text-muted-foreground">
                {t(`${d}.applicantInfo.organizationName`)}:
              </span>
              <p className="font-medium">{formData.organizationName}</p>
            </div>
          )}
          {formData.registrationIdNumber && (
            <div>
              <span className="text-muted-foreground">{t(`${f}.step6.registrationId`)}</span>
              <p className="font-medium">{formData.registrationIdNumber}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">
              {t(`${d}.applicantInfo.countryOfResidence`)}:
            </span>
            <p className="font-medium">{formData.countryOfResidence || notProvided}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t(`${d}.applicantInfo.cityRegion`)}:</span>
            <p className="font-medium">{formData.cityRegion || notProvided}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t(`${d}.applicantInfo.contactEmail`)}:</span>
            <p className="font-medium">{formData.emailAddress || notProvided}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t(`${d}.applicantInfo.contactPhone`)}:</span>
            <p className="font-medium">{formData.phoneNumber || notProvided}</p>
          </div>
        </div>
      </div>

      {formData.applicantType && formData.applicantType !== "Individual" && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {t(`${d}.organizationalBackground.title`)}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goToStep(2)}
              className="flex items-center gap-1 text-muted-foreground hover:text-primary"
            >
              <Edit2 className="h-3 w-3" />
              {t(`${f}.edit`)}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {formData.yearEstablished && (
              <div>
                <span className="text-muted-foreground">
                  {t(`${d}.organizationalBackground.yearEstablished`)}:
                </span>
                <p className="font-medium">{formData.yearEstablished}</p>
              </div>
            )}
            {formData.numberOfTeamMembers && (
              <div>
                <span className="text-muted-foreground">
                  {t(`${d}.organizationalBackground.teamSize`)}:
                </span>
                <p className="font-medium">{formData.numberOfTeamMembers}</p>
              </div>
            )}
            {formData.coreMissionPurpose && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">
                  {t(`${d}.organizationalBackground.coreMission`)}:
                </span>
                <p className="font-medium mt-1 whitespace-pre-wrap">{formData.coreMissionPurpose}</p>
              </div>
            )}
            {formData.primarysectors && formData.primarysectors.length > 0 && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">
                  {t(`${d}.organizationalBackground.primarySectors`)}:
                </span>
                <p className="font-medium mt-1">
                  {formData.primarysectors
                    .map((s) => t(`${f}.options.sectors.${s}`, { defaultValue: s }))
                    .join(", ")}
                  {formData.primarysectorOther && ` (${formData.primarysectorOther})`}
                </p>
              </div>
            )}
            {formData.keyTeamMembersRoles && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">
                  {t(`${d}.organizationalBackground.keyTeamMembers`)}:
                </span>
                <p className="font-medium mt-1 whitespace-pre-wrap">
                  {formData.keyTeamMembersRoles}
                </p>
              </div>
            )}
            {isGrantType && formData.previousGrantsFundingReceived && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">
                  {t(`${f}.step6.previousGrantsFunding`)}
                </span>
                <p className="font-medium mt-1 whitespace-pre-wrap">
                  {formData.previousGrantsFundingDetails || t(`${f}.yes`)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {sectionTitle}
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => goToStep(3)}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <Edit2 className="h-3 w-3" />
            {t(`${f}.edit`)}
          </Button>
        </div>
        <div className="space-y-4 text-sm">
          <div>
            <span className="text-muted-foreground">{titleLabel}:</span>
            <p className="font-medium">{formData.projectTitle || notProvided}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{summaryLabel}:</span>
            <p className="font-medium mt-1 whitespace-pre-wrap">
              {formData.projectSummary || notProvided}
            </p>
          </div>
          {showProjectGeography ? (
            <div>
              <span className="text-muted-foreground">{locationLabel}:</span>
              <p className="font-medium">{formData.geographicFocus}</p>
            </div>
          ) : (
            <div>
              <span className="text-muted-foreground">{t(`${f}.location`)}:</span>
              <p className="font-medium">
                {resolvedLocation || applicantLocationLabel(formData) || notProvided}
              </p>
            </div>
          )}
        </div>
      </div>

      {(formData.linkedinUrl ||
        formData.githubUrl ||
        formData.twitterUrl ||
        formData.websiteUrl ||
        formData.otherSocialLinks) && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              {t(`${d}.socialLinks.title`)}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goToStep(4)}
              className="flex items-center gap-1 text-muted-foreground hover:text-primary"
            >
              <Edit2 className="h-3 w-3" />
              {t(`${f}.edit`)}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {formData.linkedinUrl && (
              <div>
                <span className="text-muted-foreground">{t(`${f}.step6.linkedin`)}</span>
                <p className="font-medium break-all">
                  <a
                    href={formData.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {formData.linkedinUrl}
                  </a>
                </p>
              </div>
            )}
            {formData.githubUrl && (
              <div>
                <span className="text-muted-foreground">{t(`${f}.step6.github`)}</span>
                <p className="font-medium break-all">
                  <a
                    href={formData.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {formData.githubUrl}
                  </a>
                </p>
              </div>
            )}
            {formData.twitterUrl && (
              <div>
                <span className="text-muted-foreground">{t(`${f}.step6.twitter`)}</span>
                <p className="font-medium break-all">
                  <a
                    href={formData.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {formData.twitterUrl}
                  </a>
                </p>
              </div>
            )}
            {formData.websiteUrl && (
              <div>
                <span className="text-muted-foreground">{t(`${f}.step6.website`)}</span>
                <p className="font-medium break-all">
                  <a
                    href={formData.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {formData.websiteUrl}
                  </a>
                </p>
              </div>
            )}
            {formData.otherSocialLinks && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">
                  {t(`${d}.socialLinks.otherSocialLinks`)}:
                </span>
                <p className="font-medium mt-1 whitespace-pre-wrap">
                  {formData.otherSocialLinks}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {t(`${d}.documents.title`)}
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => goToStep(5)}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <Edit2 className="h-3 w-3" />
            {t(`${f}.edit`)}
          </Button>
        </div>
        <div className="space-y-2 text-sm">
          {selectedLibraryDocIds.length > 0 && (
            <div>
              <span className="text-muted-foreground">{t(`${f}.step6.fromLibrary`)} </span>
              <span className="font-medium">
                {t(`${f}.step6.documentCount`, { count: selectedLibraryDocIds.length })}
              </span>
            </div>
          )}
          {selectedFiles.length > 0 && (
            <div>
              <span className="text-muted-foreground">{t(`${f}.step6.newUploads`)} </span>
              <span className="font-medium">
                {t(`${f}.step6.documentCount`, { count: selectedFiles.length })}
              </span>
            </div>
          )}
          {selectedLibraryDocIds.length === 0 && selectedFiles.length === 0 && (
            <p className="text-sm text-muted-foreground">{t(`${f}.step6.noDocuments`)}</p>
          )}
          {(selectedLibraryDocIds.length > 0 || selectedFiles.length > 0) && (
            <p className="text-xs text-muted-foreground italic mt-2">
              {t(`${f}.step6.documentsOnSubmit`)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
