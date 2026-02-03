export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      application_documents: {
        Row: {
          application_id: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          project_id: number | null
          user_id: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          project_id?: number | null
          user_id?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          project_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applicant_type: string | null
          application_fee_paid: boolean | null
          business_plan: string | null
          city_region: string | null
          company_name: string | null
          conflict_of_interest_declared: boolean | null
          contact_email: string | null
          contact_phone: string | null
          core_mission_purpose: string | null
          country_of_residence: string | null
          created_at: string
          data_processing_consented: boolean | null
          declaration_date: string | null
          full_legal_name: string | null
          funding_amount_requested: string | null
          geographic_focus: string | null
          id: string
          information_accurate_confirmed: boolean | null
          is_draft: boolean
          key_team_members_roles: string | null
          location: string | null
          organization_name: string | null
          previous_grants_funding_details: string | null
          previous_grants_funding_received: boolean | null
          primary_sector_other: string | null
          primary_sectors: Json | null
          problem_statement: string | null
          project_description: string | null
          project_id: number
          project_summary: string | null
          project_title: string | null
          proposed_solution: string | null
          registration_id_number: string | null
          reporting_requirements_agreed: boolean | null
          status: string | null
          stripe_payment_intent_id: string | null
          target_beneficiaries: string | null
          team_size: number | null
          updated_at: string
          user_id: string | null
          year_established: number | null
        }
        Insert: {
          applicant_type?: string | null
          application_fee_paid?: boolean | null
          business_plan?: string | null
          city_region?: string | null
          company_name?: string | null
          conflict_of_interest_declared?: boolean | null
          contact_email?: string | null
          contact_phone?: string | null
          core_mission_purpose?: string | null
          country_of_residence?: string | null
          created_at?: string
          data_processing_consented?: boolean | null
          declaration_date?: string | null
          full_legal_name?: string | null
          funding_amount_requested?: string | null
          geographic_focus?: string | null
          id?: string
          information_accurate_confirmed?: boolean | null
          is_draft?: boolean
          key_team_members_roles?: string | null
          location?: string | null
          organization_name?: string | null
          previous_grants_funding_details?: string | null
          previous_grants_funding_received?: boolean | null
          primary_sector_other?: string | null
          primary_sectors?: Json | null
          problem_statement?: string | null
          project_description?: string | null
          project_id: number
          project_summary?: string | null
          project_title?: string | null
          proposed_solution?: string | null
          registration_id_number?: string | null
          reporting_requirements_agreed?: boolean | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          target_beneficiaries?: string | null
          team_size?: number | null
          updated_at?: string
          user_id?: string | null
          year_established?: number | null
        }
        Update: {
          applicant_type?: string | null
          application_fee_paid?: boolean | null
          business_plan?: string | null
          city_region?: string | null
          company_name?: string | null
          conflict_of_interest_declared?: boolean | null
          contact_email?: string | null
          contact_phone?: string | null
          core_mission_purpose?: string | null
          country_of_residence?: string | null
          created_at?: string
          data_processing_consented?: boolean | null
          declaration_date?: string | null
          full_legal_name?: string | null
          funding_amount_requested?: string | null
          geographic_focus?: string | null
          id?: string
          information_accurate_confirmed?: boolean | null
          is_draft?: boolean
          key_team_members_roles?: string | null
          location?: string | null
          organization_name?: string | null
          previous_grants_funding_details?: string | null
          previous_grants_funding_received?: boolean | null
          primary_sector_other?: string | null
          primary_sectors?: Json | null
          problem_statement?: string | null
          project_description?: string | null
          project_id?: number
          project_summary?: string | null
          project_title?: string | null
          proposed_solution?: string | null
          registration_id_number?: string | null
          reporting_requirements_agreed?: boolean | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          target_beneficiaries?: string | null
          team_size?: number | null
          updated_at?: string
          user_id?: string | null
          year_established?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          billing_email: string | null
          city: string
          company_name: string | null
          country: string
          created_at: string
          deleted_at: string | null
          full_name: string | null
          id: string
          is_default: boolean | null
          phone_number: string | null
          postal_code: string
          state_province: string | null
          tax_id: string | null
          tax_id_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          billing_email?: string | null
          city: string
          company_name?: string | null
          country: string
          created_at?: string
          deleted_at?: string | null
          full_name?: string | null
          id?: string
          is_default?: boolean | null
          phone_number?: string | null
          postal_code: string
          state_province?: string | null
          tax_id?: string | null
          tax_id_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          billing_email?: string | null
          city?: string
          company_name?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          full_name?: string | null
          id?: string
          is_default?: boolean | null
          phone_number?: string | null
          postal_code?: string
          state_province?: string | null
          tax_id?: string | null
          tax_id_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string
          category: string
          content: string
          created_at: string
          created_by: string | null
          excerpt: string
          featured: boolean | null
          id: number
          image_url: string
          published_at: string | null
          read_time: string
          status: string
          tags: string | null
          title: string
          updated_at: string
          views: number | null
        }
        Insert: {
          author: string
          category: string
          content: string
          created_at?: string
          created_by?: string | null
          excerpt: string
          featured?: boolean | null
          id?: number
          image_url: string
          published_at?: string | null
          read_time: string
          status?: string
          tags?: string | null
          title: string
          updated_at?: string
          views?: number | null
        }
        Update: {
          author?: string
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          excerpt?: string
          featured?: boolean | null
          id?: number
          image_url?: string
          published_at?: string | null
          read_time?: string
          status?: string
          tags?: string | null
          title?: string
          updated_at?: string
          views?: number | null
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          created_by: string | null
          display_order: number | null
          id: number
          is_published: boolean | null
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category: string
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          id?: number
          is_published?: boolean | null
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          id?: number
          is_published?: boolean | null
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          display_order: number | null
          expertise_areas: string[] | null
          id: number
          is_published: boolean | null
          linkedin_url: string | null
          name: string
          sector: string | null
          twitter_url: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          expertise_areas?: string[] | null
          id?: number
          is_published?: boolean | null
          linkedin_url?: string | null
          name: string
          sector?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          expertise_areas?: string[] | null
          id?: number
          is_published?: boolean | null
          linkedin_url?: string | null
          name?: string
          sector?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          billing_address: Json | null
          billing_email: string | null
          brand: string | null
          created_at: string
          deleted_at: string | null
          expiry_month: number | null
          expiry_year: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last4: string
          metadata: Json | null
          provider: string | null
          provider_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_address?: Json | null
          billing_email?: string | null
          brand?: string | null
          created_at?: string
          deleted_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last4: string
          metadata?: Json | null
          provider?: string | null
          provider_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_address?: Json | null
          billing_email?: string | null
          brand?: string | null
          created_at?: string
          deleted_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last4?: string
          metadata?: Json | null
          provider?: string | null
          provider_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          business_name: string | null
          business_sector: string | null
          country: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          business_name?: string | null
          business_sector?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          business_name?: string | null
          business_sector?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          application_fee: number | null
          category: string
          created_at: string
          created_by: string | null
          current_applicants: number | null
          deadline: string
          description: string
          eligibility_criteria: string | null
          featured: boolean
          funding_amount: string
          id: number
          image_url: string | null
          location: string
          max_applicants: number | null
          requirements: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          application_fee?: number | null
          category: string
          created_at?: string
          created_by?: string | null
          current_applicants?: number | null
          deadline: string
          description: string
          eligibility_criteria?: string | null
          featured?: boolean
          funding_amount: string
          id?: number
          image_url?: string | null
          location: string
          max_applicants?: number | null
          requirements?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          application_fee?: number | null
          category?: string
          created_at?: string
          created_by?: string | null
          current_applicants?: number | null
          deadline?: string
          description?: string
          eligibility_criteria?: string | null
          featured?: boolean
          funding_amount?: string
          id?: number
          image_url?: string | null
          location?: string
          max_applicants?: number | null
          requirements?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number | null
          download_count: number | null
          duration: string | null
          file_size: number | null
          file_type: string
          file_url: string | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          download_count?: number | null
          duration?: string | null
          file_size?: number | null
          file_type: string
          file_url?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          download_count?: number | null
          duration?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          application_id: string | null
          billing_address: Json | null
          billing_email: string | null
          completed_at: string | null
          created_at: string
          currency: string
          description: string
          failure_reason: string | null
          id: string
          invoice_number: string | null
          invoice_url: string | null
          metadata: Json | null
          payment_method_id: string | null
          project_id: number | null
          provider: string | null
          provider_payment_intent_id: string | null
          provider_transaction_id: string | null
          receipt_url: string | null
          refunded_at: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          application_id?: string | null
          billing_address?: Json | null
          billing_email?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          description: string
          failure_reason?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          metadata?: Json | null
          payment_method_id?: string | null
          project_id?: number | null
          provider?: string | null
          provider_payment_intent_id?: string | null
          provider_transaction_id?: string | null
          receipt_url?: string | null
          refunded_at?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          application_id?: string | null
          billing_address?: Json | null
          billing_email?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          description?: string
          failure_reason?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          metadata?: Json | null
          payment_method_id?: string | null
          project_id?: number | null
          provider?: string | null
          provider_payment_intent_id?: string | null
          provider_transaction_id?: string | null
          receipt_url?: string | null
          refunded_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      activity_logs_safe: {
        Row: {
          action_type: string | null
          created_at: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      generate_invoice_number: { Args: never; Returns: string }
      get_all_users_for_admin: {
        Args: never
        Returns: {
          applications_count: number
          email: string
          id: string
          name: string
          registered_at: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          user_id: string
        }[]
      }
      get_user_role: { Args: { user_uuid: string }; Returns: string }
      mark_all_notifications_read: {
        Args: { p_user_id: string }
        Returns: number
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "admin" | "reviewer" | "applicant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["admin", "reviewer", "applicant"],
    },
  },
} as const
