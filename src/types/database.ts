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

// Convenience types
export type Party = Database["public"]["Tables"]["parties"]["Row"]
export type Participant = Database["public"]["Tables"]["participants"]["Row"]
export type Drink = Database["public"]["Tables"]["drinks"]["Row"]
export type DrinkLog = Database["public"]["Tables"]["drink_logs"]["Row"]
