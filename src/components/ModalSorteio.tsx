'use client';

import React, { useMemo, useState } from 'react';
import {
  ConfiguracaoPublica,
  PontoAdmin,
  ResultadoSorteio,
} from '@/types/rifa';
import {
  formatarDataHoraBR,
  formatarPonto,
  gerarLinkWhatsApp,
} from '@/lib/formatadores';
import { adminLimparSorteio, adminRealizarSorteio } from '@/lib/rifaService';

interface ModalSorteioProps {
  adminPin: string;
  config: ConfiguracaoPublica;
  pontos: PontoAdmin[];
  onAtualizar: () => Promise<void>;
}

export function ModalSorteio({
  adminPin,
  config,
  pontos,
  onAtualizar,
}: ModalSorteioProps) {
  const [apenasPagos, setApenasPagos] = useState(true);
  const [sorteando, setSorteando] = useState(false);
  const [numeroRoleta, setNumeroRoleta] = useState<number | null>(null);
  const [resultadoRecente, setResultadoRecente] = useState<ResultadoSorteio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [limpando, setLimpando] = useState(false);

  const pontosPagos = useMemo(
    () => pontos.filter((p) => p.status === 'PAGO'),
    [pontos]
  );
  const pontosReservados = useMemo(
    () => pontos.filter((p) => p.status === 'RESERVADO'),
    [pontos]
  );

  const elegiveis = useMemo(
    () => (apenasPagos ? pontosPagos : [...pontosPagos, ...pontosReservados]),
    [apenasPagos, pontosPagos, pontosReservados]
  );

  const pontoVencedorAtual = useMemo(() => {
    const num = resultadoRecente?.numero ?? config.sorteio_numero;
    if (!num) return null;
    return pontos.find((p) => p.numero === num) ?? null;
  }, [resultadoRecente, config.sorteio_numero, pontos]);

  const handleSortear = async () => {
    setErro(null);
    if (elegiveis.length === 0) {
      setErro('Não há pontos elegíveis (pagos) para realizar o sorteio.');
      return;
    }

    if (
      config.sorteio_numero !== null &&
      !window.confirm('Já existe um sorteio registrado. Deseja realizar um novo sorteio?')
    ) {
      return;
    }

    setSorteando(true);
    setResultadoRecente(null);

    // Animação da roleta por 3 segundos enquanto busca o sorteio oficial no banco
    const intervalo = window.setInterval(() => {
      const idx = Math.floor(Math.random() * elegiveis.length);
      setNumeroRoleta(elegiveis[idx].numero);
    }, 80);

    try {
      const [res] = await Promise.all([
        adminRealizarSorteio(adminPin, apenasPagos),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      window.clearInterval(intervalo);
      setNumeroRoleta(res.numero);
      setResultadoRecente(res);
      await onAtualizar();
    } catch (err) {
      window.clearInterval(intervalo);
      setNumeroRoleta(null);
      setErro(err instanceof Error ? err.message : 'Erro ao executar o sorteio.');
    } finally {
      setSorteando(false);
    }
  };

  const handleLimpar = async () => {
    if (
      !window.confirm(
        'Deseja limpar o resultado do sorteio atual? (Útil após fazer um teste antes do dia 28/11)'
      )
    ) {
      return;
    }
    setLimpando(true);
    setErro(null);
    try {
      await adminLimparSorteio(adminPin);
      setResultadoRecente(null);
      setNumeroRoleta(null);
      await onAtualizar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao limpar sorteio.');
    } finally {
      setLimpando(false);
    }
  };

  const numeroExibido =
    sorteando && numeroRoleta !== null
      ? numeroRoleta
      : resultadoRecente?.numero ?? config.sorteio_numero;

  const ganhadorNome =
    resultadoRecente?.ganhador_nome ?? config.sorteio_ganhador_nome;
  const vendedorNome =
    resultadoRecente?.vendedor_nome ?? config.sorteio_vendedor_nome;
  const ganhadorWhatsapp =
    resultadoRecente?.ganhador_whatsapp ?? pontoVencedorAtual?.comprador_whatsapp ?? '';

  return (
    <div className="space-y-4">
      {/* Visor Principal do Sorteio (ideal para gravar tela no celular) */}
      <div className="rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950 border border-amber-400/35 p-6 text-center space-y-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-400">
          🎲 Sorteio Oficial • {config.titulo}
        </p>

        {/* Mostrador Gigante */}
        <div className="mx-auto w-44 h-44 rounded-full bg-zinc-900 border-4 border-amber-400/60 shadow-2xl shadow-amber-500/15 flex flex-col items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {sorteando ? 'Sorteando...' : numeroExibido ? 'Ponto Premiado' : 'Aguardando'}
          </span>
          <span
            className={`font-display text-5xl font-black tracking-wider mt-1 ${
              sorteando ? 'text-amber-300 animate-pulse' : 'gold-gradient-text'
            }`}
          >
            {numeroExibido !== null ? formatarPonto(numeroExibido) : '---'}
          </span>
        </div>

        {/* Detalhes do Ganhador */}
        {!sorteando && numeroExibido !== null && ganhadorNome && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              🎉 Parabéns ao Ganhador!
            </p>
            <h3 className="text-2xl font-extrabold text-white">{ganhadorNome}</h3>
            <p className="text-xs text-zinc-400">
              Cartela vendida por <strong className="text-amber-300">{vendedorNome}</strong>
            </p>
            {config.sorteio_realizado_em && (
              <p className="text-[11px] text-zinc-500">
                Registrado em {formatarDataHoraBR(config.sorteio_realizado_em)}
              </p>
            )}

            {ganhadorWhatsapp && (
              <div className="pt-2">
                <a
                  href={gerarLinkWhatsApp(
                    ganhadorWhatsapp,
                    `🎉 Parabéns ${ganhadorNome}! Seu ponto Nº ${formatarPonto(
                      numeroExibido
                    )} foi o GRANDE GANHADOR da ${config.titulo} (${
                      config.premio_descricao
                    })! Mande sua chave PIX para receber o prêmio! 🏆`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xs"
                >
                  <span>💬</span>
                  <span>Avisar Ganhador no WhatsApp</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controles do Sorteio */}
      <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Pontos elegíveis no globo:</span>
          <span className="font-extrabold text-emerald-400">
            {elegiveis.length} {elegiveis.length === 1 ? 'ponto' : 'pontos'}
          </span>
        </div>

        {pontosReservados.length > 0 && (
          <p className="text-[11px] text-amber-300/90 bg-amber-400/10 border border-amber-400/25 rounded-xl p-2.5">
            ⚠️ Existem <strong>{pontosReservados.length}</strong> pontos ainda como
            RESERVADO (sem confirmação de PIX). Confirme os pagamentos antes do sorteio
            oficial.
          </p>
        )}

        <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={apenasPagos}
            onChange={(e) => setApenasPagos(e.target.checked)}
            className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
          />
          <span>Sortear apenas pontos com status PAGO (recomendado)</span>
        </label>

        {erro && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/35 px-3 py-2 text-xs text-red-300">
            ⚠️ {erro}
          </div>
        )}

        <button
          type="button"
          onClick={handleSortear}
          disabled={sorteando || elegiveis.length === 0}
          className="w-full gold-button py-4 rounded-2xl font-extrabold text-sm disabled:opacity-50 cursor-pointer"
        >
          {sorteando
            ? 'Girando globo e sorteando...'
            : config.sorteio_numero !== null
            ? '🎲 Sortear Novamente'
            : '🎲 Realizar Sorteio Oficial Agora'}
        </button>

        {config.sorteio_numero !== null && (
          <button
            type="button"
            onClick={handleLimpar}
            disabled={limpando || sorteando}
            className="w-full py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-red-500/40 text-xs font-semibold text-zinc-400 hover:text-red-300 cursor-pointer"
          >
            {limpando ? 'Limpando...' : '🗑️ Limpar resultado'}
          </button>
        )}
      </div>
    </div>
  );
}