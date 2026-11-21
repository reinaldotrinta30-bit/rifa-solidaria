'use client';

import React, { useMemo, useState } from 'react';
import { ConfiguracaoPublica, ResultadoReserva, Vendedor } from '@/types/rifa';
import {
  aplicarMascaraTelefone,
  formatarMoeda,
  formatarPonto,
  gerarLinkWhatsApp,
  validarTelefoneBR,
} from '@/lib/formatadores';
import { reservarPontosPublico } from '@/lib/rifaService';

interface ModalReservaPixProps {
  config: ConfiguracaoPublica;
  vendedores: Vendedor[];
  selecionados: number[];
  onFechar: () => void;
  onReservaConcluida: () => Promise<void> | void;
}

export function ModalReservaPix({
  config,
  vendedores,
  selecionados,
  onFechar,
  onReservaConcluida,
}: ModalReservaPixProps) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [endereco, setEndereco] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reserva, setReserva] = useState<ResultadoReserva | null>(null);
  const [copiado, setCopiado] = useState(false);

  const valorTotalEstimado = selecionados.length * config.valor_ponto;

  const vendedoresResponsaveis = useMemo(() => {
    const nums = reserva?.numeros ?? selecionados;
    const nomes = new Set<string>();
    nums.forEach((n) => {
      const v = vendedores.find((item) => n >= item.ponto_inicio && n <= item.ponto_fim);
      if (v) nomes.add(v.nome);
    });
    return Array.from(nomes);
  }, [reserva, selecionados, vendedores]);

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (nome.trim().length < 3) {
      setErro('Informe seu nome completo.');
      return;
    }
    if (!validarTelefoneBR(whatsapp)) {
      setErro('Informe um número de WhatsApp válido com DDD.');
      return;
    }

    setEnviando(true);
    try {
      const res = await reservarPontosPublico({
        numeros: selecionados,
        nome,
        whatsapp,
        endereco,
      });
      setReserva(res);
      await onReservaConcluida();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : 'Erro ao reservar pontos. Tente novamente.'
      );
    } finally {
      setEnviando(false);
    }
  };

  const copiarChavePix = async () => {
    try {
      await navigator.clipboard.writeText(config.pix_chave);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro('Não foi possível copiar automaticamente. Selecione a chave manualmente.');
    }
  };

  const linkWhatsAppComprovante = useMemo(() => {
    if (!reserva) return '#';
    const msg = [
      `🎟️ *${config.titulo.toUpperCase()} — COMPROVANTE DE PIX*`,
      `Comprador: *${nome.trim()}*`,
      `WhatsApp: ${whatsapp.trim()}`,
      `Pontos escolhidos: *${reserva.numeros.map(formatarPonto).join(', ')}*`,
      vendedoresResponsaveis.length > 0
        ? `Cartela de: ${vendedoresResponsaveis.join(', ')}`
        : null,
      `Valor total: *${formatarMoeda(reserva.valor_total)}*`,
      ``,
      `Segue o comprovante do PIX para confirmar meus pontos! ✅`,
    ]
      .filter((linha) => linha !== null)
      .join('\n');

    return gerarLinkWhatsApp(config.whatsapp_comprovante, msg);
  }, [reserva, config, nome, whatsapp, vendedoresResponsaveis]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-zinc-950 border border-zinc-800 max-h-[92dvh] overflow-y-auto p-5 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">
              {reserva ? 'Etapa 2 de 2 • Pagamento' : 'Etapa 1 de 2 • Seus Dados'}
            </p>
            <h2 className="text-xl font-extrabold text-white">
              {reserva ? 'Pontos Reservados!' : 'Finalizar Reserva'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* ETAPA 1: FORMULÁRIO DO COMPRADOR */}
        {!reserva ? (
          <form onSubmit={handleConfirmar} className="space-y-4">
            {/* Resumo dos Pontos */}
            <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Pontos selecionados ({selecionados.length})</span>
                <span className="font-extrabold text-amber-300 text-sm">
                  {formatarMoeda(valorTotalEstimado)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selecionados.map((n) => (
                  <span
                    key={n}
                    className="px-2 py-0.5 rounded-lg bg-amber-400/15 border border-amber-400/40 font-mono text-xs font-bold text-amber-300"
                  >
                    {formatarPonto(n)}
                  </span>
                ))}
              </div>
              {vendedoresResponsaveis.length > 0 && (
                <p className="text-[11px] text-zinc-500">
                  Responsável pela cartela:{' '}
                  <span className="text-zinc-300 font-semibold">
                    {vendedoresResponsaveis.join(', ')}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                Nome completo *
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Digite seu nome completo"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 px-3.5 py-3 text-sm text-white placeholder:text-zinc-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                WhatsApp com DDD *
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(aplicarMascaraTelefone(e.target.value))}
                placeholder="(98) 99999-9999"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 px-3.5 py-3 text-sm text-white placeholder:text-zinc-500 outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-zinc-300">Endereço</label>
                <span className="text-[10px] text-zinc-500">Opcional</span>
              </div>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, bairro ou referência"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 px-3.5 py-3 text-sm text-white placeholder:text-zinc-500 outline-none"
              />
            </div>

            {erro && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/35 px-3.5 py-2.5 text-xs text-red-300">
                ⚠️ {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full gold-button py-3.5 rounded-2xl font-extrabold text-sm disabled:opacity-60 cursor-pointer"
            >
              {enviando ? 'Reservando seus pontos...' : 'Confirmar Reserva e Ver PIX →'}
            </button>
          </form>
        ) : (
          /* ETAPA 2: DADOS DO PIX DA DANYELLE + COMPROVANTE */
          <div className="space-y-4">
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/35 p-3.5 text-xs text-emerald-200 leading-relaxed">
              ✅ Seus números foram reservados com sucesso! Agora faça o PIX abaixo e envie o
              comprovante no WhatsApp para validarmos sua participação no sorteio.
            </div>

            {/* Resumo */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Pontos</span>
                <span className="font-mono font-extrabold text-amber-300">
                  {reserva.numeros.map(formatarPonto).join(', ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total a pagar</span>
                <span className="font-extrabold text-white text-base">
                  {formatarMoeda(reserva.valor_total)}
                </span>
              </div>
            </div>

            {/* Caixa PIX */}
            <div className="rounded-2xl bg-amber-400/10 border border-amber-400/40 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                  💠 Chave PIX para Pagamento
                </span>
                {config.pix_banco && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-950/70 text-zinc-300">
                    {config.pix_banco}
                  </span>
                )}
              </div>

              <div className="rounded-xl bg-zinc-950/90 border border-zinc-800 px-3.5 py-3 font-mono text-sm font-bold text-white break-all select-all">
                {config.pix_chave}
              </div>

              <p className="text-xs text-zinc-300">
                Titular: <strong className="text-white">{config.pix_titular}</strong>
              </p>

              <button
                type="button"
                onClick={copiarChavePix}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-extrabold text-xs transition-colors cursor-pointer"
              >
                {copiado ? '✓ Chave PIX Copiada!' : '📋 Copiar Chave PIX'}
              </button>
            </div>

            {/* Botão WhatsApp */}
            <a
              href={linkWhatsAppComprovante}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>💬</span>
              <span>Enviar Comprovante no WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={onFechar}
              className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white cursor-pointer"
            >
              Voltar para a Cartela
            </button>
          </div>
        )}
      </div>
    </div>
  );
}