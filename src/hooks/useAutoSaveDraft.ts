import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ApplicationFormData } from "@/stores/applicationForm";

interface UseAutoSaveDraftOptions {
  formData: ApplicationFormData;
  isDirty: boolean;
  onSaved: () => void;
  debounceMs?: number;
  enabled?: boolean;
}

interface AutoSaveState {
  isSaving: boolean;
  lastSavedAt: Date | null;
  draftId: string | null;
  error: string | null;
}

export const useAutoSaveDraft = ({
  formData,
  isDirty,
  onSaved,
  debounceMs = 5000, // Save every 5 seconds when dirty
  enabled = true,
}: UseAutoSaveDraftOptions) => {
  const { toast } = useToast();
  const [state, setState] = useState<AutoSaveState>({
    isSaving: false,
    lastSavedAt: null,
    draftId: null,
    error: null,
  });
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>("");

  const saveDraft = useCallback(async () => {
    // Don't save if no project is selected or no meaningful data
    if (!formData.projectId) return;
    
    // Check if data has actually changed
    const currentDataString = JSON.stringify({
      projectId: formData.projectId,
      companyName: formData.companyName,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      location: formData.location,
      projectDescription: formData.projectDescription,
      fundingAmountRequested: formData.fundingAmountRequested,
      businessPlan: formData.businessPlan,
      teamSize: formData.teamSize,
    });
    
    if (currentDataString === lastSavedDataRef.current) {
      return; // No changes to save
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
      
      lastSavedDataRef.current = currentDataString;
      onSaved();
      
    } catch (error) {
      console.error("Auto-save error:", error);
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: "Failed to save draft",
      }));
    }
  }, [formData, state.draftId, onSaved]);

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

  // Auto-save effect with debounce
  useEffect(() => {
    if (!enabled || !isDirty || !formData.projectId) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, isDirty, formData, debounceMs, saveDraft]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirty && formData.projectId) {
        saveDraft();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, formData.projectId, saveDraft]);

  return {
    ...state,
    saveDraft,
    loadExistingDraft,
    deleteDraft,
  };
};
