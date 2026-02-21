import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  FileText,
  Mail,
  Edit2,
} from "lucide-react";
import type { ApplicationFormData } from "@/stores/applicationForm";

interface Step6ReviewProps {
  formData: ApplicationFormData;
  selectedFiles: File[];
  selectedLibraryDocIds: string[];
  goToStep: (step: number) => void;
}

export function Step6Review({
  formData,
  selectedFiles,
  selectedLibraryDocIds,
  goToStep,
}: Step6ReviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Review Your Application</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Please review all the information below before proceeding.
        </p>
      </div>

      {/* Applicant Information Review */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Applicant Information
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => goToStep(1)}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Applicant Type:</span>
            <p className="font-medium">
              {formData.applicantType || "Not provided"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Full Legal Name:</span>
            <p className="font-medium">
              {formData.fullLegalName || "Not provided"}
            </p>
          </div>
          {formData.organizationName && (
            <div>
              <span className="text-muted-foreground">Organization Name:</span>
              <p className="font-medium">{formData.organizationName}</p>
            </div>
          )}
          {formData.registrationIdNumber && (
            <div>
              <span className="text-muted-foreground">
                Registration / ID Number:
              </span>
              <p className="font-medium">{formData.registrationIdNumber}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Country of Residence:</span>
            <p className="font-medium">
              {formData.countryOfResidence || "Not provided"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">City / Region:</span>
            <p className="font-medium">
              {formData.cityRegion || "Not provided"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Email Address:</span>
            <p className="font-medium">
              {formData.emailAddress || "Not provided"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Phone Number:</span>
            <p className="font-medium">
              {formData.phoneNumber || "Not provided"}
            </p>
          </div>
        </div>
      </div>

      {/* Organizational Background Review */}
      {formData.applicantType && formData.applicantType !== "Individual" && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Organizational Background
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goToStep(2)}
              className="flex items-center gap-1 text-muted-foreground hover:text-primary"
            >
              <Edit2 className="h-3 w-3" />
              Edit
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {formData.yearEstablished && (
              <div>
                <span className="text-muted-foreground">Year Established:</span>
                <p className="font-medium">{formData.yearEstablished}</p>
              </div>
            )}
            {formData.numberOfTeamMembers && (
              <div>
                <span className="text-muted-foreground">
                  Number of Team Members:
                </span>
                <p className="font-medium">{formData.numberOfTeamMembers}</p>
              </div>
            )}
            {formData.coreMissionPurpose && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">
                  Core Mission / Purpose:
                </span>
                <p className="font-medium mt-1 whitespace-pre-wrap">
                  {formData.coreMissionPurpose}
                </p>
              </div>
            )}
            {formData.primarySectors && formData.primarySectors.length > 0 && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">Primary Sector(s):</span>
                <p className="font-medium mt-1">
                  {formData.primarySectors.join(", ")}
                  {formData.primarySectorOther &&
                    ` (${formData.primarySectorOther})`}
                </p>
              </div>
            )}
            {formData.keyTeamMembersRoles && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">
                  Key Team Members & Roles:
                </span>
                <p className="font-medium mt-1 whitespace-pre-wrap">
                  {formData.keyTeamMembersRoles}
                </p>
              </div>
            )}
            {formData.previousGrantsFundingReceived && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">
                  Previous Grants / Funding:
                </span>
                <p className="font-medium mt-1 whitespace-pre-wrap">
                  {formData.previousGrantsFundingDetails || "Yes"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project Overview Review */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Project Overview
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => goToStep(3)}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </Button>
        </div>
        <div className="space-y-4 text-sm">
          <div>
            <span className="text-muted-foreground">Project Title:</span>
            <p className="font-medium">
              {formData.projectTitle || "Not provided"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Project Summary:</span>
            <p className="font-medium mt-1 whitespace-pre-wrap">
              {formData.projectSummary || "Not provided"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Geographic Focus:</span>
            <p className="font-medium">
              {formData.geographicFocus || "Not provided"}
            </p>
          </div>
        </div>
      </div>

      {/* Social Links Review */}
      {(formData.linkedinUrl ||
        formData.githubUrl ||
        formData.twitterUrl ||
        formData.websiteUrl ||
        formData.otherSocialLinks) && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Social Links
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goToStep(4)}
              className="flex items-center gap-1 text-muted-foreground hover:text-primary"
            >
              <Edit2 className="h-3 w-3" />
              Edit
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {formData.linkedinUrl && (
              <div>
                <span className="text-muted-foreground">LinkedIn:</span>
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
                <span className="text-muted-foreground">GitHub:</span>
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
                <span className="text-muted-foreground">Twitter/X:</span>
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
                <span className="text-muted-foreground">Website:</span>
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
                <span className="text-muted-foreground">Other Social Links:</span>
                <p className="font-medium mt-1 whitespace-pre-wrap">
                  {formData.otherSocialLinks}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents Review */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Documents
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => goToStep(5)}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </Button>
        </div>
        <div className="space-y-2 text-sm">
          {selectedLibraryDocIds.length > 0 && (
            <div>
              <span className="text-muted-foreground">From Library: </span>
              <span className="font-medium">
                {selectedLibraryDocIds.length} document(s)
              </span>
            </div>
          )}
          {selectedFiles.length > 0 && (
            <div>
              <span className="text-muted-foreground">New Uploads: </span>
              <span className="font-medium">
                {selectedFiles.length} document(s)
              </span>
            </div>
          )}
          {selectedLibraryDocIds.length === 0 && selectedFiles.length === 0 && (
            <p className="text-sm text-muted-foreground">No documents selected</p>
          )}
          {(selectedLibraryDocIds.length > 0 || selectedFiles.length > 0) && (
            <p className="text-xs text-muted-foreground italic mt-2">
              Documents will be linked/uploaded when you submit your application
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

