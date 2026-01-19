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

      const draftData = {
        user_id: user.id,
        project_id: formData.projectId,
        company_name: formData.companyName || null,
        contact_email: formData.contactEmail || null,
        contact_phone: formData.contactPhone || null,
        location: formData.location || null,
        project_description: formData.projectDescription || null,
        funding_amount_requested: formData.fundingAmountRequested || null,
        business_plan: formData.businessPlan || null,
        team_size: formData.teamSize || null,
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
  const loadExistingDraft = useCallback(async () => {
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
        setState(prev => ({ ...prev, draftId: existingDraft.id }));
        return {
          companyName: existingDraft.company_name || undefined,
          contactEmail: existingDraft.contact_email || undefined,
          contactPhone: existingDraft.contact_phone || undefined,
          location: existingDraft.location || undefined,
          projectDescription: existingDraft.project_description || undefined,
          fundingAmountRequested: existingDraft.funding_amount_requested || undefined,
          businessPlan: existingDraft.business_plan || undefined,
          teamSize: existingDraft.team_size || undefined,
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
