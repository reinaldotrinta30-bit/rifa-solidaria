import { supabase } from '@/lib/supabase';
import {
  ConfiguracaoPublica,
  FormaPagamento,
  PontoAdmin,
  PontoPublico,
  ResultadoReserva,
  ResultadoSorteio,
  StatusPonto,
  Vendedor,
} from '@/types/rifa';
import { formatarPonto } from '@/lib/formatadores';

function extrairErro(err: unknown, padrao: string): Error {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message?: unknown }).message || '').trim();
    if (msg) return new Error(msg);
  }
  return new Error(padrao);
}

export interface SnapshotPublicoRifa {
  config: ConfiguracaoPublica;
  vendedores: Vendedor[];
  pontos: PontoPublico[];
}

export async function carregarDadosPublicos(): Promise<SnapshotPublicoRifa> {
  const [resConfig, resVendedores, resPontos] = await Promise.all([
    supabase.from('configuracoes_publico').select('*').single(),
    supabase.from('vendedores').select('*').order('ordem', { ascending: true }),
    supabase.from('pontos_publico').select('*').order('numero', { ascending: true }),
  ]);

  if (resConfig.error || !resConfig.data) {
    throw extrairErro(resConfig.error, 'Erro ao carregar configurações da rifa.');
  }
  if (resVendedores.error) {
    throw extrairErro(resVendedores.error, 'Erro ao carregar lista de vendedores.');
  }
  if (resPontos.error) {
    throw extrairErro(resPontos.error, 'Erro ao carregar a cartela de pontos.');
  }

  const rawConfig = resConfig.data as ConfiguracaoPublica;

  return {
    config: {
      ...rawConfig,
      valor_ponto: Number(rawConfig.valor_ponto) || 3,
    },
    vendedores: (resVendedores.data ?? []) as Vendedor[],
    pontos: (resPontos.data ?? []) as PontoPublico[],
  };
}

export async function reservarPontosPublico(params: {
  numeros: number[];
  nome: string;
  whatsapp: string;
  endereco: string;
}): Promise<ResultadoReserva> {
  const { data, error } = await supabase.rpc('reservar_pontos_publico', {
    p_numeros: params.numeros,
    p_nome: params.nome.trim(),
    p_whatsapp: params.whatsapp.trim(),
    p_endereco: params.endereco.trim(),
  });

  if (error || !data) {
    throw extrairErro(error, 'Não foi possível reservar os pontos selecionados.');
  }

  const res = data as ResultadoReserva;
  return {
    numeros: res.numeros ?? params.numeros,
    quantidade: Number(res.quantidade) || params.numeros.length,
    valor_total: Number(res.valor_total) || 0,
  };
}

export async function verificarPinRifa(pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verificar_pin_rifa', {
    p_pin: pin.trim(),
  });

  if (error) {
    throw extrairErro(error, 'Erro ao validar PIN da organização.');
  }

  return Boolean(data);
}

export async function verificarPinConfig(pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verificar_pin_config', {
    p_pin: pin.trim(),
  });

  if (error) {
    throw extrairErro(error, 'Erro ao validar senha da aba Configurações.');
  }

  return Boolean(data);
}

export async function adminCarregarPontos(pin: string): Promise<PontoAdmin[]> {
  const { data, error } = await supabase.rpc('admin_carregar_pontos', {
    p_pin: pin.trim(),
  });

  if (error) {
    throw extrairErro(error, 'Erro ao carregar dados completos dos pontos.');
  }

  return (data ?? []) as PontoAdmin[];
}

export async function adminSalvarPontos(params: {
  pin: string;
  numeros: number[];
  status: StatusPonto;
  nome?: string;
  whatsapp?: string;
  endereco?: string;
  forma_pagamento?: FormaPagamento;
  observacao?: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc('admin_salvar_pontos', {
    p_pin: params.pin.trim(),
    p_numeros: params.numeros,
    p_status: params.status,
    p_nome: params.nome?.trim() ?? '',
    p_whatsapp: params.whatsapp?.trim() ?? '',
    p_endereco: params.endereco?.trim() ?? '',
    p_forma_pagamento: params.forma_pagamento ?? 'PIX',
    p_observacao: params.observacao?.trim() ?? '',
  });

  if (error) {
    throw extrairErro(error, 'Erro ao atualizar os pontos.');
  }

  return Number(data) || 0;
}

export async function adminAtualizarConfig(params: {
  pin: string;
  titulo: string;
  subtitulo: string;
  data_sorteio: string;
  pix_chave: string;
  pix_titular: string;
  pix_banco: string;
  whatsapp_comprovante: string;
  novo_pin?: string;
}): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_atualizar_config', {
    p_pin: params.pin.trim(),
    p_titulo: params.titulo.trim(),
    p_subtitulo: params.subtitulo.trim(),
    p_data_sorteio: params.data_sorteio.trim(),
    p_pix_chave: params.pix_chave.trim(),
    p_pix_titular: params.pix_titular.trim(),
    p_pix_banco: params.pix_banco.trim(),
    p_whatsapp_comprovante: params.whatsapp_comprovante.trim(),
    p_novo_pin: params.novo_pin?.trim() || null,
  });

  if (error) {
    throw extrairErro(error, 'Erro ao salvar configurações.');
  }

  return Boolean(data);
}

export async function adminRealizarSorteio(
  pin: string,
  apenasPagos = true
): Promise<ResultadoSorteio> {
  const { data, error } = await supabase.rpc('admin_realizar_sorteio', {
    p_pin: pin.trim(),
    p_apenas_pagos: apenasPagos,
  });

  if (error || !data) {
    throw extrairErro(error, 'Não foi possível realizar o sorteio.');
  }

  return data as ResultadoSorteio;
}

export async function adminLimparSorteio(pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_limpar_sorteio', {
    p_pin: pin.trim(),
  });

  if (error) {
    throw extrairErro(error, 'Erro ao limpar resultado do sorteio.');
  }

  return Boolean(data);
}

export async function adminPopularTeste(pin: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_popular_teste', {
    p_pin: pin.trim(),
  });
  if (error) {
    throw extrairErro(error, 'Erro ao gerar dados fictícios de teste.');
  }
  return Number((data as { criados?: number })?.criados) || 0;
}

export async function adminSimularSorteioTeste(
  pin: string
): Promise<ResultadoSorteio> {
  const { data, error } = await supabase.rpc('admin_simular_sorteio_teste', {
    p_pin: pin.trim(),
  });
  if (error || !data) {
    throw extrairErro(error, 'Erro ao simular sorteio de teste.');
  }
  return data as ResultadoSorteio;
}

export async function adminLimparTeste(pin: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_limpar_teste', {
    p_pin: pin.trim(),
  });
  if (error) {
    throw extrairErro(error, 'Erro ao limpar dados de teste.');
  }
  return Number((data as { removidos?: number })?.removidos) || 0;
}

export function exportarCsvRifa(
  pontos: PontoAdmin[],
  vendedores: Vendedor[],
  valorPonto: number
): void {
  const mapaVendedor = new Map(vendedores.map((v) => [v.id, v.nome]));
  const cabecalho = [
    'Ponto',
    'Vendedor',
    'Status',
    'Valor',
    'Comprador',
    'WhatsApp',
    'Endereco',
    'Pagamento',
    'Observacao',
  ];

  const escapar = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const linhas = pontos.map((p) => [
    formatarPonto(p.numero),
    mapaVendedor.get(p.vendedor_id) ?? '',
    p.status,
    p.status === 'DISPONIVEL' ? '0.00' : valorPonto.toFixed(2),
    p.comprador_nome,
    p.comprador_whatsapp,
    p.comprador_endereco,
    p.status === 'DISPONIVEL' ? '' : p.forma_pagamento,
    p.observacao,
  ]);

  const conteudo =
    '\uFEFF' +
    [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(';')).join('\n');

  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rifa-solidaria-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}