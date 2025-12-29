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
      appointments: {
        Row: {
          created_at: string | null
          custom_reason: string | null
          doctor_id: string
          duration_minutes: number
          google_calendar_event_id: string | null
          id: string
          patient_id: string
          rejection_reason: string | null
          service_id: string | null
          source: string | null
          start_date_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_reason?: string | null
          doctor_id: string
          duration_minutes?: number
          google_calendar_event_id?: string | null
          id?: string
          patient_id: string
          rejection_reason?: string | null
          service_id?: string | null
          source?: string | null
          start_date_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_reason?: string | null
          doctor_id?: string
          duration_minutes?: number
          google_calendar_event_id?: string | null
          id?: string
          patient_id?: string
          rejection_reason?: string | null
          service_id?: string | null
          source?: string | null
          start_date_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_days: {
        Row: {
          blocked_date: string
          created_at: string
          doctor_id: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          doctor_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          doctor_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_days_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor: {
        Row: {
          ai_enabled: boolean | null
          created_at: string | null
          first_name: string
          google_calendar_id: string | null
          google_sheet_id: string | null
          id: string
          interface_language:
            | Database["public"]["Enums"]["interface_language"]
            | null
          last_name: string
          llm_api_base_url: string | null
          llm_api_key: string | null
          llm_model_name: string | null
          slot_step_minutes: number | null
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          updated_at: string | null
          user_id: string | null
          work_day_end_time: string | null
          work_day_start_time: string | null
          work_days: Database["public"]["Enums"]["day_of_week"][] | null
        }
        Insert: {
          ai_enabled?: boolean | null
          created_at?: string | null
          first_name: string
          google_calendar_id?: string | null
          google_sheet_id?: string | null
          id?: string
          interface_language?:
            | Database["public"]["Enums"]["interface_language"]
            | null
          last_name: string
          llm_api_base_url?: string | null
          llm_api_key?: string | null
          llm_model_name?: string | null
          slot_step_minutes?: number | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_day_end_time?: string | null
          work_day_start_time?: string | null
          work_days?: Database["public"]["Enums"]["day_of_week"][] | null
        }
        Update: {
          ai_enabled?: boolean | null
          created_at?: string | null
          first_name?: string
          google_calendar_id?: string | null
          google_sheet_id?: string | null
          id?: string
          interface_language?:
            | Database["public"]["Enums"]["interface_language"]
            | null
          last_name?: string
          llm_api_base_url?: string | null
          llm_api_key?: string | null
          llm_model_name?: string | null
          slot_step_minutes?: number | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_day_end_time?: string | null
          work_day_start_time?: string | null
          work_days?: Database["public"]["Enums"]["day_of_week"][] | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          created_at: string | null
          first_name: string
          id: string
          language: Database["public"]["Enums"]["interface_language"] | null
          last_name: string | null
          phone_number: string | null
          telegram_user_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          first_name: string
          id?: string
          language?: Database["public"]["Enums"]["interface_language"] | null
          last_name?: string | null
          phone_number?: string | null
          telegram_user_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          first_name?: string
          id?: string
          language?: Database["public"]["Enums"]["interface_language"] | null
          last_name?: string | null
          phone_number?: string | null
          telegram_user_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          appointment_id: string
          id: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          sent_at: string | null
        }
        Insert: {
          appointment_id: string
          id?: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          sent_at?: string | null
        }
        Update: {
          appointment_id?: string
          id?: string
          reminder_type?: Database["public"]["Enums"]["reminder_type"]
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string | null
          default_duration_minutes: number
          doctor_id: string
          id: string
          is_active: boolean | null
          name_arm: string
          name_ru: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_duration_minutes?: number
          doctor_id: string
          id?: string
          is_active?: boolean | null
          name_arm: string
          name_ru: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_duration_minutes?: number
          doctor_id?: string
          id?: string
          is_active?: boolean | null
          name_arm?: string
          name_ru?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_sessions: {
        Row: {
          created_at: string
          custom_reason: string | null
          duration_minutes: number | null
          language: Database["public"]["Enums"]["interface_language"] | null
          patient_id: string | null
          selected_date: string | null
          selected_time: string | null
          service_id: string | null
          step: string
          telegram_user_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_reason?: string | null
          duration_minutes?: number | null
          language?: Database["public"]["Enums"]["interface_language"] | null
          patient_id?: string | null
          selected_date?: string | null
          selected_time?: string | null
          service_id?: string | null
          step?: string
          telegram_user_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_reason?: string | null
          duration_minutes?: number | null
          language?: Database["public"]["Enums"]["interface_language"] | null
          patient_id?: string | null
          selected_date?: string | null
          selected_time?: string | null
          service_id?: string | null
          step?: string
          telegram_user_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_sessions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_doctor_id_for_user: { Args: { _user_id: string }; Returns: string }
      is_doctor_owner: { Args: { _doctor_id: string }; Returns: boolean }
    }
    Enums: {
      appointment_status:
        | "PENDING"
        | "CONFIRMED"
        | "REJECTED"
        | "CANCELLED_BY_DOCTOR"
      day_of_week:
        | "MONDAY"
        | "TUESDAY"
        | "WEDNESDAY"
        | "THURSDAY"
        | "FRIDAY"
        | "SATURDAY"
        | "SUNDAY"
      interface_language: "ARM" | "RU"
      reminder_type: "BEFORE_24H" | "BEFORE_2H"
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
      appointment_status: [
        "PENDING",
        "CONFIRMED",
        "REJECTED",
        "CANCELLED_BY_DOCTOR",
      ],
      day_of_week: [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ],
      interface_language: ["ARM", "RU"],
      reminder_type: ["BEFORE_24H", "BEFORE_2H"],
    },
  },
} as const
