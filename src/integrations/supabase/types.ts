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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      classifications: {
        Row: {
          age_category: string | null
          breed: string | null
          breed_code: string | null
          completed_at: string | null
          confidence: string | null
          created_at: string
          id: string
          months_since_last_shear: number | null
          needs_retake: boolean | null
          photo_urls: string[] | null
          raw_ai_response: Json | null
          reasoning_sv: string | null
          recommendation_text_en: string | null
          recommendation_text_sv: string | null
          retake_reason_sv: string | null
          shear_recommendation: string | null
          sheep_id: string | null
          status: string
          user_id: string
          weeks_until_optimal: number | null
          wool_class: string | null
          wool_class_name_en: string | null
          wool_class_name_sv: string | null
        }
        Insert: {
          age_category?: string | null
          breed?: string | null
          breed_code?: string | null
          completed_at?: string | null
          confidence?: string | null
          created_at?: string
          id?: string
          months_since_last_shear?: number | null
          needs_retake?: boolean | null
          photo_urls?: string[] | null
          raw_ai_response?: Json | null
          reasoning_sv?: string | null
          recommendation_text_en?: string | null
          recommendation_text_sv?: string | null
          retake_reason_sv?: string | null
          shear_recommendation?: string | null
          sheep_id?: string | null
          status?: string
          user_id: string
          weeks_until_optimal?: number | null
          wool_class?: string | null
          wool_class_name_en?: string | null
          wool_class_name_sv?: string | null
        }
        Update: {
          age_category?: string | null
          breed?: string | null
          breed_code?: string | null
          completed_at?: string | null
          confidence?: string | null
          created_at?: string
          id?: string
          months_since_last_shear?: number | null
          needs_retake?: boolean | null
          photo_urls?: string[] | null
          raw_ai_response?: Json | null
          reasoning_sv?: string | null
          recommendation_text_en?: string | null
          recommendation_text_sv?: string | null
          retake_reason_sv?: string | null
          shear_recommendation?: string | null
          sheep_id?: string | null
          status?: string
          user_id?: string
          weeks_until_optimal?: number | null
          wool_class?: string | null
          wool_class_name_en?: string | null
          wool_class_name_sv?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classifications_sheep_id_fkey"
            columns: ["sheep_id"]
            isOneToOne: false
            referencedRelation: "sheep"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          farm_name: string | null
          first_name: string | null
          full_name: string | null
          home_lat: number | null
          home_lng: number | null
          id: string
          language: string | null
          last_name: string | null
          phone: string | null
          production_place_number: string | null
          role: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          farm_name?: string | null
          first_name?: string | null
          full_name?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id: string
          language?: string | null
          last_name?: string | null
          phone?: string | null
          production_place_number?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          farm_name?: string | null
          first_name?: string | null
          full_name?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          language?: string | null
          last_name?: string | null
          phone?: string | null
          production_place_number?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      shearers: {
        Row: {
          active: boolean | null
          approved: boolean | null
          breed_specialties: string[] | null
          certified_by_farklipparforbundet: boolean | null
          created_at: string
          display_name: string
          email: string | null
          home_lat: number | null
          home_lng: number | null
          hourly_rate_sek: number | null
          id: string
          languages: string[] | null
          listed_by_faravelsforbundet: boolean | null
          notes: string | null
          phone: string | null
          self_managed: boolean | null
          service_areas: string[] | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          active?: boolean | null
          approved?: boolean | null
          breed_specialties?: string[] | null
          certified_by_farklipparforbundet?: boolean | null
          created_at?: string
          display_name: string
          email?: string | null
          home_lat?: number | null
          home_lng?: number | null
          hourly_rate_sek?: number | null
          id?: string
          languages?: string[] | null
          listed_by_faravelsforbundet?: boolean | null
          notes?: string | null
          phone?: string | null
          self_managed?: boolean | null
          service_areas?: string[] | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean | null
          approved?: boolean | null
          breed_specialties?: string[] | null
          certified_by_farklipparforbundet?: boolean | null
          created_at?: string
          display_name?: string
          email?: string | null
          home_lat?: number | null
          home_lng?: number | null
          hourly_rate_sek?: number | null
          id?: string
          languages?: string[] | null
          listed_by_faravelsforbundet?: boolean | null
          notes?: string | null
          phone?: string | null
          self_managed?: boolean | null
          service_areas?: string[] | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      sheep: {
        Row: {
          age_category: string | null
          breed: string | null
          breed_code: string | null
          created_at: string
          ear_tag_id: string | null
          id: string
          name: string | null
          owner_id: string
        }
        Insert: {
          age_category?: string | null
          breed?: string | null
          breed_code?: string | null
          created_at?: string
          ear_tag_id?: string | null
          id?: string
          name?: string | null
          owner_id: string
        }
        Update: {
          age_category?: string | null
          breed?: string | null
          breed_code?: string | null
          created_at?: string
          ear_tag_id?: string | null
          id?: string
          name?: string | null
          owner_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string | null
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          address: string
          classifications_count: number
          created_at: string
          email: string
          farm_name: string
          first_name: string
          full_name: string
          id: string
          is_admin: boolean
          last_name: string
          phone: string
          sheep_count: number
        }[]
      }
      admin_user_detail: { Args: { _user_id: string }; Returns: Json }
      breed_class_stats: {
        Args: never
        Returns: {
          breed_code: string
          n: number
          wool_class: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      nearest_shearers: {
        Args: {
          max_km?: number
          max_results?: number
          user_lat: number
          user_lng: number
        }
        Returns: {
          breed_specialties: string[]
          certified_by_farklipparforbundet: boolean
          display_name: string
          distance_km: number
          email: string
          hourly_rate_sek: number
          id: string
          languages: string[]
          listed_by_faravelsforbundet: boolean
          notes: string
          phone: string
          self_managed: boolean
          service_areas: string[]
          website: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
