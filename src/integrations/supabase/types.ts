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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          acao: string
          antes: Json | null
          created_at: string
          depois: Json | null
          id: number
          registro_id: string | null
          tabela: string
          user_id: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          id?: number
          registro_id?: string | null
          tabela: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          id?: number
          registro_id?: string | null
          tabela?: string
          user_id?: string | null
        }
        Relationships: []
      }
      colaborador_historico: {
        Row: {
          colaborador_id: string
          created_at: string
          dados: Json | null
          descricao: string
          id: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          dados?: Json | null
          descricao: string
          id?: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          dados?: Json | null
          descricao?: string
          id?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_historico_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          arquivado: boolean
          cpf: string | null
          created_at: string
          data_admissao: string | null
          email: string | null
          endereco: string | null
          funcao_id: string | null
          id: string
          jornada: string | null
          matricula: string
          nome: string
          observacoes: string | null
          posto_id: string | null
          situacao: Database["public"]["Enums"]["colab_situacao"]
          supervisor_id: string | null
          telefone: string | null
          updated_at: string
          user_id: string | null
          vinculo: string | null
        }
        Insert: {
          arquivado?: boolean
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          email?: string | null
          endereco?: string | null
          funcao_id?: string | null
          id?: string
          jornada?: string | null
          matricula: string
          nome: string
          observacoes?: string | null
          posto_id?: string | null
          situacao?: Database["public"]["Enums"]["colab_situacao"]
          supervisor_id?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          vinculo?: string | null
        }
        Update: {
          arquivado?: boolean
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          email?: string | null
          endereco?: string | null
          funcao_id?: string | null
          id?: string
          jornada?: string | null
          matricula?: string
          nome?: string
          observacoes?: string | null
          posto_id?: string | null
          situacao?: Database["public"]["Enums"]["colab_situacao"]
          supervisor_id?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          vinculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_colaboradores: {
        Row: {
          colaborador_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          escala_id: string
          id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          escala_id: string
          id?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          escala_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_colaboradores_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_colaboradores_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas: {
        Row: {
          ativo: boolean
          created_at: string
          hora_fim: string
          hora_inicio: string
          id: string
          nome: string
          observacoes: string | null
          posto_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          nome: string
          observacoes?: string | null
          posto_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          nome?: string
          observacoes?: string | null
          posto_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias: {
        Row: {
          aprovado_por: string | null
          colaborador_id: string
          created_at: string
          data_fim: string
          data_inicio: string
          dias: number
          id: string
          observacoes: string | null
          periodo_aquisitivo_fim: string | null
          periodo_aquisitivo_inicio: string | null
          status: Database["public"]["Enums"]["ferias_status"]
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          colaborador_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
          dias: number
          id?: string
          observacoes?: string | null
          periodo_aquisitivo_fim?: string | null
          periodo_aquisitivo_inicio?: string | null
          status?: Database["public"]["Enums"]["ferias_status"]
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          colaborador_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          dias?: number
          id?: string
          observacoes?: string | null
          periodo_aquisitivo_fim?: string | null
          periodo_aquisitivo_inicio?: string | null
          status?: Database["public"]["Enums"]["ferias_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      funcoes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      ocorrencias: {
        Row: {
          colaborador_id: string | null
          created_at: string
          data_ocorrencia: string
          descricao: string | null
          gravidade: Database["public"]["Enums"]["ocorrencia_gravidade"]
          id: string
          posto_id: string | null
          registrado_por: string | null
          resolucao: string | null
          resolvida: boolean
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          data_ocorrencia?: string
          descricao?: string | null
          gravidade?: Database["public"]["Enums"]["ocorrencia_gravidade"]
          id?: string
          posto_id?: string | null
          registrado_por?: string | null
          resolucao?: string | null
          resolvida?: boolean
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          data_ocorrencia?: string
          descricao?: string | null
          gravidade?: Database["public"]["Enums"]["ocorrencia_gravidade"]
          id?: string
          posto_id?: string | null
          registrado_por?: string | null
          resolucao?: string | null
          resolvida?: boolean
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      postos: {
        Row: {
          ativo: boolean
          cidade: string | null
          cliente: string | null
          created_at: string
          efetivo_previsto: number
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          supervisor_id: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cliente?: string | null
          created_at?: string
          efetivo_previsto?: number
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          supervisor_id?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cliente?: string | null
          created_at?: string
          efetivo_previsto?: number
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          supervisor_id?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      presencas: {
        Row: {
          colaborador_id: string
          created_at: string
          data: string
          hora_entrada: string | null
          hora_saida: string | null
          id: string
          justificativa: string | null
          posto_id: string | null
          registrado_por: string | null
          status: Database["public"]["Enums"]["presenca_status"]
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          data: string
          hora_entrada?: string | null
          hora_saida?: string | null
          id?: string
          justificativa?: string | null
          posto_id?: string | null
          registrado_por?: string | null
          status?: Database["public"]["Enums"]["presenca_status"]
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          data?: string
          hora_entrada?: string | null
          hora_saida?: string | null
          id?: string
          justificativa?: string | null
          posto_id?: string | null
          registrado_por?: string | null
          status?: Database["public"]["Enums"]["presenca_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string
          email: string
          id: string
          last_access: string | null
          nome: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email?: string
          id: string
          last_access?: string | null
          nome?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string
          id?: string
          last_access?: string | null
          nome?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      system_initialized: { Args: never; Returns: boolean }
    }
    Enums: {
      account_status: "ativo" | "inativo" | "bloqueado"
      app_role: "admin" | "gestor" | "supervisor" | "rh" | "colaborador"
      colab_situacao: "ativo" | "ferias" | "afastado" | "desligado"
      ferias_status:
        | "solicitada"
        | "aprovada"
        | "em_gozo"
        | "concluida"
        | "recusada"
      ocorrencia_gravidade: "leve" | "moderada" | "grave"
      presenca_status:
        | "presente"
        | "falta"
        | "falta_justificada"
        | "atestado"
        | "folga"
        | "ferias"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: ["ativo", "inativo", "bloqueado"],
      app_role: ["admin", "gestor", "supervisor", "rh", "colaborador"],
      colab_situacao: ["ativo", "ferias", "afastado", "desligado"],
      ferias_status: [
        "solicitada",
        "aprovada",
        "em_gozo",
        "concluida",
        "recusada",
      ],
      ocorrencia_gravidade: ["leve", "moderada", "grave"],
      presenca_status: [
        "presente",
        "falta",
        "falta_justificada",
        "atestado",
        "folga",
        "ferias",
      ],
    },
  },
} as const
