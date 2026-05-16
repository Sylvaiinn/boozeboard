export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      parties: {
        Row: {
          id: string;
          code: string;
          name: string;
          location: string | null;
          started_at: string;
          ended_at: string | null;
          status: "active" | "ended";
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          location?: string | null;
          started_at?: string;
          ended_at?: string | null;
          status?: "active" | "ended";
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          location?: string | null;
          started_at?: string;
          ended_at?: string | null;
          status?: "active" | "ended";
        };
      };
      participants: {
        Row: {
          id: string;
          party_id: string;
          name: string;
          emoji: string;
          weight_kg: number | null;
          sex: "M" | "F" | "other" | null;
          default_drink_id: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          party_id: string;
          name: string;
          emoji?: string;
          weight_kg?: number | null;
          sex?: "M" | "F" | "other" | null;
          default_drink_id?: string | null;
          joined_at?: string;
        };
        Update: {
          id?: string;
          party_id?: string;
          name?: string;
          emoji?: string;
          weight_kg?: number | null;
          sex?: "M" | "F" | "other" | null;
          default_drink_id?: string | null;
          joined_at?: string;
        };
      };
      drinks: {
        Row: {
          id: string;
          party_id: string | null;
          name: string;
          emoji: string;
          volume_cl: number;
          alcohol_pct: number;
          is_preset: boolean;
        };
        Insert: {
          id?: string;
          party_id?: string | null;
          name: string;
          emoji?: string;
          volume_cl: number;
          alcohol_pct: number;
          is_preset?: boolean;
        };
        Update: {
          id?: string;
          party_id?: string | null;
          name?: string;
          emoji?: string;
          volume_cl?: number;
          alcohol_pct?: number;
          is_preset?: boolean;
        };
      };
      drink_logs: {
        Row: {
          id: string;
          participant_id: string;
          drink_id: string;
          logged_at: string;
          note: string | null;
          round_id: string | null;
        };
        Insert: {
          id?: string;
          participant_id: string;
          drink_id: string;
          logged_at?: string;
          note?: string | null;
          round_id?: string | null;
        };
        Update: {
          id?: string;
          participant_id?: string;
          drink_id?: string;
          logged_at?: string;
          note?: string | null;
          round_id?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience types
export type Party = Database["public"]["Tables"]["parties"]["Row"];
export type Participant = Database["public"]["Tables"]["participants"]["Row"];
export type Drink = Database["public"]["Tables"]["drinks"]["Row"];
export type DrinkLog = Database["public"]["Tables"]["drink_logs"]["Row"];
