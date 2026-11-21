export type StatusPonto = 'DISPONIVEL' | 'RESERVADO' | 'PAGO';
export type FormaPagamento = 'PIX' | 'DINHEIRO' | 'OUTRO';

export interface ConfiguracaoPublica {
  id: number;
  titulo: string;
  subtitulo: string;
  premio_descricao: string;
  valor_ponto: number;
  data_sorteio: string;
  pix_chave: string;
  pix_titular: string;
  pix_banco: string;
  whatsapp_comprovante: string;
  sorteio_numero: number | null;
  sorteio_ganhador_nome: string | null;
  sorteio_vendedor_nome: string | null;
  sorteio_realizado_em: string | null;
}

export interface Vendedor {
  id: number;
  slug: string;
  nome: string;
  ponto_inicio: number;
  ponto_fim: number;
  ordem: number;
}

export interface PontoPublico {
  numero: number;
  vendedor_id: number;
  status: StatusPonto;
  comprador_primeiro_nome: string | null;
  reservado_em: string | null;
  pago_em: string | null;
}

export interface PontoAdmin {
  numero: number;
  vendedor_id: number;
  status: StatusPonto;
  comprador_nome: string;
  comprador_whatsapp: string;
  comprador_endereco: string;
  forma_pagamento: FormaPagamento;
  observacao: string;
  reservado_em: string | null;
  pago_em: string | null;
  updated_at: string;
}

export interface ResultadoReserva {
  numeros: number[];
  quantidade: number;
  valor_total: number;
}

export interface ResultadoSorteio {
  numero: number;
  ganhador_nome: string;
  ganhador_whatsapp: string;
  vendedor_nome: string;
  total_elegiveis: number;
  realizado_em: string;
}