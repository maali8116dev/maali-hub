import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ApplicationFormData } from "@/stores/applicationForm";

interface UseAutoSaveDraftOptions {
  formData: ApplicationFormData;
  onSaved: () => void;
}

interface AutoSaveState {
  isSaving: boolean;
  lastSavedAt: Date | null;
  draftId: string | null;
  error: string | null;
}

export const useAutoSaveDraft = ({
  formData,
  onSaved,
}: UseAutoSaveDraftOptions) => {
  const { toast } = useToast();
  const [state, setState] = useState<AutoSaveState>({
    isSaving: false,
    lastSavedAt: null,
    draftId: null,
    error: null,
  });

  const saveDraft = useCallback(async () => {
    // Don't save if no project is selected or no meaningful data
    if (!formData.projectId) {
      toast({
        title: "Cannot save draft",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, isSaving: true, error: null }));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({ ...prev, isSaving: false }));
        return;
      }

      // Guard: Check if draftId exists but the record was already converted to submission
      // This prevents auto-save from trying to save after submission
      if (state.draftId) {
        const { data: existingApp } = await supabase
          .from("applications")
          .select("is_draft")
          .eq("id", state.draftId)
          .maybeSingle();
        
        if (existingApp && !existingApp.is_draft) {
          // Draft was converted to submission, clear state and don't try to save
          setState(prev => ({ ...prev, draftId: null, isSaving: false }));
          return;
        }
      }

      const draftData = {
        user_id: user.id,
        project_id: formData.projectId,
        applicant_type: formData.applicantType || null,
        full_legal_name: formData.fullLegalName || null,
        organization_name: formData.organizationName || null,
        registration_id_number: formData.registrationIdNumber || null,
        country_of_residence: formData.countryOfResidence || null,
        city_region: formData.cityRegion || null,
        contact_email: formData.emailAddress || null,
        contact_phone: formData.phoneNumber || null,
        year_established: formData.yearEstablished || null,
        core_mission_purpose: formData.coreMissionPurpose || null,
        primary_sectors: formData.primarySectors?.length
          ? JSON.stringify(formData.primarySectors)
          : null,
        primary_sector_other: formData.primarySectorOther || null,
        team_size: formData.numberOfTeamMembers || null,
        key_team_members_roles: formData.keyTeamMembersRoles || null,
        previous_grants_funding_received: formData.previousGrantsFundingReceived || false,
        previous_grants_funding_details: formData.previousGrantsFundingDetails || null,
        project_title: formData.projectTitle || null,
        project_summary: formData.projectSummary || null,
        geographic_focus: formData.geographicFocus || null,
        linkedin_url: formData.linkedinUrl || null,
        github_url: formData.githubUrl || null,
        twitter_url: formData.twitterUrl || null,
        website_url: formData.websiteUrl || null,
        other_social_links: formData.otherSocialLinks || null,
        information_accurate_confirmed: formData.informationAccurateConfirmed || false,
        conflict_of_interest_declared: formData.conflictOfInterestDeclared || false,
        reporting_requirements_agreed: formData.reportingRequirementsAgreed || false,
        data_processing_consented: formData.dataProcessingConsented || false,
        declaration_date: formData.declarationDate
          ? new Date(formData.declarationDate).toISOString()
          : null,
        application_fee_paid: formData.paymentCompleted || false,
        stripe_payment_intent_id: formData.paymentIntentId || null,
        status: "draft",
        is_draft: true,
      };

      let result;
      
      if (state.draftId) {
        // Update existing draft
        result = await supabase
          .from("applications")
          .update(draftData)
          .eq("id", state.draftId)
          .eq("is_draft", true)
          .select()
          .single();
      } else {
        // Check for existing draft for this project
        const { data: existingDraft } = await supabase
          .from("applications")
          .select("id")
          .eq("user_id", user.id)
          .eq("project_id", formData.projectId)
          .eq("is_draft", true)
          .maybeSingle();

        if (existingDraft) {
          // Update existing draft
          result = await supabase
            .from("applications")
            .update(draftData)
            .eq("id", existingDraft.id)
            .select()
            .single();
          
          setState(prev => ({ ...prev, draftId: existingDraft.id }));
        } else {
          // Create new draft
          result = await supabase
            .from("applications")
            .insert(draftData)
            .select()
            .single();
        }
      }

      if (result.error) throw result.error;

      const now = new Date();
      setState(prev => ({
        ...prev,
        isSaving: false,
        lastSavedAt: now,
        draftId: result.data?.id || prev.draftId,
      }));
      
      onSaved();
      
      toast({
        title: "Draft saved",
        description: "Your application draft has been saved",
      });
      
    } catch (error) {
      console.error("Save draft error:", error);
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: "Failed to save draft",
      }));
      toast({
        title: "Failed to save",
        description: "Could not save your draft. Please try again.",
        variant: "destructive",
      });
    }
  }, [formData, state.draftId, onSaved, toast]);

  // Load existing draft on mount
  const loadExistingDraft = useCallback(async (): Promise<Partial<ApplicationFormData> | null> => {
    if (!formData.projectId) return null;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: existingDraft } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .eq("project_id", formData.projectId)
        .eq("is_draft", true)
        .maybeSingle();

      if (existingDraft) {
        let parsedPrimarySectors: string[] | undefined = undefined;
        if (Array.isArray(existingDraft.primary_sectors)) {
          parsedPrimarySectors = existingDraft.primary_sectors;
        } else if (typeof existingDraft.primary_sectors === "string") {
          try {
            const parsed = JSON.parse(existingDraft.primary_sectors);
            parsedPrimarySectors = Array.isArray(parsed) ? parsed : undefined;
          } catch {
            parsedPrimarySectors = undefined;
          }
        }

        setState(prev => ({ ...prev, draftId: existingDraft.id }));
        return {
          applicantType: (existingDraft.applicant_type || undefined) as ApplicationFormData["applicantType"] | undefined,
          fullLegalName: existingDraft.full_legal_name || undefined,
          organizationName: existingDraft.organization_name || undefined,
          registrationIdNumber: existingDraft.registration_id_number || undefined,
          countryOfResidence: existingDraft.country_of_residence || undefined,
          cityRegion: existingDraft.city_region || undefined,
          emailAddress: existingDraft.contact_email || undefined,
          phoneNumber: existingDraft.contact_phone || undefined,
          yearEstablished: existingDraft.year_established || undefined,
          coreMissionPurpose: existingDraft.core_mission_purpose || undefined,
          primarySectors: parsedPrimarySectors,
          primarySectorOther: existingDraft.primary_sector_other || undefined,
          numberOfTeamMembers: existingDraft.team_size || undefined,
          keyTeamMembersRoles: existingDraft.key_team_members_roles || undefined,
          previousGrantsFundingReceived:
            existingDraft.previous_grants_funding_received || false,
          previousGrantsFundingDetails:
            existingDraft.previous_grants_funding_details || undefined,
          projectTitle: existingDraft.project_title || undefined,
          projectSummary: existingDraft.project_summary || undefined,
          geographicFocus: existingDraft.geographic_focus || undefined,
          linkedinUrl: existingDraft.linkedin_url || undefined,
          githubUrl: existingDraft.github_url || undefined,
          twitterUrl: existingDraft.twitter_url || undefined,
          websiteUrl: existingDraft.website_url || undefined,
          otherSocialLinks: existingDraft.other_social_links || undefined,
          informationAccurateConfirmed:
            existingDraft.information_accurate_confirmed || false,
          conflictOfInterestDeclared:
            existingDraft.conflict_of_interest_declared || false,
          reportingRequirementsAgreed:
            existingDraft.reporting_requirements_agreed || false,
          dataProcessingConsented:
            existingDraft.data_processing_consented || false,
          declarationDate: existingDraft.declaration_date
            ? new Date(existingDraft.declaration_date)
            : undefined,
          paymentCompleted: existingDraft.application_fee_paid || false,
          paymentIntentId: existingDraft.stripe_payment_intent_id || undefined,
        };
      }
      
      return null;
    } catch (error) {
      console.error("Error loading draft:", error);
      return null;
    }
  }, [formData.projectId]);

  // Delete draft after successful submission
  const deleteDraft = useCallback(async () => {
    if (!state.draftId) return;
    
    try {
      await supabase
        .from("applications")
        .delete()
        .eq("id", state.draftId)
        .eq("is_draft", true);
      
      setState(prev => ({ ...prev, draftId: null }));
    } catch (error) {
      console.error("Error deleting draft:", error);
    }
  }, [state.draftId]);

  return {
    ...state,
    saveDraft,
    loadExistingDraft,
    deleteDraft,
  };
};
