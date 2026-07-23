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
      cargas: {
        Row: {
          created_at: string
          created_by: string | null
          data_finalizacao: string | null
          data_prevista_saida: string | null
          data_saida: string | null
          id: string
          motorista_id: string | null
          numero: number
          observacoes: string | null
          status: Database["public"]["Enums"]["carga_status"]
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_finalizacao?: string | null
          data_prevista_saida?: string | null
          data_saida?: string | null
          id?: string
          motorista_id?: string | null
          numero?: number
          observacoes?: string | null
          status?: Database["public"]["Enums"]["carga_status"]
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_finalizacao?: string | null
          data_prevista_saida?: string | null
          data_saida?: string | null
          id?: string
          motorista_id?: string | null
          numero?: number
          observacoes?: string | null
          status?: Database["public"]["Enums"]["carga_status"]
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          carga_id: string | null
          created_at: string
          data_evento: string
          id: string
          motivo: string | null
          nota_id: string
          observacao: string | null
          registrado_por: string | null
          resultado: Database["public"]["Enums"]["entrega_resultado"]
        }
        Insert: {
          carga_id?: string | null
          created_at?: string
          data_evento?: string
          id?: string
          motivo?: string | null
          nota_id: string
          observacao?: string | null
          registrado_por?: string | null
          resultado: Database["public"]["Enums"]["entrega_resultado"]
        }
        Update: {
          carga_id?: string | null
          created_at?: string
          data_evento?: string
          id?: string
          motivo?: string | null
          nota_id?: string
          observacao?: string | null
          registrado_por?: string | null
          resultado?: Database["public"]["Enums"]["entrega_resultado"]
        }
        Relationships: [
          {
            foreignKeyName: "entregas_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      historico: {
        Row: {
          acao: string
          created_at: string
          descricao: string
          entidade: string
          entidade_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          descricao: string
          entidade: string
          entidade_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string
          entidade?: string
          entidade_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      motoristas: {
        Row: {
          categoria: string | null
          cnh: string | null
          cpf: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          situacao: Database["public"]["Enums"]["motorista_situacao"]
          telefone: string | null
          updated_at: string
          validade_cnh: string | null
        }
        Insert: {
          categoria?: string | null
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          situacao?: Database["public"]["Enums"]["motorista_situacao"]
          telefone?: string | null
          updated_at?: string
          validade_cnh?: string | null
        }
        Update: {
          categoria?: string | null
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          situacao?: Database["public"]["Enums"]["motorista_situacao"]
          telefone?: string | null
          updated_at?: string
          validade_cnh?: string | null
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          agendamento: boolean
          carga_id: string | null
          chave_nfe: string | null
          cidade: string
          cliente: string
          cnpj_destinatario: string | null
          cnpj_emissor: string | null
          created_at: string
          created_by: string | null
          data_emissao: string | null
          fornecedor: string
          id: string
          numero: string
          observacoes: string | null
          origem: string
          peso: number
          regiao: string | null
          serie: string | null
          status: Database["public"]["Enums"]["nota_status"]
          uf: string | null
          updated_at: string
          valor: number
          volumes: number
        }
        Insert: {
          agendamento?: boolean
          carga_id?: string | null
          chave_nfe?: string | null
          cidade?: string
          cliente?: string
          cnpj_destinatario?: string | null
          cnpj_emissor?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          fornecedor?: string
          id?: string
          numero: string
          observacoes?: string | null
          origem?: string
          peso?: number
          regiao?: string | null
          serie?: string | null
          status?: Database["public"]["Enums"]["nota_status"]
          uf?: string | null
          updated_at?: string
          valor?: number
          volumes?: number
        }
        Update: {
          agendamento?: boolean
          carga_id?: string | null
          chave_nfe?: string | null
          cidade?: string
          cliente?: string
          cnpj_destinatario?: string | null
          cnpj_emissor?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          fornecedor?: string
          id?: string
          numero?: string
          observacoes?: string | null
          origem?: string
          peso?: number
          regiao?: string | null
          serie?: string | null
          status?: Database["public"]["Enums"]["nota_status"]
          uf?: string | null
          updated_at?: string
          valor?: number
          volumes?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          ano: number | null
          capacidade_kg: number
          created_at: string
          id: string
          marca: string
          modelo: string
          observacoes: string | null
          placa: string
          situacao: Database["public"]["Enums"]["veiculo_situacao"]
          tipo: string
          updated_at: string
        }
        Insert: {
          ano?: number | null
          capacidade_kg?: number
          created_at?: string
          id?: string
          marca?: string
          modelo?: string
          observacoes?: string | null
          placa: string
          situacao?: Database["public"]["Enums"]["veiculo_situacao"]
          tipo?: string
          updated_at?: string
        }
        Update: {
          ano?: number | null
          capacidade_kg?: number
          created_at?: string
          id?: string
          marca?: string
          modelo?: string
          observacoes?: string | null
          placa?: string
          situacao?: Database["public"]["Enums"]["veiculo_situacao"]
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "administrador" | "operacional" | "consulta"
      carga_status: "separacao" | "carregamento" | "em_rota" | "finalizada"
      entrega_resultado: "entregue" | "nao_entregue" | "devolvida"
      motorista_situacao: "disponivel" | "em_viagem" | "ferias" | "afastado"
      nota_status:
        | "disponivel"
        | "separacao"
        | "carregamento"
        | "em_rota"
        | "entregue"
        | "nao_entregue"
        | "devolvida"
      veiculo_situacao: "disponivel" | "em_rota" | "manutencao" | "inativo"
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
      app_role: ["administrador", "operacional", "consulta"],
      carga_status: ["separacao", "carregamento", "em_rota", "finalizada"],
      entrega_resultado: ["entregue", "nao_entregue", "devolvida"],
      motorista_situacao: ["disponivel", "em_viagem", "ferias", "afastado"],
      nota_status: [
        "disponivel",
        "separacao",
        "carregamento",
        "em_rota",
        "entregue",
        "nao_entregue",
        "devolvida",
      ],
      veiculo_situacao: ["disponivel", "em_rota", "manutencao", "inativo"],
    },
  },
} as const
