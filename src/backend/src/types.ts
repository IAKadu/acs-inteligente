export interface Equipe {
  equipe_id: string;
  endereco_latitude: number;
  endereco_longitude: number;
}

export interface Paciente {
  paciente_id: string;
  equipe_id: string;
  unidade_id: string;
  faixa_etaria: string;
  sexo: string;
  raca_cor: string;
  situacao_vulnerabilidade: number;
  endereco_latitude: number;
  endereco_longitude: number;
  hipertenso: number;
  diabetico: number;
  gestacao: number;
}

export interface Visita {
  id: number;
  profissional_id: string;
  registrados_em: string;
  ordem_visita_dia: number;
  paciente_id: string;
  origem: string;
}

export interface EventoClinico {
  id: number;
  paciente_id: string;
  tipo: 'agendamento' | 'urgencia-emergencia-ou-internacao';
  data_referencia: string;
}

export interface RegistroWhatsapp {
  id: number;
  whatsapp_msg_id: string;
  from_number: string;
  profissional_id: string | null;
  mensagem_texto: string;
  dados_extraidos: string | null;
  paciente_id: string | null;
  status: 'recebido' | 'processado' | 'falha';
  recebido_em: string;
  processado_em: string | null;
}

export interface Alerta {
  id: number;
  paciente_id: string;
  tipo: string;
  mensagem: string;
  prioridade: number;
  origem: string;
  criado_em: string;
  resolvido_em: string | null;
}

export type Prioridade = 'CRITICO' | 'URGENTE' | 'ATENCAO' | 'ROTINA';

export interface PacienteScore {
  paciente_id: string;
  score: number;
  fatores: string;
  justificativa: string | null;
  calculado_em: string;
  flag_invisivel: boolean;
  flag_crise_sem_vinculo: boolean;
  categoria_invisivel: 1 | 2 | 3 | null;
  prioridade: Prioridade | null;
}

export interface PacienteComScore extends Paciente {
  score: number;
  fatores: string[];
  justificativa: string | null;
  ultima_visita: string | null;
  flag_invisivel: boolean;
  flag_crise_sem_vinculo: boolean;
  categoria_invisivel: 1 | 2 | 3 | null;
  prioridade: Prioridade | null;
}
