'use client';

import React, { useMemo, useState } from 'react';
import {
  ConfiguracaoPublica,
  PontoPublico,
  StatusPonto,
  Vendedor,
} from '@/types/rifa';
import { formatarMoeda, formatarPonto } from '@/lib/formatadores';
import { gerarECompartilharImagemCartela } from '@/lib/geradorImagemCartela';

interface CartelaPublicaProps {
  config: ConfiguracaoPublica;
  vendedores: Vendedor[];
  pontos: PontoPublico[];
  vendedorUrlSlug: string | null;
  selecionados: number[];
  onAlternarPonto: (numero: number) => void;
  onLimparSelecao: () => void;
  onAbrirCheckout: () => void;
  onAbrirAdmin: () => void;
  onRecarregar: () => void;
  carregando: boolean;
}

export function CartelaPublica({
  config,
  vendedores,
  pontos,
  vendedorUrlSlug,
  selecionados,
  onAlternarPonto,
  onLimparSelecao,
  onAbrirCheckout,
  onAbrirAdmin,
  onRecarregar,
  carregando,
}: CartelaPublicaProps) {
  const vendedorDoLink = useMemo(() => {
    if (!vendedorUrlSlug) return null;
    const alvo = vendedorUrlSlug.toLowerCase().trim();
    return vendedores.find((v) => v.slug.toLowerCase() === alvo) ?? null;
  }, [vendedores, vendedorUrlSlug]);

  const [vendedorFiltroId, setVendedorFiltroId] = useState<number | 'TODOS'>(
    vendedorDoLink ? vendedorDoLink.id : 'TODOS'
  );
  const [statusFiltro, setStatusFiltro] = useState<StatusPonto | 'TODOS'>('TODOS');
  const [buscaNumero, setBuscaNumero] = useState('');

  const [gerandoImagem, setGerandoImagem] = useState(false);

const handleBaixarArte = async () => {
  setGerandoImagem(true);
  try {
    await gerarECompartilharImagemCartela({
      config,
      pontos,
      vendedor: vendedorAtivo,
    });
  } finally {
    setGerandoImagem(false);
  }
};

  // Sincroniza quando o link ?v=nome é detectado na carga inicial
  React.useEffect(() => {
    if (vendedorDoLink) {
      setVendedorFiltroId(vendedorDoLink.id);
    }
  }, [vendedorDoLink]);

  const vendedorAtivo = useMemo(
    () =>
      vendedorFiltroId === 'TODOS'
        ? null
        : vendedores.find((v) => v.id === vendedorFiltroId) ?? null,
    [vendedores, vendedorFiltroId]
  );

  const resumoGeral = useMemo(() => {
    const pagos = pontos.filter((p) => p.status === 'PAGO').length;
    const reservados = pontos.filter((p) => p.status === 'RESERVADO').length;
    const disponiveis = pontos.length - pagos - reservados;
    const percentual =
      pontos.length > 0 ? Math.round(((pagos + reservados) / pontos.length) * 100) : 0;
    return { pagos, reservados, disponiveis, percentual };
  }, [pontos]);

  const pontosFiltrados = useMemo(() => {
    const termo = buscaNumero.trim().replace(/\D/g, '');
    return pontos.filter((p) => {
      if (vendedorFiltroId !== 'TODOS' && p.vendedor_id !== vendedorFiltroId) {
        return false;
      }
      if (statusFiltro !== 'TODOS' && p.status !== statusFiltro) {
        return false;
      }
      if (termo) {
        const numStr = String(p.numero);
        const padStr = formatarPonto(p.numero);
        return numStr.includes(termo) || padStr.includes(termo);
      }
      return true;
    });
  }, [pontos, vendedorFiltroId, statusFiltro, buscaNumero]);

  const totalSelecionado = selecionados.length * config.valor_ponto;

  const tituloPartes = config.titulo.trim().split(' ');
  const primeiraPalavra = tituloPartes[0] || 'RIFA';
  const restoTitulo = tituloPartes.slice(1).join(' ') || 'SOLIDÁRIA';

  return (
    <div className="min-h-[100dvh] flex flex-col max-w-lg mx-auto px-4 pt-5 pb-32">
      {/* Barra Superior */}
      <header className="flex items-center justify-between gap-2 mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-amber-300">
            Sorteio • {config.data_sorteio}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRecarregar}
            disabled={carregando}
            title="Atualizar cartela"
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-sm flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={onAbrirAdmin}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-400/40 text-xs font-semibold text-zinc-200 cursor-pointer"
          >
            <span>🔒</span>
            <span>Organização</span>
          </button>
        </div>
      </header>

      {/* Banner de Ganhador (aparece automaticamente após o sorteio oficial) */}
      {config.sorteio_numero !== null && (
        <div className="mb-6 rounded-3xl bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-zinc-900 border border-amber-400/50 p-5 text-center shadow-lg shadow-amber-500/10">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-300">
            🏆 Sorteio Oficial Realizado
          </p>
          <div className="my-2 inline-flex items-center justify-center px-5 py-1.5 rounded-2xl bg-amber-400 text-zinc-950 font-display text-3xl font-black tracking-wider">
            Nº {formatarPonto(config.sorteio_numero)}
          </div>
          <p className="text-lg font-extrabold text-white mt-1">
            {config.sorteio_ganhador_nome}
          </p>
          <p className="text-xs text-amber-200/80 mt-0.5">
            Vendido por <strong>{config.sorteio_vendedor_nome}</strong> • Prêmio:{' '}
            {config.premio_descricao}
          </p>
        </div>
      )}

      {/* Hero */}
      <section className="text-center mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400/90 mb-1.5">
          {config.premio_descricao}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight leading-[1.06] text-white font-display">
          {primeiraPalavra}{' '}
          <span className="gold-gradient-text">{restoTitulo}</span>
        </h1>
        <p className="text-sm text-zinc-400 mt-2.5 max-w-xs mx-auto leading-relaxed">
          {config.subtitulo}
        </p>

        {/* Pílulas de Destaque */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/90 p-2.5">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
              Valor/Ponto
            </span>
            <span className="block text-sm font-extrabold text-amber-300 mt-0.5">
              {formatarMoeda(config.valor_ponto)}
            </span>
          </div>
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/90 p-2.5">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
              Prêmio
            </span>
            <span className="block text-sm font-extrabold text-emerald-400 mt-0.5">
              PIX R$ 100
            </span>
          </div>
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/90 p-2.5">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
              Disponíveis
            </span>
            <span className="block text-sm font-extrabold text-white mt-0.5">
              {resumoGeral.disponiveis}/{pontos.length}
            </span>
          </div>
        </div>
      </section>

      {/* Progresso da Rifa */}
      <section className="rounded-2xl bg-zinc-900/75 border border-zinc-800 p-3.5 mb-5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold text-zinc-300">
            Progresso da cartela ({resumoGeral.percentual}%)
          </span>
          <span className="text-zinc-400">
            <strong className="text-emerald-400">{resumoGeral.pagos}</strong> pagos •{' '}
            <strong className="text-amber-300">{resumoGeral.reservados}</strong> reservados
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden flex">
          <div
            className="h-full bg-emerald-400 transition-all duration-300"
            style={{
              width: `${pontos.length ? (resumoGeral.pagos / pontos.length) * 100 : 0}%`,
            }}
          />
          <div
            className="h-full bg-amber-400/80 transition-all duration-300"
            style={{
              width: `${
                pontos.length ? (resumoGeral.reservados / pontos.length) * 100 : 0
              }%`,
            }}
          />
        </div>
      </section>

      {/* Banner de Link Exclusivo de Vendedor */}
      {vendedorAtivo && (
        <div className="mb-4 rounded-2xl bg-amber-400/10 border border-amber-400/35 p-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Cartela de {vendedorAtivo.nome}
            </p>
            <p className="text-xs text-zinc-200 mt-0.5">
              Mostrando pontos{' '}
              <strong>
                {formatarPonto(vendedorAtivo.ponto_inicio)} a{' '}
                {formatarPonto(vendedorAtivo.ponto_fim)}
              </strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVendedorFiltroId('TODOS')}
            className="px-3 py-1.5 rounded-xl bg-zinc-950/80 border border-amber-400/30 text-[11px] font-bold text-amber-300 hover:bg-zinc-900 shrink-0 cursor-pointer"
          >
            Ver todos (175)
          </button>
        </div>
      )}

      {/* Filtros: Vendedor + Status + Busca de Número */}
      <section className="space-y-2.5 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={vendedorFiltroId}
            onChange={(e) =>
              setVendedorFiltroId(
                e.target.value === 'TODOS' ? 'TODOS' : Number(e.target.value)
              )
            }
            className="rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 px-3 py-2.5 text-xs font-semibold text-zinc-200 outline-none"
          >
            <option value="TODOS">Todos os vendedores (1–175)</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome} ({formatarPonto(v.ponto_inicio)}–{formatarPonto(v.ponto_fim)})
              </option>
            ))}
          </select>

          <input
            type="text"
            inputMode="numeric"
            value={buscaNumero}
            onChange={(e) => setBuscaNumero(e.target.value)}
            placeholder="Buscar nº (ex: 42)"
            className="rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 px-3 py-2.5 text-xs text-white placeholder:text-zinc-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              { id: 'TODOS', label: 'Todos' },
              { id: 'DISPONIVEL', label: 'Livres' },
              { id: 'RESERVADO', label: 'Reservados' },
              { id: 'PAGO', label: 'Pagos' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFiltro(f.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                statusFiltro === f.id
                  ? 'bg-amber-400 text-zinc-950 border-amber-400'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-400 mb-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-zinc-900 border border-zinc-600" />
          Livre
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          Selecionado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/25 border border-amber-500/50" />
          Reservado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/25 border border-emerald-500/50" />
          Pago
        </span>
      </div>

      {/* Grade de Pontos */}
      {pontosFiltrados.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-8 text-center text-xs text-zinc-400">
          Nenhum ponto encontrado com esse filtro.
        </div>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
          {pontosFiltrados.map((ponto) => {
            const selecionado = selecionados.includes(ponto.numero);
            const livre = ponto.status === 'DISPONIVEL';
            const reservado = ponto.status === 'RESERVADO';
            const pago = ponto.status === 'PAGO';

            return (
              <button
                key={ponto.numero}
                type="button"
                disabled={!livre || config.sorteio_numero !== null}
                onClick={() => onAlternarPonto(ponto.numero)}
                title={
                  livre
                    ? `Ponto ${formatarPonto(ponto.numero)} — Disponível`
                    : `${formatarPonto(ponto.numero)} — ${
                        pago ? 'Pago' : 'Reservado'
                      }${ponto.comprador_primeiro_nome ? ` (${ponto.comprador_primeiro_nome})` : ''}`
                }
                className={`relative rounded-xl py-2.5 px-1 border flex flex-col items-center justify-center transition-all ${
                  selecionado
                    ? 'bg-amber-400 border-amber-300 text-zinc-950 scale-[1.03] shadow-md shadow-amber-400/25 cursor-pointer'
                    : livre
                    ? 'bg-zinc-900/90 border-zinc-800 hover:border-amber-400/60 text-white cursor-pointer'
                    : pago
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300/75 cursor-not-allowed'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300/75 cursor-not-allowed'
                }`}
              >
                <span className="font-mono text-sm font-extrabold leading-none">
                  {formatarPonto(ponto.numero)}
                </span>
                <span
                  className={`text-[9px] mt-1 truncate max-w-full px-0.5 font-semibold ${
                    selecionado
                      ? 'text-zinc-950/80'
                      : livre
                      ? 'text-zinc-500'
                      : pago
                      ? 'text-emerald-400/80'
                      : 'text-amber-300/80'
                  }`}
                >
                  {selecionado
                    ? 'escolhido'
                    : livre
                    ? 'livre'
                    : ponto.comprador_primeiro_nome || (pago ? 'pago' : 'reserv.')}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Barra Flutuante Inferior de Checkout */}
      {selecionados.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent">
          <div className="max-w-lg mx-auto rounded-2xl bg-zinc-900 border border-amber-400/45 p-3.5 shadow-2xl shadow-black/80 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-amber-300">
                  {selecionados.length}{' '}
                  {selecionados.length === 1 ? 'ponto' : 'pontos'}
                </span>
                <button
                  type="button"
                  onClick={onLimparSelecao}
                  className="text-[10px] text-zinc-400 hover:text-red-300 underline cursor-pointer"
                >
                  Limpar
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                Nº {selecionados.map(formatarPonto).join(', ')}
              </p>
              <p className="text-base font-extrabold text-white leading-tight mt-0.5">
                {formatarMoeda(totalSelecionado)}
              </p>
            </div>

            <button
              type="button"
              onClick={onAbrirCheckout}
              className="gold-button px-5 py-3.5 rounded-xl font-extrabold text-xs sm:text-sm shrink-0 cursor-pointer"
            >
              Reservar e Pagar →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}