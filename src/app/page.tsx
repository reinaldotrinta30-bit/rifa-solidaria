'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ConfiguracaoPublica, PontoPublico, Vendedor } from '@/types/rifa';
import { carregarDadosPublicos } from '@/lib/rifaService';
import { CartelaPublica } from '@/components/CartelaPublica';
import { ModalReservaPix } from '@/components/ModalReservaPix';
import { PainelOrganizacao } from '@/components/PainelOrganizacao';

export default function HomePage() {
  const [tela, setTela] = useState<'cartela' | 'admin'>('cartela');
  const [config, setConfig] = useState<ConfiguracaoPublica | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [pontos, setPontos] = useState<PontoPublico[]>([]);
  const [vendedorUrlSlug, setVendedorUrlSlug] = useState<string | null>(null);

  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [modalCheckoutAberto, setModalCheckoutAberto] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const snap = await carregarDadosPublicos();
      setConfig(snap.config);
      setVendedores(snap.vendedores);
      setPontos(snap.pontos);

      // Remove da seleção caso algum ponto tenha sido reservado por outra pessoa
      setSelecionados((prev) =>
        prev.filter((num) =>
          snap.pontos.some((p) => p.numero === num && p.status === 'DISPONIVEL')
        )
      );
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível conectar ao banco da rifa.'
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('v');
      if (v) setVendedorUrlSlug(v);
    }
    carregar();
  }, [carregar]);

  const alternarPonto = (numero: number) => {
    setSelecionados((prev) =>
      prev.includes(numero)
        ? prev.filter((n) => n !== numero)
        : [...prev, numero].sort((a, b) => a - b)
    );
  };

  if (!config) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center">
        {erro ? (
          <div className="max-w-sm rounded-2xl bg-red-500/10 border border-red-500/35 p-5 space-y-3">
            <p className="text-sm font-bold text-red-300">⚠️ {erro}</p>
            <button
              type="button"
              onClick={carregar}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-bold text-white cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <p className="text-xs text-zinc-400">Carregando Rifa Solidária...</p>
          </div>
        )}
      </main>
    );
  }

  return (
    <main>
      {tela === 'cartela' && (
        <>
          {erro && (
            <div className="max-w-lg mx-auto px-4 pt-4">
              <div className="rounded-xl bg-red-500/10 border border-red-500/35 px-3.5 py-2.5 text-xs text-red-300 flex items-center justify-between gap-2">
                <span>⚠️ {erro}</span>
                <button
                  type="button"
                  onClick={carregar}
                  className="underline font-bold cursor-pointer"
                >
                  Atualizar
                </button>
              </div>
            </div>
          )}

          <CartelaPublica
            config={config}
            vendedores={vendedores}
            pontos={pontos}
            vendedorUrlSlug={vendedorUrlSlug}
            selecionados={selecionados}
            onAlternarPonto={alternarPonto}
            onLimparSelecao={() => setSelecionados([])}
            onAbrirCheckout={() => setModalCheckoutAberto(true)}
            onAbrirAdmin={() => setTela('admin')}
            onRecarregar={carregar}
            carregando={carregando}
          />

          {modalCheckoutAberto && (
            <ModalReservaPix
              config={config}
              vendedores={vendedores}
              selecionados={selecionados}
              onFechar={() => {
                setModalCheckoutAberto(false);
                setSelecionados([]);
              }}
              onReservaConcluida={carregar}
            />
          )}
        </>
      )}

      {tela === 'admin' && (
        <PainelOrganizacao
          config={config}
          vendedores={vendedores}
          onVoltar={() => {
            setTela('cartela');
            carregar();
          }}
          onAtualizarPublico={carregar}
        />
      )}
    </main>
  );
}