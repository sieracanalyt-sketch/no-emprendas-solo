// ──────────────────────────────────────────────────────────────────────────────
// Tipos generados desde el esquema de Supabase. NO editar a mano.
//
// Regenerar tras cada migración:
//   npx supabase gen types typescript --project-id yvgsukvuiupsyrtghyri > src/types/supabase.ts
// (y volver a poner esta cabecera)
// ──────────────────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          attendees: string[] | null
          color: string | null
          created_at: string
          description: string | null
          end_at: string
          expires_at: string | null
          google_id: string | null
          id: string
          kind: string
          owner_id: string
          prep_answers: Json | null
          proposal_for: string | null
          source: string
          start_at: string
          status: string
          task_id: string | null
          title: string
          urgent: boolean
        }
        Insert: {
          attendees?: string[] | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_at: string
          expires_at?: string | null
          google_id?: string | null
          id?: string
          kind?: string
          owner_id: string
          prep_answers?: Json | null
          proposal_for?: string | null
          source?: string
          start_at: string
          status?: string
          task_id?: string | null
          title?: string
          urgent?: boolean
        }
        Update: {
          attendees?: string[] | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_at?: string
          expires_at?: string | null
          google_id?: string | null
          id?: string
          kind?: string
          owner_id?: string
          prep_answers?: Json | null
          proposal_for?: string | null
          source?: string
          start_at?: string
          status?: string
          task_id?: string | null
          title?: string
          urgent?: boolean
        }
        Relationships: []
      }
      chats: {
        Row: {
          id: string
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          id: string
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          id?: string
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          user1: string | null
          user2: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          user1?: string | null
          user2?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          user1?: string | null
          user2?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          active: boolean
          feature: string
          min_tier: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          feature: string
          min_tier?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          feature?: string
          min_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          left_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          type: Database["public"]["Enums"]["group_type"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          type: Database["public"]["Enums"]["group_type"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          type?: Database["public"]["Enums"]["group_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "nucleo_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          duration: number | null
          from_uid: string
          group_id: string
          id: string
          text: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          duration?: number | null
          from_uid: string
          group_id: string
          id?: string
          text?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          duration?: number | null
          from_uid?: string
          group_id?: string
          id?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "nucleo_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          last_activity_at: string
          members: string[]
          name: string
          season_ends_at: string | null
          spawned_from: string | null
          stage: Database["public"]["Enums"]["stage"] | null
          status: Database["public"]["Enums"]["group_status"]
          type: Database["public"]["Enums"]["group_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          last_activity_at?: string
          members?: string[]
          name: string
          season_ends_at?: string | null
          spawned_from?: string | null
          stage?: Database["public"]["Enums"]["stage"] | null
          status?: Database["public"]["Enums"]["group_status"]
          type?: Database["public"]["Enums"]["group_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          last_activity_at?: string
          members?: string[]
          name?: string
          season_ends_at?: string | null
          spawned_from?: string | null
          stage?: Database["public"]["Enums"]["stage"] | null
          status?: Database["public"]["Enums"]["group_status"]
          type?: Database["public"]["Enums"]["group_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_spawned_from_fkey"
            columns: ["spawned_from"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_spawned_from_fkey"
            columns: ["spawned_from"]
            isOneToOne: false
            referencedRelation: "nucleo_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          max_uses: number
          note: string | null
          used_at: string | null
          used_by: string | null
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          max_uses?: number
          note?: string | null
          used_at?: string | null
          used_by?: string | null
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          max_uses?: number
          note?: string | null
          used_at?: string | null
          used_by?: string | null
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_redemptions: {
        Row: {
          code: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "invite_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      match_profiles: {
        Row: {
          ambicion: number | null
          areas: Json
          big_five: Json
          colaboracion_detalle: string | null
          colaboracion_previa: string | null
          conflicto: string | null
          conflicto_reparacion: string | null
          cultura_ideal: string | null
          equity_split: string | null
          exit_ideal: string | null
          fiabilidad: string | null
          fuerte_en: string[]
          horas: string | null
          horas_6m: string | null
          importa: string | null
          king_o_rich: number | null
          necesita: string[]
          pesos_usuario: string[]
          ritmo_decision: number | null
          ritmo_plan: number | null
          rol_buscado: string | null
          runway_meses: string | null
          temas: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          ambicion?: number | null
          areas?: Json
          big_five?: Json
          colaboracion_detalle?: string | null
          colaboracion_previa?: string | null
          conflicto?: string | null
          conflicto_reparacion?: string | null
          cultura_ideal?: string | null
          equity_split?: string | null
          exit_ideal?: string | null
          fiabilidad?: string | null
          fuerte_en?: string[]
          horas?: string | null
          horas_6m?: string | null
          importa?: string | null
          king_o_rich?: number | null
          necesita?: string[]
          pesos_usuario?: string[]
          ritmo_decision?: number | null
          ritmo_plan?: number | null
          rol_buscado?: string | null
          runway_meses?: string | null
          temas?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          ambicion?: number | null
          areas?: Json
          big_five?: Json
          colaboracion_detalle?: string | null
          colaboracion_previa?: string | null
          conflicto?: string | null
          conflicto_reparacion?: string | null
          cultura_ideal?: string | null
          equity_split?: string | null
          exit_ideal?: string | null
          fiabilidad?: string | null
          fuerte_en?: string[]
          horas?: string | null
          horas_6m?: string | null
          importa?: string | null
          king_o_rich?: number | null
          necesita?: string[]
          pesos_usuario?: string[]
          ritmo_decision?: number | null
          ritmo_plan?: number | null
          rol_buscado?: string | null
          runway_meses?: string | null
          temas?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      match_requests: {
        Row: {
          answers: Json
          created_at: string
          id: string
          model: string | null
          result: Json | null
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          model?: string | null
          result?: Json | null
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          model?: string | null
          result?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      merge_memories: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          meta: Json
          user_ref: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          user_ref: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          user_ref?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          chat_id: string
          created_at: string
          duration: number | null
          from_uid: string
          id: string
          text: string | null
          to_uid: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          chat_id: string
          created_at?: string
          duration?: number | null
          from_uid: string
          id?: string
          text?: string | null
          to_uid: string
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          chat_id?: string
          created_at?: string
          duration?: number | null
          from_uid?: string
          id?: string
          text?: string | null
          to_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      Messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string
          id: string
          sender_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          sender_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          sender_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string
          id: string
          looking_for: string | null
          skills: string | null
        }
        Insert: {
          bio?: string | null
          created_at: string
          display_name: string
          id?: string
          looking_for?: string | null
          skills?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          looking_for?: string | null
          skills?: string | null
        }
        Relationships: []
      }
      re_engagement_log: {
        Row: {
          id: string
          reason: string | null
          sent_at: string
          suggested_user_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          reason?: string | null
          sent_at?: string
          suggested_user_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          reason?: string | null
          sent_at?: string
          suggested_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_engagement_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          next_billing_date: string | null
          partner_id: string | null
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          next_billing_date?: string | null
          partner_id?: string | null
          status?: string
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          next_billing_date?: string | null
          partner_id?: string | null
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_charters: {
        Row: {
          contribution: string
          exit_clause: string
          group_id: string
          hours_per_week: number
          id: string
          signed_at: string
          user_id: string
        }
        Insert: {
          contribution: string
          exit_clause: string
          group_id: string
          hours_per_week: number
          id?: string
          signed_at?: string
          user_id: string
        }
        Update: {
          contribution?: string
          exit_clause?: string
          group_id?: string
          hours_per_week?: number
          id?: string
          signed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_charters_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_charters_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "nucleo_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          invited_by: string
          invited_user: string
          message: string | null
          proposer_contribution: string | null
          proposer_exit_clause: string | null
          proposer_hours_per_week: number | null
          responded_at: string | null
          status: Database["public"]["Enums"]["invite_status"]
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          invited_by: string
          invited_user: string
          message?: string | null
          proposer_contribution?: string | null
          proposer_exit_clause?: string | null
          proposer_hours_per_week?: number | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          invited_by?: string
          invited_user?: string
          message?: string | null
          proposer_contribution?: string | null
          proposer_exit_clause?: string | null
          proposer_hours_per_week?: number | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "nucleo_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          day: string
          user_id: string
          weight: number
        }
        Insert: {
          day: string
          user_id: string
          weight?: number
        }
        Update: {
          day?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar: string | null
          biografia: string
          buscando: string[]
          cohort_approved: boolean
          created_at: string
          email: string | null
          has_project: boolean
          id: string
          ignored_users: string[]
          is_admin: boolean
          last_login: string | null
          nombre: string
          onboarding_done_at: string | null
          open_to_join: boolean
          operating_level: Database["public"]["Enums"]["stage"] | null
          prestige: number
          prestige_detail: Json | null
          project_stage: Database["public"]["Enums"]["stage"] | null
          project_status: string | null
          proyecto: string
          proyecto_stage: string | null
          sector: string | null
          seeking_partner: boolean
          streak_best: number
          streak_days: number
          streak_last_date: string | null
          tier: string
          trial_until: string | null
        }
        Insert: {
          avatar?: string | null
          biografia?: string
          buscando?: string[]
          cohort_approved?: boolean
          created_at?: string
          email?: string | null
          has_project?: boolean
          id: string
          ignored_users?: string[]
          is_admin?: boolean
          last_login?: string | null
          nombre?: string
          onboarding_done_at?: string | null
          open_to_join?: boolean
          operating_level?: Database["public"]["Enums"]["stage"] | null
          prestige?: number
          prestige_detail?: Json | null
          project_stage?: Database["public"]["Enums"]["stage"] | null
          project_status?: string | null
          proyecto?: string
          proyecto_stage?: string | null
          sector?: string | null
          seeking_partner?: boolean
          streak_best?: number
          streak_days?: number
          streak_last_date?: string | null
          tier?: string
          trial_until?: string | null
        }
        Update: {
          avatar?: string | null
          biografia?: string
          buscando?: string[]
          cohort_approved?: boolean
          created_at?: string
          email?: string | null
          has_project?: boolean
          id?: string
          ignored_users?: string[]
          is_admin?: boolean
          last_login?: string | null
          nombre?: string
          onboarding_done_at?: string | null
          open_to_join?: boolean
          operating_level?: Database["public"]["Enums"]["stage"] | null
          prestige?: number
          prestige_detail?: Json | null
          project_stage?: Database["public"]["Enums"]["stage"] | null
          project_status?: string | null
          proyecto?: string
          proyecto_stage?: string | null
          sector?: string | null
          seeking_partner?: boolean
          streak_best?: number
          streak_days?: number
          streak_last_date?: string | null
          tier?: string
          trial_until?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          confirmed: boolean
          confirmed_at: string | null
          consent_at: string
          created_at: string
          current_project: string | null
          email: string
          expectations: string | null
          followups_sent: number
          hours_per_week: string | null
          id: string
          invite_code: string | null
          invited_at: string | null
          name: string | null
          project_phase: string | null
          queue_number: number | null
          ref_code: string
          referred_by: string | null
          source: string | null
          unsubscribed_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          confirmed?: boolean
          confirmed_at?: string | null
          consent_at: string
          created_at?: string
          current_project?: string | null
          email: string
          expectations?: string | null
          followups_sent?: number
          hours_per_week?: string | null
          id?: string
          invite_code?: string | null
          invited_at?: string | null
          name?: string | null
          project_phase?: string | null
          queue_number?: number | null
          ref_code: string
          referred_by?: string | null
          source?: string | null
          unsubscribed_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          confirmed?: boolean
          confirmed_at?: string | null
          consent_at?: string
          created_at?: string
          current_project?: string | null
          email?: string
          expectations?: string | null
          followups_sent?: number
          hours_per_week?: string | null
          id?: string
          invite_code?: string | null
          invited_at?: string | null
          name?: string | null
          project_phase?: string | null
          queue_number?: number | null
          ref_code?: string
          referred_by?: string | null
          source?: string | null
          unsubscribed_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_invite_code_fkey"
            columns: ["invite_code"]
            isOneToOne: true
            referencedRelation: "invite_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      waitlist_emails: {
        Row: {
          kind: string
          provider_id: string | null
          sent_at: string
          waitlist_id: string
        }
        Insert: {
          kind: string
          provider_id?: string | null
          sent_at?: string
          waitlist_id: string
        }
        Update: {
          kind?: string
          provider_id?: string | null
          sent_at?: string
          waitlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_emails_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_roles: {
        Row: {
          pos_x: number | null
          pos_y: number | null
          rol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          pos_x?: number | null
          pos_y?: number | null
          rol?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          pos_x?: number | null
          pos_y?: number | null
          rol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workflow_tasks: {
        Row: {
          assignee: string | null
          blocked: boolean
          created_at: string
          description: string
          due_date: string | null
          eisenhower_quadrant: number | null
          id: string
          priority: string
          status: string
          title: string
        }
        Insert: {
          assignee?: string | null
          blocked?: boolean
          created_at?: string
          description?: string
          due_date?: string | null
          eisenhower_quadrant?: number | null
          id?: string
          priority?: string
          status?: string
          title: string
        }
        Update: {
          assignee?: string | null
          blocked?: boolean
          created_at?: string
          description?: string
          due_date?: string | null
          eisenhower_quadrant?: number | null
          id?: string
          priority?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      nucleo_slots: {
        Row: {
          id: string | null
          member_count: number | null
          stage: Database["public"]["Enums"]["stage"] | null
          status: Database["public"]["Enums"]["group_status"] | null
        }
        Insert: {
          id?: string | null
          member_count?: never
          stage?: Database["public"]["Enums"]["stage"] | null
          status?: Database["public"]["Enums"]["group_status"] | null
        }
        Update: {
          id?: string | null
          member_count?: never
          stage?: Database["public"]["Enums"]["stage"] | null
          status?: Database["public"]["Enums"]["group_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_team_invite: {
        Args: {
          p_contribution: string
          p_exit: string
          p_hours: number
          p_invite: string
        }
        Returns: string
      }
      array_overlap_count: {
        Args: { a: string[]; b: string[] }
        Returns: number
      }
      assign_nucleo: { Args: { p_user?: string }; Returns: string }
      can_form_team: { Args: { a: string; b: string }; Returns: Json }
      chat_unlocked: { Args: { p_group: string }; Returns: boolean }
      decline_team_invite: { Args: { p_invite: string }; Returns: undefined }
      delete_user: { Args: never; Returns: undefined }
      dm_active_days: { Args: { a: string; b: string }; Returns: number }
      expire_team_invites: { Args: never; Returns: number }
      generate_waitlist_ref_code: { Args: never; Returns: string }
      get_profile_metrics: { Args: { target: string }; Returns: Json }
      invite_to_team: {
        Args: { p_group: string; p_invited_user: string; p_message: string }
        Returns: string
      }
      is_active_member: {
        Args: { p_group: string; p_user?: string }
        Returns: boolean
      }
      nes_match_suggestions: { Args: { limit_n?: number }; Returns: Json }
      next_nucleo_name: {
        Args: { p_stage: Database["public"]["Enums"]["stage"] }
        Returns: string
      }
      profile_complete: { Args: { p_user: string }; Returns: boolean }
      propose_team: {
        Args: {
          p_contribution: string
          p_exit: string
          p_hours: number
          p_invited_user: string
        }
        Returns: string
      }
      redeem_invite_code: {
        Args: { p_code: string; p_user: string }
        Returns: string
      }
      refresh_nucleo_status: { Args: { p_group: string }; Returns: undefined }
    }
    Enums: {
      group_status: "forming" | "active" | "at_risk" | "archived"
      group_type: "nucleo" | "equipo"
      invite_status: "pending" | "accepted" | "declined" | "expired"
      member_role: "member" | "steward" | "founder"
      stage: "ideacion" | "aplicacion" | "facturacion"
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

export const Constants = {
  public: {
    Enums: {
      group_status: ["forming", "active", "at_risk", "archived"],
      group_type: ["nucleo", "equipo"],
      invite_status: ["pending", "accepted", "declined", "expired"],
      member_role: ["member", "steward", "founder"],
      stage: ["ideacion", "aplicacion", "facturacion"],
    },
  },
} as const
