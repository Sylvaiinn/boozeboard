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
      drink_logs: {
        Row: {
          drink_id: string
          id: string
          logged_at: string | null
          note: string | null
          participant_id: string
          round_id: string | null
        }
        Insert: {
          drink_id: string
          id?: string
          logged_at?: string | null
          note?: string | null
          participant_id: string
          round_id?: string | null
        }
        Update: {
          drink_id?: string
          id?: string
          logged_at?: string | null
          note?: string | null
          participant_id?: string
          round_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drink_logs_drink_id_fkey"
            columns: ["drink_id"]
            isOneToOne: false
            referencedRelation: "drinks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drink_logs_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      drinks: {
        Row: {
          alcohol_pct: number
          emoji: string | null
          id: string
          is_preset: boolean | null
          name: string
          party_id: string | null
          volume_cl: number
        }
        Insert: {
          alcohol_pct: number
          emoji?: string | null
          id?: string
          is_preset?: boolean | null
          name: string
          party_id?: string | null
          volume_cl: number
        }
        Update: {
          alcohol_pct?: number
          emoji?: string | null
          id?: string
          is_preset?: boolean | null
          name?: string
          party_id?: string | null
          volume_cl?: number
        }
        Relationships: [
          {
            foreignKeyName: "drinks_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          default_drink_id: string | null
          emoji: string | null
          id: string
          joined_at: string | null
          name: string
          party_id: string
          photo_url: string | null
          sex: string | null
          weight_kg: number | null
        }
        Insert: {
          default_drink_id?: string | null
          emoji?: string | null
          id?: string
          joined_at?: string | null
          name: string
          party_id: string
          photo_url?: string | null
          sex?: string | null
          weight_kg?: number | null
        }
        Update: {
          default_drink_id?: string | null
          emoji?: string | null
          id?: string
          joined_at?: string | null
          name?: string
          party_id?: string
          photo_url?: string | null
          sex?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_default_drink"
            columns: ["default_drink_id"]
            isOneToOne: false
            referencedRelation: "drinks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          code: string
          ended_at: string | null
          id: string
          location: string | null
          name: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          code: string
          ended_at?: string | null
          id?: string
          location?: string | null
          name: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          code?: string
          ended_at?: string | null
          id?: string
          location?: string | null
          name?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      vomit_logs: {
        Row: {
          id: string
          logged_at: string | null
          participant_id: string
          photo_url: string
        }
        Insert: {
          id?: string
          logged_at?: string | null
          participant_id: string
          photo_url: string
        }
        Update: {
          id?: string
          logged_at?: string | null
          participant_id?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "vomit_logs_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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

// Convenience types
export type Party = Database["public"]["Tables"]["parties"]["Row"]
export type Participant = Database["public"]["Tables"]["participants"]["Row"]
export type Drink = Database["public"]["Tables"]["drinks"]["Row"]
export type DrinkLog = Database["public"]["Tables"]["drink_logs"]["Row"]
export type VomitLog = Database["public"]["Tables"]["vomit_logs"]["Row"]
