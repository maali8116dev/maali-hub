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
      application_assignments: {
        Row: {
          application_id: string
          assigned_at: string
          id: string
          review_deadline: string | null
          reviewer_id: string
          status: string | null
        }
        Insert: {
          application_id: string
          assigned_at?: string
          id?: string
          review_deadline?: string | null
          reviewer_id: string
          status?: string | null
        }
        Update: {
          application_id?: string
          assigned_at?: string
          id?: string
          review_deadline?: string | null
          reviewer_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
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
          is_library_document: boolean | null
          opportunity_id: number | null
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
          is_library_document?: boolean | null
          opportunity_id?: number | null
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
          is_library_document?: boolean | null
          opportunity_id?: number | null
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
            foreignKeyName: "application_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
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
          geographic_focus: string | null
          github_url: string | null
          id: string
          information_accurate_confirmed: boolean | null
          is_draft: boolean
          key_team_members_roles: string | null
          linkedin_url: string | null
          location: string | null
          opportunity_id: number
          organization_name: string | null
          other_social_links: string | null
          previous_grants_funding_details: string | null
          previous_grants_funding_received: boolean | null
          primary_sector_other: string | null
          primary_sectors: Json | null
          problem_statement: string | null
          project_id: number
          project_summary: string | null
          project_title: string | null
          proposed_solution: string | null
          registration_id_number: string | null
          reporting_requirements_agreed: boolean | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          target_beneficiaries: string | null
          team_size: number | null
          twitter_url: string | null
          updated_at: string
          user_id: string | null
          website_url: string | null
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
          geographic_focus?: string | null
          github_url?: string | null
          id?: string
          information_accurate_confirmed?: boolean | null
          is_draft?: boolean
          key_team_members_roles?: string | null
          linkedin_url?: string | null
          location?: string | null
          opportunity_id: number
          organization_name?: string | null
          other_social_links?: string | null
          previous_grants_funding_details?: string | null
          previous_grants_funding_received?: boolean | null
          primary_sector_other?: string | null
          primary_sectors?: Json | null
          problem_statement?: string | null
          project_id: number
          project_summary?: string | null
          project_title?: string | null
          proposed_solution?: string | null
          registration_id_number?: string | null
          reporting_requirements_agreed?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          target_beneficiaries?: string | null
          team_size?: number | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
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
          geographic_focus?: string | null
          github_url?: string | null
          id?: string
          information_accurate_confirmed?: boolean | null
          is_draft?: boolean
          key_team_members_roles?: string | null
          linkedin_url?: string | null
          location?: string | null
          opportunity_id?: number
          organization_name?: string | null
          other_social_links?: string | null
          previous_grants_funding_details?: string | null
          previous_grants_funding_received?: boolean | null
          primary_sector_other?: string | null
          primary_sectors?: Json | null
          problem_statement?: string | null
          project_id?: number
          project_summary?: string | null
          project_title?: string | null
          proposed_solution?: string | null
          registration_id_number?: string | null
          reporting_requirements_agreed?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          target_beneficiaries?: string | null
          team_size?: number | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
          year_established?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
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
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          admin_notes: string | null
          country: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          message: string
          phone: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          country?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          message: string
          phone?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          country?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          message?: string
          phone?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          idempotency_key: string | null
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          sent_at: string | null
          status: string
          to_email: string
          type: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          to_email: string
          type: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          to_email?: string
          type?: string
          updated_at?: string
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
      kyc_verifications: {
        Row: {
          admin_notes: string | null
          created_at: string
          full_name_on_id: string
          id: string
          id_document_url: string | null
          id_number: string
          id_type: Database["public"]["Enums"]["kyc_id_type"]
          rejection_reason: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          full_name_on_id: string
          id?: string
          id_document_url?: string | null
          id_number: string
          id_type: Database["public"]["Enums"]["kyc_id_type"]
          rejection_reason?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          full_name_on_id?: string
          id?: string
          id_document_url?: string | null
          id_number?: string
          id_type?: Database["public"]["Enums"]["kyc_id_type"]
          rejection_reason?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
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
      opportunities: {
        Row: {
          application_fee: number | null
          category_id: number | null
          country: string | null
          created_at: string
          created_by: string | null
          currency: string
          current_applicants: number | null
          deadline: string
          description: string
          eligibility_criteria: string | null
          end_date: string | null
          experience_level:
            | Database["public"]["Enums"]["experience_level"]
            | null
          featured: boolean
          funding_amount: string
          funding_type: Database["public"]["Enums"]["funding_type"] | null
          id: number
          image_url: string | null
          location: string
          max_applicants: number | null
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          organization_name: string | null
          program_format: Database["public"]["Enums"]["program_format"] | null
          requirements: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          application_fee?: number | null
          category_id?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_applicants?: number | null
          deadline: string
          description: string
          eligibility_criteria?: string | null
          end_date?: string | null
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          featured?: boolean
          funding_amount: string
          funding_type?: Database["public"]["Enums"]["funding_type"] | null
          id?: number
          image_url?: string | null
          location: string
          max_applicants?: number | null
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          organization_name?: string | null
          program_format?: Database["public"]["Enums"]["program_format"] | null
          requirements?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          application_fee?: number | null
          category_id?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_applicants?: number | null
          deadline?: string
          description?: string
          eligibility_criteria?: string | null
          end_date?: string | null
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          featured?: boolean
          funding_amount?: string
          funding_type?: Database["public"]["Enums"]["funding_type"] | null
          id?: number
          image_url?: string | null
          location?: string
          max_applicants?: number | null
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          organization_name?: string | null
          program_format?: Database["public"]["Enums"]["program_format"] | null
          requirements?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_tag_map: {
        Row: {
          id: number
          opportunity_id: number
          tag_id: number
        }
        Insert: {
          id?: number
          opportunity_id: number
          tag_id: number
        }
        Update: {
          id?: number
          opportunity_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_tag_map_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_tag_map_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "opportunity_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_tags: {
        Row: {
          created_at: string
          id: number
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number | null
          featured: boolean | null
          id: number
          logo_url: string | null
          name: string
          status: string
          updated_at: string
          user_id: string | null
          website_url: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          featured?: boolean | null
          id?: number
          logo_url?: string | null
          name: string
          status?: string
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          featured?: boolean | null
          id?: number
          logo_url?: string | null
          name?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
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
          method_type: string | null
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
          method_type?: string | null
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
          method_type?: string | null
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
          category: string | null
          category_id: number | null
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
          category?: string | null
          category_id?: number | null
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
          category?: string | null
          category_id?: number | null
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
        Relationships: [
          {
            foreignKeyName: "projects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_config: {
        Row: {
          created_at: string
          description: string | null
          max_requests: number
          operation_type: string
          updated_at: string
          window_minutes: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          max_requests: number
          operation_type: string
          updated_at?: string
          window_minutes: number
        }
        Update: {
          created_at?: string
          description?: string | null
          max_requests?: number
          operation_type?: string
          updated_at?: string
          window_minutes?: number
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          created_at: string
          id: string
          ip_address: unknown
          operation_type: string
          updated_at: string
          user_id: string | null
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          ip_address?: unknown
          operation_type: string
          updated_at?: string
          user_id?: string | null
          window_start: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          ip_address?: unknown
          operation_type?: string
          updated_at?: string
          user_id?: string | null
          window_start?: string
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
      review_scores: {
        Row: {
          application_id: string
          assignment_id: string
          comments: string | null
          created_at: string
          id: string
          overall_score: number | null
          recommendation: string | null
          reviewer_id: string
          rubric_version_id: string | null
          scores: Json
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          application_id: string
          assignment_id: string
          comments?: string | null
          created_at?: string
          id?: string
          overall_score?: number | null
          recommendation?: string | null
          reviewer_id: string
          rubric_version_id?: string | null
          scores?: Json
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          assignment_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          overall_score?: number | null
          recommendation?: string | null
          reviewer_id?: string
          rubric_version_id?: string | null
          scores?: Json
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_scores_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_scores_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "application_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_scores_rubric_version_id_fkey"
            columns: ["rubric_version_id"]
            isOneToOne: false
            referencedRelation: "rubric_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_categories: {
        Row: {
          category_id: number | null
          created_at: string
          id: string
          reviewer_id: string
        }
        Insert: {
          category_id?: number | null
          created_at?: string
          id?: string
          reviewer_id: string
        }
        Update: {
          category_id?: number | null
          created_at?: string
          id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_conflicts: {
        Row: {
          application_id: string
          conflict_reason: string
          created_at: string
          id: string
          reviewer_id: string
        }
        Insert: {
          application_id: string
          conflict_reason: string
          created_at?: string
          id?: string
          reviewer_id: string
        }
        Update: {
          application_id?: string
          conflict_reason?: string
          created_at?: string
          id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_conflicts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          rubric: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          rubric: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          rubric?: Json
          version?: number
        }
        Relationships: []
      }
      success_stories: {
        Row: {
          category: string
          company: string
          created_at: string
          created_by: string | null
          description: string
          display_order: number | null
          featured: boolean | null
          funding_amount: string
          funding_date: string
          id: number
          image_url: string | null
          impact_metrics: string | null
          location: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          company: string
          created_at?: string
          created_by?: string | null
          description: string
          display_order?: number | null
          featured?: boolean | null
          funding_amount: string
          funding_date: string
          id?: number
          image_url?: string | null
          impact_metrics?: string | null
          location: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          company?: string
          created_at?: string
          created_by?: string | null
          description?: string
          display_order?: number | null
          featured?: boolean | null
          funding_amount?: string
          funding_date?: string
          id?: number
          image_url?: string | null
          impact_metrics?: string | null
          location?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_rubric: {
        Row: {
          created_at: string
          id: string
          rubric: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          rubric: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          rubric?: Json
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
          invoice_pdf_url: string | null
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
          invoice_pdf_url?: string | null
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
          invoice_pdf_url?: string | null
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
          user_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_set_application_reviewers: {
        Args: { p_application_id: string; p_reviewer_ids: string[] }
        Returns: undefined
      }
      assign_reviewer_category: {
        Args: { p_category_name: string; p_reviewer_id: string }
        Returns: {
          category_id: number
          category_name: string
          created_at: string
          id: string
          reviewer_id: string
        }[]
      }
      assign_reviewers_to_application: {
        Args: { p_application_id: string; p_num_reviewers?: number }
        Returns: {
          assignment_id: string
          reviewer_id: string
        }[]
      }
      calculate_review_score:
        | { Args: { p_scores: Json }; Returns: number }
        | { Args: { p_category: string; p_scores: Json }; Returns: number }
        | {
            Args: { p_rubric_version_id?: string; p_scores: Json }
            Returns: number
          }
      check_and_increment_rate_limit: {
        Args: {
          p_ip_address: unknown
          p_max_requests: number
          p_operation_type: string
          p_user_id: string
          p_window_minutes: number
        }
        Returns: Json
      }
      cleanup_old_pending_payment_applications: {
        Args: { p_days_old?: number }
        Returns: {
          deleted_count: number
          deleted_ids: string[]
        }[]
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
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
      create_rubric_version: {
        Args: { p_notes?: string; p_rubric: Json }
        Returns: string
      }
      generate_category_slug: {
        Args: { category_name: string }
        Returns: string
      }
      generate_invoice_number: { Args: never; Returns: string }
      get_active_rubric_version: { Args: never; Returns: string }
      get_admin_applications: {
        Args: never
        Returns: {
          applicant_email: string
          applicant_name: string
          contact_email: string
          contact_phone: string
          id: string
          project_id: number
          project_title: string
          review_deadline: string
          review_notes: string
          reviewed_at: string
          reviewed_by: string
          reviewed_by_name: string
          reviewer_decisions: Json
          status: string
          submitted_at: string
          total_assignments: number
        }[]
      }
      get_admin_stats: {
        Args: never
        Returns: {
          active_projects: number
          approved_applications: number
          pending_applications: number
          rejected_applications: number
          total_applications: number
          total_projects: number
          total_users: number
        }[]
      }
      get_all_reviewers_with_details: {
        Args: never
        Returns: {
          average_score: number
          categories: Json
          email: string
          first_name: string
          last_name: string
          reviewer_id: string
          total_reviews: number
          workload: number
        }[]
      }
      get_all_users_for_admin: {
        Args: never
        Returns: {
          applications_count: number
          avatar_url: string
          bio: string
          business_name: string
          business_sector: string
          country: string
          email: string
          first_name: string
          id: string
          last_name: string
          name: string
          registered_at: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          user_id: string
        }[]
      }
      get_application_assignments_with_reviewers: {
        Args: { p_application_id: string }
        Returns: {
          application_id: string
          assigned_at: string
          id: string
          reviewer_first_name: string
          reviewer_id: string
          reviewer_last_name: string
          reviewer_user_id: string
          status: string
        }[]
      }
      get_application_details: {
        Args: { p_application_id: string }
        Returns: {
          application: Json
          documents: Json
          project: Json
        }[]
      }
      get_application_review_scores_with_reviewers: {
        Args: { p_application_id: string }
        Returns: {
          application_id: string
          assignment_id: string
          comments: string
          created_at: string
          id: string
          overall_score: number
          recommendation: string
          reviewer_first_name: string
          reviewer_id: string
          reviewer_last_name: string
          reviewer_user_id: string
          scores: Json
          submitted_at: string
          updated_at: string
        }[]
      }
      get_application_submission_preview: {
        Args: { p_project_id: number; p_user_id: string }
        Returns: {
          can_submit: boolean
          existing_application: Json
          project: Json
          validation_error: string
        }[]
      }
      get_eligible_reviewers_for_application: {
        Args: { p_application_id: string }
        Returns: {
          first_name: string
          last_name: string
          reviewer_id: string
          workload: number
        }[]
      }
      get_financial_stats: {
        Args: never
        Returns: {
          application_fees: number
          completed_transactions: number
          failed_transactions: number
          last_month_revenue: number
          pending_transactions: number
          refunded_amount: number
          revenue_growth: number
          subscriptions: number
          this_month_revenue: number
          total_revenue: number
          total_transactions: number
        }[]
      }
      get_opportunities_with_filters: {
        Args: {
          p_country?: string
          p_experience_level?: string
          p_funding_type?: string
          p_location?: string
          p_opportunity_type?: string
          p_page?: number
          p_page_size?: number
          p_program_format?: string
          p_search?: string
          p_status?: string
          p_tags?: string[]
        }
        Returns: Json
      }
      get_project_applications_ranked: {
        Args: { p_project_id: number }
        Returns: {
          applicant_email: string
          applicant_name: string
          application_id: string
          average_score: number
          rank_position: number
          recommendations: Json
          reviewer_scores: Json
          score_variance: number
          status: string
          submitted_at: string
          total_reviews: number
        }[]
      }
      get_projects_with_filters: {
        Args: {
          p_category?: string
          p_location?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          page: number
          projects: Json
          total_count: number
          total_pages: number
        }[]
      }
      get_rate_limit_config: {
        Args: { p_operation_type: string }
        Returns: Record<string, unknown>
      }
      get_reviewer_applications: {
        Args: { p_reviewer_id?: string }
        Returns: {
          applicant_email: string
          applicant_name: string
          assigned_at: string
          assignment_id: string
          assignment_status: string
          contact_email: string
          contact_phone: string
          id: string
          project_id: number
          project_title: string
          review_notes: string
          reviewed_at: string
          reviewed_by: string
          reviewed_by_name: string
          reviewer_decisions: Json
          status: string
          submitted_at: string
          total_assignments: number
        }[]
      }
      get_reviewer_assignments_with_application: {
        Args: { p_reviewer_id: string }
        Returns: {
          application_id: string
          application_status: string
          assigned_at: string
          assignment_id: string
          category_id: number
          category_name: string
          created_at: string
          is_draft: boolean
          project_id: number
          project_title: string
          reviewer_id: string
          status: string
        }[]
      }
      get_reviewer_full_details: {
        Args: { p_reviewer_id: string }
        Returns: {
          average_score: number
          categories: Json
          completed_reviews: Json
          pending_assignments: Json
          reviewer: Json
          total_assignments: number
          total_reviews: number
          workload: number
        }[]
      }
      get_reviewer_workload: {
        Args: { p_reviewer_id: string }
        Returns: number
      }
      get_rubric_by_version_id: {
        Args: { p_version_id: string }
        Returns: Json
      }
      get_user_applications_with_opportunities: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_user_applications_with_projects: {
        Args: { p_user_id: string }
        Returns: {
          application: Json
          project: Json
        }[]
      }
      get_user_dashboard_stats: {
        Args: { p_user_id: string }
        Returns: {
          approved_applications: number
          pending_applications: number
          rejected_applications: number
          total_applications: number
        }[]
      }
      get_user_role: { Args: { user_uuid: string }; Returns: string }
      is_opportunity_open: {
        Args: { p_opportunity_id: number }
        Returns: boolean
      }
      is_project_open: { Args: { p_project_id: number }; Returns: boolean }
      mark_all_notifications_read: {
        Args: { p_user_id: string }
        Returns: number
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      validate_application_submission: {
        Args: { p_project_id: number; p_user_id: string }
        Returns: {
          can_submit: boolean
          error_message: string
          existing_application_id: string
          has_existing_application: boolean
          is_project_open: boolean
          project_deadline: string
          project_fee: number
          project_status: string
          project_title: string
        }[]
      }
    }
    Enums: {
      experience_level:
        | "student"
        | "undergraduate"
        | "graduate"
        | "early_career"
        | "mid_career"
        | "startup_founder"
        | "researcher"
        | "professional"
      funding_type:
        | "fully_funded"
        | "partially_funded"
        | "stipend"
        | "no_funding"
        | "equity"
        | "paid"
        | "unpaid"
      kyc_id_type:
        | "passport"
        | "national_id"
        | "drivers_license"
        | "business_registration"
      kyc_status: "pending" | "verified" | "rejected" | "expired"
      opportunity_type:
        | "grant"
        | "fellowship"
        | "scholarship"
        | "internship"
        | "training"
        | "competition"
        | "accelerator"
        | "incubator"
        | "job"
      program_format: "online" | "in_person" | "hybrid"
      user_role: "admin" | "reviewer" | "applicant" | "partner"
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
      experience_level: [
        "student",
        "undergraduate",
        "graduate",
        "early_career",
        "mid_career",
        "startup_founder",
        "researcher",
        "professional",
      ],
      funding_type: [
        "fully_funded",
        "partially_funded",
        "stipend",
        "no_funding",
        "equity",
        "paid",
        "unpaid",
      ],
      kyc_id_type: [
        "passport",
        "national_id",
        "drivers_license",
        "business_registration",
      ],
      kyc_status: ["pending", "verified", "rejected", "expired"],
      opportunity_type: [
        "grant",
        "fellowship",
        "scholarship",
        "internship",
        "training",
        "competition",
        "accelerator",
        "incubator",
        "job",
      ],
      program_format: ["online", "in_person", "hybrid"],
      user_role: ["admin", "reviewer", "applicant", "partner"],
    },
  },
} as const
