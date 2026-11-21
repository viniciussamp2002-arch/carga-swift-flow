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
      agendamentos: {
        Row: {
          created_at: string
          data_agendada: string | null
          data_entrada: string | null
          data_solicitacao: string | null
          horario: string | null
          id: string
          nota_id: string
          observacoes: string | null
          protocolo: string | null
          solicitante: string | null
          status: Database["public"]["Enums"]["agendamento_status"]
          status_recebimento: Database["public"]["Enums"]["recebimento_cliente_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_agendada?: string | null
          data_entrada?: string | null
          data_solicitacao?: string | null
          horario?: string | null
          id?: string
          nota_id: string
          observacoes?: string | null
          protocolo?: string | null
          solicitante?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          status_recebimento?: Database["public"]["Enums"]["recebimento_cliente_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_agendada?: string | null
          data_entrada?: string | null
          data_solicitacao?: string | null
          horario?: string | null
          id?: string
          nota_id?: string
          observacoes?: string | null
          protocolo?: string | null
          solicitante?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          status_recebimento?: Database["public"]["Enums"]["recebimento_cliente_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: true
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      anexos_recebimento_assinados: {
        Row: {
          carga_entrada_id: string
          created_at: string
          id: string
          mime_type: string
          nome_arquivo: string
          recibo_id: string | null
          registrado_por: string | null
          registrado_por_nome: string | null
          relatorio_id: string | null
          storage_path: string
          versao: number
        }
        Insert: {
          carga_entrada_id: string
          created_at?: string
          id?: string
          mime_type: string
          nome_arquivo: string
          recibo_id?: string | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          relatorio_id?: string | null
          storage_path: string
          versao?: number
        }
        Update: {
          carga_entrada_id?: string
          created_at?: string
          id?: string
          mime_type?: string
          nome_arquivo?: string
          recibo_id?: string | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          relatorio_id?: string | null
          storage_path?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "anexos_recebimento_assinados_carga_entrada_id_fkey"
            columns: ["carga_entrada_id"]
            isOneToOne: false
            referencedRelation: "cargas_entrada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_recebimento_assinados_recibo_id_fkey"
            columns: ["recibo_id"]
            isOneToOne: false
            referencedRelation: "documentos_recebimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_recebimento_assinados_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_ocorrencias_recebimento"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_tentativas: {
        Row: {
          chave: string
          inicio: string
          quantidade: number
        }
        Insert: {
          chave: string
          inicio?: string
          quantidade?: number
        }
        Update: {
          chave?: string
          inicio?: string
          quantidade?: number
        }
        Relationships: []
      }
      calculos_frete: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          memoria: Json
          motivo: string
          nota_id: string
          situacao: string
          tabela_id: string | null
          total: number | null
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          memoria?: Json
          motivo?: string
          nota_id: string
          situacao: string
          tabela_id?: string | null
          total?: number | null
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          memoria?: Json
          motivo?: string
          nota_id?: string
          situacao?: string
          tabela_id?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calculos_frete_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculos_frete_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "tabelas_frete"
            referencedColumns: ["id"]
          },
        ]
      }
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
          situacao: string
          situacao_em: string | null
          situacao_motivo: string | null
          situacao_por: string | null
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
          situacao?: string
          situacao_em?: string | null
          situacao_motivo?: string | null
          situacao_por?: string | null
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
          situacao?: string
          situacao_em?: string | null
          situacao_motivo?: string | null
          situacao_por?: string | null
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
      cargas_entrada: {
        Row: {
          created_at: string
          created_by: string | null
          data_carregamento: string | null
          data_chegada: string | null
          fornecedor: string
          id: string
          motorista: string | null
          numero_transporte: string
          obs_recebimento: string | null
          observacoes: string | null
          placa: string | null
          previsao_chegada: string | null
          recebido_por: string | null
          recebido_por_nome: string | null
          situacao: string
          situacao_em: string | null
          situacao_motivo: string | null
          situacao_por: string | null
          status: Database["public"]["Enums"]["entrada_status"]
          transportadora: string
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_carregamento?: string | null
          data_chegada?: string | null
          fornecedor?: string
          id?: string
          motorista?: string | null
          numero_transporte?: string
          obs_recebimento?: string | null
          observacoes?: string | null
          placa?: string | null
          previsao_chegada?: string | null
          recebido_por?: string | null
          recebido_por_nome?: string | null
          situacao?: string
          situacao_em?: string | null
          situacao_motivo?: string | null
          situacao_por?: string | null
          status?: Database["public"]["Enums"]["entrada_status"]
          transportadora?: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_carregamento?: string | null
          data_chegada?: string | null
          fornecedor?: string
          id?: string
          motorista?: string | null
          numero_transporte?: string
          obs_recebimento?: string | null
          observacoes?: string | null
          placa?: string | null
          previsao_chegada?: string | null
          recebido_por?: string | null
          recebido_por_nome?: string | null
          situacao?: string
          situacao_em?: string | null
          situacao_motivo?: string | null
          situacao_por?: string | null
          status?: Database["public"]["Enums"]["entrada_status"]
          transportadora?: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargas_entrada_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists_recebimento: {
        Row: {
          carga_entrada_id: string
          created_at: string
          dados: Json
          id: string
          registrado_por: string | null
          registrado_por_nome: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          carga_entrada_id: string
          created_at?: string
          dados?: Json
          id?: string
          registrado_por?: string | null
          registrado_por_nome?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          carga_entrada_id?: string
          created_at?: string
          dados?: Json
          id?: string
          registrado_por?: string | null
          registrado_por_nome?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklists_recebimento_carga_entrada_id_fkey"
            columns: ["carga_entrada_id"]
            isOneToOne: true
            referencedRelation: "cargas_entrada"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_agendamento: {
        Row: {
          apelido: string
          ativo: boolean
          cnpj: string
          created_at: string
          id: string
          nome: string
          observacoes: string | null
        }
        Insert: {
          apelido?: string
          ativo?: boolean
          cnpj: string
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
        }
        Update: {
          apelido?: string
          ativo?: boolean
          cnpj?: string
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
        }
        Relationships: []
      }
      comprovantes: {
        Row: {
          capturado_em: string
          carga_id: string | null
          created_at: string
          data_entrega: string | null
          entrega_id: string | null
          id: string
          motivo_rejeicao: string | null
          motorista_id: string
          nota_envio_id: string | null
          nota_id: string | null
          observacoes_documento: string
          reconhecimento: Json
          revisado_em: string | null
          revisado_por: string | null
          revisado_por_nome: string | null
          status: string
          storage_path: string
          tipo_documento: string
          triagem: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capturado_em?: string
          carga_id?: string | null
          created_at?: string
          data_entrega?: string | null
          entrega_id?: string | null
          id: string
          motivo_rejeicao?: string | null
          motorista_id: string
          nota_envio_id?: string | null
          nota_id?: string | null
          observacoes_documento?: string
          reconhecimento?: Json
          revisado_em?: string | null
          revisado_por?: string | null
          revisado_por_nome?: string | null
          status?: string
          storage_path: string
          tipo_documento?: string
          triagem?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          capturado_em?: string
          carga_id?: string | null
          created_at?: string
          data_entrega?: string | null
          entrega_id?: string | null
          id?: string
          motivo_rejeicao?: string | null
          motorista_id?: string
          nota_envio_id?: string | null
          nota_id?: string | null
          observacoes_documento?: string
          reconhecimento?: Json
          revisado_em?: string | null
          revisado_por?: string | null
          revisado_por_nome?: string | null
          status?: string
          storage_path?: string
          tipo_documento?: string
          triagem?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comprovantes_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_nota_envio_id_fkey"
            columns: ["nota_envio_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracao_descarga: {
        Row: {
          chave: string
          favorecido: string
          pix: string
          tipo_chave: string
        }
        Insert: {
          chave?: string
          favorecido?: string
          pix?: string
          tipo_chave?: string
        }
        Update: {
          chave?: string
          favorecido?: string
          pix?: string
          tipo_chave?: string
        }
        Relationships: []
      }
      devolucao_alocacoes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          pallet_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          pallet_id: string
          quantidade: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          pallet_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "devolucao_alocacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_alocacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "devolucao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_alocacoes_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "devolucao_pallets"
            referencedColumns: ["id"]
          },
        ]
      }
      devolucao_itens: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string
          devolucao_id: string
          id: string
          item_numero: string
          lote: string
          motivo: string
          observacoes: string
          quantidade: number
          quantidade_original: number
          retorno_fisico: boolean
          unidade: string
          unidade_original: string
          validade: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao: string
          devolucao_id: string
          id?: string
          item_numero: string
          lote?: string
          motivo: string
          observacoes?: string
          quantidade: number
          quantidade_original: number
          retorno_fisico?: boolean
          unidade: string
          unidade_original: string
          validade?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string
          devolucao_id?: string
          id?: string
          item_numero?: string
          lote?: string
          motivo?: string
          observacoes?: string
          quantidade?: number
          quantidade_original?: number
          retorno_fisico?: boolean
          unidade?: string
          unidade_original?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devolucao_itens_devolucao_id_fkey"
            columns: ["devolucao_id"]
            isOneToOne: false
            referencedRelation: "devolucoes"
            referencedColumns: ["id"]
          },
        ]
      }
      devolucao_movimentos: {
        Row: {
          created_at: string
          data_movimento: string
          id: string
          item_id: string
          motivo: string
          observacoes: string
          pallet_id: string | null
          quantidade: number
          registrado_por: string | null
          reserva_id: string | null
          retirado_por: string
          tipo: string
          unidade: string
        }
        Insert: {
          created_at?: string
          data_movimento?: string
          id: string
          item_id: string
          motivo: string
          observacoes?: string
          pallet_id?: string | null
          quantidade: number
          registrado_por?: string | null
          reserva_id?: string | null
          retirado_por?: string
          tipo: string
          unidade: string
        }
        Update: {
          created_at?: string
          data_movimento?: string
          id?: string
          item_id?: string
          motivo?: string
          observacoes?: string
          pallet_id?: string | null
          quantidade?: number
          registrado_por?: string | null
          reserva_id?: string | null
          retirado_por?: string
          tipo?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "devolucao_movimentos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "devolucao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_movimentos_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "devolucao_pallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_movimentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_movimentos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "devolucao_reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      devolucao_pallets: {
        Row: {
          created_at: string
          created_by: string | null
          devolucao_id: string
          id: string
          localizacao: string
          numero: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          devolucao_id: string
          id?: string
          localizacao?: string
          numero: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          devolucao_id?: string
          id?: string
          localizacao?: string
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "devolucao_pallets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_pallets_devolucao_id_fkey"
            columns: ["devolucao_id"]
            isOneToOne: false
            referencedRelation: "devolucoes"
            referencedColumns: ["id"]
          },
        ]
      }
      devolucao_reservas: {
        Row: {
          coleta_ref: string | null
          created_at: string
          id: string
          item_id: string
          motivo: string
          pallet_id: string | null
          quantidade: number
          registrado_por: string | null
          status: string
          updated_at: string
        }
        Insert: {
          coleta_ref?: string | null
          created_at?: string
          id?: string
          item_id: string
          motivo: string
          pallet_id?: string | null
          quantidade: number
          registrado_por?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          coleta_ref?: string | null
          created_at?: string
          id?: string
          item_id?: string
          motivo?: string
          pallet_id?: string | null
          quantidade?: number
          registrado_por?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devolucao_reservas_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "devolucao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_reservas_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "devolucao_pallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_reservas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      devolucoes: {
        Row: {
          comprovante_id: string
          controle: number
          created_at: string
          created_by: string | null
          data_documento: string | null
          documental: string
          enviada_em: string | null
          enviada_por: string | null
          id: string
          nota_origem_id: string | null
          numero_nf: string
          observacoes: string
          prestacao: string
          updated_at: string
          versao: number
        }
        Insert: {
          comprovante_id: string
          controle?: never
          created_at?: string
          created_by?: string | null
          data_documento?: string | null
          documental?: string
          enviada_em?: string | null
          enviada_por?: string | null
          id?: string
          nota_origem_id?: string | null
          numero_nf?: string
          observacoes?: string
          prestacao?: string
          updated_at?: string
          versao?: number
        }
        Update: {
          comprovante_id?: string
          controle?: never
          created_at?: string
          created_by?: string | null
          data_documento?: string | null
          documental?: string
          enviada_em?: string | null
          enviada_por?: string | null
          id?: string
          nota_origem_id?: string | null
          numero_nf?: string
          observacoes?: string
          prestacao?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "devolucoes_comprovante_id_fkey"
            columns: ["comprovante_id"]
            isOneToOne: true
            referencedRelation: "comprovantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucoes_enviada_por_fkey"
            columns: ["enviada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucoes_nota_origem_id_fkey"
            columns: ["nota_origem_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      distancias: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cidade: string
          fonte: string
          ibge: string | null
          id: string
          km: number
          uf: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cidade: string
          fonte: string
          ibge?: string | null
          id?: string
          km: number
          uf: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cidade?: string
          fonte?: string
          ibge?: string | null
          id?: string
          km?: number
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "distancias_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_vinculos: {
        Row: {
          carga_id: string | null
          comprovante_id: string
          entrega_id: string | null
          id: string
          nota_id: string | null
        }
        Insert: {
          carga_id?: string | null
          comprovante_id: string
          entrega_id?: string | null
          id?: string
          nota_id?: string | null
        }
        Update: {
          carga_id?: string | null
          comprovante_id?: string
          entrega_id?: string | null
          id?: string
          nota_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_vinculos_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_vinculos_comprovante_id_fkey"
            columns: ["comprovante_id"]
            isOneToOne: false
            referencedRelation: "comprovantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_vinculos_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_vinculos_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_recebimento: {
        Row: {
          carga_entrada_id: string
          created_at: string
          dados: Json
          id: string
          registrado_por: string | null
          registrado_por_nome: string | null
          tipo: string
          versao: number
        }
        Insert: {
          carga_entrada_id: string
          created_at?: string
          dados: Json
          id?: string
          registrado_por?: string | null
          registrado_por_nome?: string | null
          tipo: string
          versao?: number
        }
        Update: {
          carga_entrada_id?: string
          created_at?: string
          dados?: Json
          id?: string
          registrado_por?: string | null
          registrado_por_nome?: string | null
          tipo?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_recebimento_carga_entrada_id_fkey"
            columns: ["carga_entrada_id"]
            isOneToOne: false
            referencedRelation: "cargas_entrada"
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
      financeiro: {
        Row: {
          ajuste: number
          calculo_id: string | null
          comprovante_id: string | null
          created_at: string
          data_entrega: string | null
          distancia: number | null
          entrega_id: string | null
          estado_frete: string
          fornecedor_id: string | null
          id: string
          nota_fiscal_id: string
          observacoes: string | null
          previsao: boolean
          regiao: string | null
          situacao: string
          updated_at: string
          valor_ad_valorem: number
          valor_base: number
          valor_desconto: number
          valor_frete: number
          valor_icms: number
          valor_pedagio: number
          valor_taxa_extra: number
          valor_tributos: number
        }
        Insert: {
          ajuste?: number
          calculo_id?: string | null
          comprovante_id?: string | null
          created_at?: string
          data_entrega?: string | null
          distancia?: number | null
          entrega_id?: string | null
          estado_frete?: string
          fornecedor_id?: string | null
          id?: string
          nota_fiscal_id: string
          observacoes?: string | null
          previsao?: boolean
          regiao?: string | null
          situacao?: string
          updated_at?: string
          valor_ad_valorem?: number
          valor_base?: number
          valor_desconto?: number
          valor_frete?: number
          valor_icms?: number
          valor_pedagio?: number
          valor_taxa_extra?: number
          valor_tributos?: number
        }
        Update: {
          ajuste?: number
          calculo_id?: string | null
          comprovante_id?: string | null
          created_at?: string
          data_entrega?: string | null
          distancia?: number | null
          entrega_id?: string | null
          estado_frete?: string
          fornecedor_id?: string | null
          id?: string
          nota_fiscal_id?: string
          observacoes?: string | null
          previsao?: boolean
          regiao?: string | null
          situacao?: string
          updated_at?: string
          valor_ad_valorem?: number
          valor_base?: number
          valor_desconto?: number
          valor_frete?: number
          valor_icms?: number
          valor_pedagio?: number
          valor_taxa_extra?: number
          valor_tributos?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_calculo_id_fkey"
            columns: ["calculo_id"]
            isOneToOne: false
            referencedRelation: "calculos_frete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comprovante_id_fkey"
            columns: ["comprovante_id"]
            isOneToOne: false
            referencedRelation: "comprovantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: true
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cidade: string | null
          cnpj: string
          contatos: string | null
          created_at: string
          desconto_percent: number
          endereco: string | null
          icms_percent: number
          id: string
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          pedagio: number
          taxa_extra: number
          tipo_calculo: string
          uf: string | null
          updated_at: string
          valor_base: number
          valor_minimo: number
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cnpj: string
          contatos?: string | null
          created_at?: string
          desconto_percent?: number
          endereco?: string | null
          icms_percent?: number
          id?: string
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          pedagio?: number
          taxa_extra?: number
          tipo_calculo?: string
          uf?: string | null
          updated_at?: string
          valor_base?: number
          valor_minimo?: number
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string
          contatos?: string | null
          created_at?: string
          desconto_percent?: number
          endereco?: string | null
          icms_percent?: number
          id?: string
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          pedagio?: number
          taxa_extra?: number
          tipo_calculo?: string
          uf?: string | null
          updated_at?: string
          valor_base?: number
          valor_minimo?: number
        }
        Relationships: []
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
      login_motoristas: {
        Row: {
          cpf: string
          email_interno: string
          user_id: string
        }
        Insert: {
          cpf: string
          email_interno: string
          user_id: string
        }
        Update: {
          cpf?: string
          email_interno?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_motoristas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      motoristas: {
        Row: {
          ativo: boolean
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
          user_id: string | null
          validade_cnh: string | null
        }
        Insert: {
          ativo?: boolean
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
          user_id?: string | null
          validade_cnh?: string | null
        }
        Update: {
          ativo?: boolean
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
          user_id?: string | null
          validade_cnh?: string | null
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          agendamento: boolean
          carga_entrada_id: string | null
          carga_id: string | null
          cfops: string[]
          chave_nfe: string | null
          chaves_agrupadas: string[]
          cidade: string
          cliente: string
          cnpj_destinatario: string | null
          cnpj_emissor: string | null
          created_at: string
          created_by: string | null
          data_chegada: string
          data_emissao: string | null
          data_limite: string | null
          destino_entrega_cidade: string | null
          destino_entrega_uf: string | null
          fornecedor: string
          grupo_importacao: string | null
          id: string
          itens_xml: Json
          numero: string
          numeros_agrupados: string[]
          observacoes: string | null
          origem: string
          peso: number
          peso_frete: number | null
          recebida: boolean
          recebida_em: string | null
          recebida_por: string | null
          recebida_por_nome: string | null
          regiao: string | null
          serie: string | null
          status: Database["public"]["Enums"]["nota_status"]
          tabela_frete_id: string | null
          uf: string | null
          updated_at: string
          valor: number
          volumes: number
        }
        Insert: {
          agendamento?: boolean
          carga_entrada_id?: string | null
          carga_id?: string | null
          cfops?: string[]
          chave_nfe?: string | null
          chaves_agrupadas?: string[]
          cidade?: string
          cliente?: string
          cnpj_destinatario?: string | null
          cnpj_emissor?: string | null
          created_at?: string
          created_by?: string | null
          data_chegada?: string
          data_emissao?: string | null
          data_limite?: string | null
          destino_entrega_cidade?: string | null
          destino_entrega_uf?: string | null
          fornecedor?: string
          grupo_importacao?: string | null
          id?: string
          itens_xml?: Json
          numero: string
          numeros_agrupados?: string[]
          observacoes?: string | null
          origem?: string
          peso?: number
          peso_frete?: number | null
          recebida?: boolean
          recebida_em?: string | null
          recebida_por?: string | null
          recebida_por_nome?: string | null
          regiao?: string | null
          serie?: string | null
          status?: Database["public"]["Enums"]["nota_status"]
          tabela_frete_id?: string | null
          uf?: string | null
          updated_at?: string
          valor?: number
          volumes?: number
        }
        Update: {
          agendamento?: boolean
          carga_entrada_id?: string | null
          carga_id?: string | null
          cfops?: string[]
          chave_nfe?: string | null
          chaves_agrupadas?: string[]
          cidade?: string
          cliente?: string
          cnpj_destinatario?: string | null
          cnpj_emissor?: string | null
          created_at?: string
          created_by?: string | null
          data_chegada?: string
          data_emissao?: string | null
          data_limite?: string | null
          destino_entrega_cidade?: string | null
          destino_entrega_uf?: string | null
          fornecedor?: string
          grupo_importacao?: string | null
          id?: string
          itens_xml?: Json
          numero?: string
          numeros_agrupados?: string[]
          observacoes?: string | null
          origem?: string
          peso?: number
          peso_frete?: number | null
          recebida?: boolean
          recebida_em?: string | null
          recebida_por?: string | null
          recebida_por_nome?: string | null
          regiao?: string | null
          serie?: string | null
          status?: Database["public"]["Enums"]["nota_status"]
          tabela_frete_id?: string | null
          uf?: string | null
          updated_at?: string
          valor?: number
          volumes?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_carga_entrada_id_fkey"
            columns: ["carga_entrada_id"]
            isOneToOne: false
            referencedRelation: "cargas_entrada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_tabela_frete_id_fkey"
            columns: ["tabela_frete_id"]
            isOneToOne: false
            referencedRelation: "tabelas_frete"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_dispensadas: {
        Row: {
          created_at: string
          evento_chave: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evento_chave: string
          user_id: string
        }
        Update: {
          created_at?: string
          evento_chave?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_dispensadas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencia_eventos: {
        Row: {
          acao: string
          anterior: Json | null
          atual: Json
          created_at: string
          id: string
          nota_id: string
          ocorrencia_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          anterior?: Json | null
          atual: Json
          created_at?: string
          id?: string
          nota_id: string
          ocorrencia_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          anterior?: Json | null
          atual?: Json
          created_at?: string
          id?: string
          nota_id?: string
          ocorrencia_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencia_eventos_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_eventos_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          anexo_path: string | null
          anexos_paths: string[]
          carga_entrada_id: string | null
          carga_id: string | null
          chave_nfe: string | null
          created_at: string
          data_ocorrencia: string
          descricao: string
          etapa: string
          id: string
          item_numero: string | null
          nota_id: string
          observacao_posterior: string
          origem: string
          produto_codigo: string | null
          produto_descricao: string | null
          quantidade: number | null
          quantidade_item: number | null
          registrado_por: string | null
          registrado_por_nome: string | null
          resolucao: string
          resolvida_em: string | null
          resolvida_por: string | null
          status: Database["public"]["Enums"]["ocorrencia_status"]
          tipo: Database["public"]["Enums"]["ocorrencia_tipo"]
          unidade: string | null
          updated_at: string
        }
        Insert: {
          anexo_path?: string | null
          anexos_paths?: string[]
          carga_entrada_id?: string | null
          carga_id?: string | null
          chave_nfe?: string | null
          created_at?: string
          data_ocorrencia?: string
          descricao?: string
          etapa?: string
          id?: string
          item_numero?: string | null
          nota_id: string
          observacao_posterior?: string
          origem?: string
          produto_codigo?: string | null
          produto_descricao?: string | null
          quantidade?: number | null
          quantidade_item?: number | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          resolucao?: string
          resolvida_em?: string | null
          resolvida_por?: string | null
          status?: Database["public"]["Enums"]["ocorrencia_status"]
          tipo: Database["public"]["Enums"]["ocorrencia_tipo"]
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          anexo_path?: string | null
          anexos_paths?: string[]
          carga_entrada_id?: string | null
          carga_id?: string | null
          chave_nfe?: string | null
          created_at?: string
          data_ocorrencia?: string
          descricao?: string
          etapa?: string
          id?: string
          item_numero?: string | null
          nota_id?: string
          observacao_posterior?: string
          origem?: string
          produto_codigo?: string | null
          produto_descricao?: string | null
          quantidade?: number | null
          quantidade_item?: number | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          resolucao?: string
          resolvida_em?: string | null
          resolvida_por?: string | null
          status?: Database["public"]["Enums"]["ocorrencia_status"]
          tipo?: Database["public"]["Enums"]["ocorrencia_tipo"]
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_carga_entrada_id_fkey"
            columns: ["carga_entrada_id"]
            isOneToOne: false
            referencedRelation: "cargas_entrada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
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
          status_acesso: string
          telefone: string | null
          tipo_acesso: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string
          status_acesso?: string
          telefone?: string | null
          tipo_acesso?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          status_acesso?: string
          telefone?: string | null
          tipo_acesso?: string
          updated_at?: string
        }
        Relationships: []
      }
      recibo_recebimento_eventos: {
        Row: {
          created_at: string
          id: string
          motivo: string
          recibo_id: string
          registrado_por: string | null
          registrado_por_nome: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          motivo: string
          recibo_id: string
          registrado_por?: string | null
          registrado_por_nome?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string
          recibo_id?: string
          registrado_por?: string | null
          registrado_por_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recibo_recebimento_eventos_recibo_id_fkey"
            columns: ["recibo_id"]
            isOneToOne: true
            referencedRelation: "documentos_recebimento"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_ocorrencia_vinculos: {
        Row: {
          ocorrencia_id: string
          relatorio_id: string
        }
        Insert: {
          ocorrencia_id: string
          relatorio_id: string
        }
        Update: {
          ocorrencia_id?: string
          relatorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_ocorrencia_vinculos_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_ocorrencia_vinculos_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_ocorrencias_recebimento"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_ocorrencias_recebimento: {
        Row: {
          carga_entrada_id: string
          created_at: string
          dados: Json
          id: string
          registrado_por: string | null
          registrado_por_nome: string | null
        }
        Insert: {
          carga_entrada_id: string
          created_at?: string
          dados: Json
          id?: string
          registrado_por?: string | null
          registrado_por_nome?: string | null
        }
        Update: {
          carga_entrada_id?: string
          created_at?: string
          dados?: Json
          id?: string
          registrado_por?: string | null
          registrado_por_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_ocorrencias_recebimento_carga_entrada_id_fkey"
            columns: ["carga_entrada_id"]
            isOneToOne: false
            referencedRelation: "cargas_entrada"
            referencedColumns: ["id"]
          },
        ]
      }
      tabelas_frete: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          fim: string | null
          fornecedor_id: string
          id: string
          inicio: string
          nome: string
          regras: Json
          versao: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          fim?: string | null
          fornecedor_id: string
          id?: string
          inicio: string
          nome: string
          regras: Json
          versao?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          fim?: string | null
          fornecedor_id?: string
          id?: string
          inicio?: string
          nome?: string
          regras?: Json
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_frete_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
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
          motorista_id: string | null
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
          motorista_id?: string | null
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
          motorista_id?: string | null
          observacoes?: string | null
          placa?: string
          situacao?: Database["public"]["Enums"]["veiculo_situacao"]
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ajustar_parametros_frete: {
        Args: {
          _cidade: string
          _motivo?: string
          _nota: string
          _peso: number
          _tabela?: string
          _uf: string
        }
        Returns: string
      }
      alocar_devolucao: {
        Args: {
          _item: string
          _local?: string
          _numero: number
          _quantidade: number
        }
        Returns: string
      }
      alterar_situacao_carga: {
        Args: { _acao: string; _id: string; _motivo: string; _tipo: string }
        Returns: Json
      }
      aprovar_comprovante: {
        Args: { _data_entrega: string; _id: string; _nota: string }
        Returns: string
      }
      calcular_descarga: { Args: { _linhas: Json }; Returns: Json }
      confirmar_chegada: {
        Args: {
          _carga: string
          _notas: string[]
          _obs: string
          _quando: string
        }
        Returns: Database["public"]["Enums"]["entrada_status"]
      }
      fechar_frete: {
        Args: {
          _ajuste?: number
          _estado: string
          _ids: string[]
          _motivo: string
        }
        Returns: undefined
      }
      gerenciar_acesso: {
        Args: {
          _motorista?: string
          _role: Database["public"]["Enums"]["app_role"]
          _status: string
          _user: string
        }
        Returns: undefined
      }
      inspecionar_carga: { Args: { _id: string; _tipo: string }; Returns: Json }
      liberar_reserva_devolucao: { Args: { _id: string }; Returns: undefined }
      limitar_acesso: { Args: { _chave: string }; Returns: boolean }
      movimentar_devolucao: {
        Args: {
          _dados?: Json
          _item: string
          _operacao: string
          _quantidade: number
          _tipo: string
        }
        Returns: string
      }
      prestar_contas_devolucao: { Args: { _id: string }; Returns: undefined }
      recalcular_frete: {
        Args: { _motivo: string; _nota: string }
        Returns: string
      }
      recuperar_itens_xml: {
        Args: { _chave: string; _itens: Json; _nota: string }
        Returns: undefined
      }
      rejeitar_comprovante: {
        Args: { _id: string; _motivo: string }
        Returns: undefined
      }
      reservar_devolucao: {
        Args: { _dados?: Json; _id: string; _item: string; _quantidade: number }
        Returns: string
      }
      reverter_aprovacao: {
        Args: { _id: string; _motivo: string }
        Returns: undefined
      }
      simular_frete: {
        Args: { _km?: number; _peso: number; _regras: Json; _valor: number }
        Returns: Json
      }
      simular_frete_cidade: {
        Args: { _cidade: string; _peso: number; _regras: Json; _valor: number }
        Returns: Json
      }
      tratar_devolucao: {
        Args: { _dados: Json; _documento: string }
        Returns: string
      }
      triar_documento: {
        Args: {
          _carga?: string
          _entrega?: string
          _id: string
          _nota?: string
          _obs: string
          _situacao: string
          _tipo: string
        }
        Returns: undefined
      }
    }
    Enums: {
      agendamento_status:
        | "nao_solicitado"
        | "solicitado"
        | "aguardando_confirmacao"
        | "confirmado"
        | "reagendado"
        | "cancelado"
      app_role:
        | "administrador"
        | "operacional"
        | "consulta"
        | "motorista"
        | "conferente"
        | "financeiro"
      carga_status: "separacao" | "carregamento" | "em_rota" | "finalizada"
      entrada_status:
        | "prevista"
        | "em_transito"
        | "recebida_parcial"
        | "recebida"
        | "cancelada"
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
      ocorrencia_status: "aberta" | "em_analise" | "resolvida"
      ocorrencia_tipo:
        | "falta"
        | "avaria"
        | "sobra"
        | "divergencia_volumes"
        | "outros"
        | "produto_vencido"
        | "produto_recusado"
        | "entrega_nao_realizada"
        | "devolucao"
        | "lacre_violado"
        | "divergencia_documental"
        | "produto_proximo_vencimento"
        | "divergencia_valor_item"
      recebimento_cliente_status:
        | "aguardando_entrada"
        | "entrada_realizada"
        | "entrada_recusada"
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
      agendamento_status: [
        "nao_solicitado",
        "solicitado",
        "aguardando_confirmacao",
        "confirmado",
        "reagendado",
        "cancelado",
      ],
      app_role: [
        "administrador",
        "operacional",
        "consulta",
        "motorista",
        "conferente",
        "financeiro",
      ],
      carga_status: ["separacao", "carregamento", "em_rota", "finalizada"],
      entrada_status: [
        "prevista",
        "em_transito",
        "recebida_parcial",
        "recebida",
        "cancelada",
      ],
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
      ocorrencia_status: ["aberta", "em_analise", "resolvida"],
      ocorrencia_tipo: [
        "falta",
        "avaria",
        "sobra",
        "divergencia_volumes",
        "outros",
        "produto_vencido",
        "produto_recusado",
        "entrega_nao_realizada",
        "devolucao",
        "lacre_violado",
        "divergencia_documental",
        "produto_proximo_vencimento",
        "divergencia_valor_item",
      ],
      recebimento_cliente_status: [
        "aguardando_entrada",
        "entrada_realizada",
        "entrada_recusada",
      ],
      veiculo_situacao: ["disponivel", "em_rota", "manutencao", "inativo"],
    },
  },
} as const
