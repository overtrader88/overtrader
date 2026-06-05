/**
 * Tipos do banco Supabase.
 * Para regenerar após mudanças no schema:
 *   npx supabase gen types typescript --local > types/database.ts
 */

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
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          plan: "free" | "mensal" | "pro_anual" | "vip" | null;
          plan_active_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: "free" | "mensal" | "pro_anual" | "vip" | null;
          plan_active_until?: string | null;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: "free" | "mensal" | "pro_anual" | "vip" | null;
          plan_active_until?: string | null;
        };
      };
      user_credits: {
        Row: {
          user_id: string;
          credits_simple: number;
          credits_pro: number;
          total_used: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          credits_simple?: number;
          credits_pro?: number;
          total_used?: number;
        };
        Update: {
          credits_simple?: number;
          credits_pro?: number;
          total_used?: number;
        };
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: "purchase" | "consume" | "bonus" | "refund";
          amount_pro: number;
          amount_simple: number;
          source: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          type: "purchase" | "consume" | "bonus" | "refund";
          amount_pro?: number;
          amount_simple?: number;
          source?: string | null;
          metadata?: Json | null;
        };
        Update: never;
      };
      analyses: {
        Row: {
          id: string;
          user_id: string;
          asset_type: "crypto" | "forex" | "stocks" | "indices" | "commodities";
          asset: string;
          timeframe: string;
          analysis_type: "simple" | "complete";
          signal: "STRONG_BUY" | "BUY" | "WEAK_BUY" | "NEUTRAL" | "WEAK_SELL" | "SELL" | "STRONG_SELL" | null;
          strength: number | null;
          confluence: number | null;
          entry: number | null;
          stop_loss: number | null;
          take_profit_1: number | null;
          take_profit_2: number | null;
          take_profit_3: number | null;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          asset_type: "crypto" | "forex" | "stocks" | "indices" | "commodities";
          asset: string;
          timeframe: string;
          analysis_type: "simple" | "complete";
          signal?: "STRONG_BUY" | "BUY" | "WEAK_BUY" | "NEUTRAL" | "WEAK_SELL" | "SELL" | "STRONG_SELL" | null;
          strength?: number | null;
          confluence?: number | null;
          entry?: number | null;
          stop_loss?: number | null;
          take_profit_1?: number | null;
          take_profit_2?: number | null;
          take_profit_3?: number | null;
          payload?: Json | null;
        };
        Update: never;
      };
      waitlist: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          source: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          referrer: string | null;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          email: string;
          name?: string | null;
          source?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          referrer?: string | null;
          ip_hash?: string | null;
        };
        Update: never;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserCredits = Database["public"]["Tables"]["user_credits"]["Row"];
export type Analysis = Database["public"]["Tables"]["analyses"]["Row"];
export type WaitlistEntry = Database["public"]["Tables"]["waitlist"]["Row"];
