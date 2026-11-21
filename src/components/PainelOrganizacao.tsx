'use client';

import React, { useMemo, useState } from 'react';
import {
  ConfiguracaoPublica,
  FormaPagamento,
  PontoAdmin,
  ResultadoSorteio,
  StatusPonto,
  Vendedor,
  VendedorContato,
} from '@/types/rifa';
import {
  aplicarMascaraTelefone,
  formatarMoeda,
  formatarPonto,
  gerarLinkWhatsApp,
} from '@/lib/formatadores';
import {
  adminAtualizarConfig,
  adminCarregarPontos,
  adminLimparTeste,
  adminPopularTeste,
  adminSalvarPontos,
  adminSimularSorteioTeste,
  exportarCsvRifa,
  verificarPinRifa,
  verificarPinConfig,
  adminCarregarWhatsappsVendedores,
  adminSalvarWhatsappsVendedores,
} from '@/lib/rifaService';
import { gerarECompartilharImagemCartela } from '@/lib/geradorImagemCartela';
import { ModalSorteio } from '@/components/ModalSorteio';

interface PainelOrganizacaoProps {
  config: ConfiguracaoPublica;
  vendedores: Vendedor[];
  onVoltar: () => void;
  onAtualizarPublico: () => Promise<void>;
}

type AbaAdmin = 'membros' | 'resumo' | 'sorteio' | 'config';

interface ModalPontoState {
  numeros: number[];
  status: 'PAGO' | 'RESERVADO';
  nome: string;
  whatsapp: string;
  endereco: string;
  forma_pagamento: FormaPagamento;
  observacao: string;
  editandoExistente: boolean;
}

export function PainelOrganizacao({
  config,
  vendedores,
  onVoltar,
  onAtualizarPublico,
}: PainelOrganizacaoProps) {
  const [pin, setPin] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [aba, setAba] = useState<AbaAdmin>('membros');
  const [pontos, setPontos] = useState<PontoAdmin[]>([]);

  // Aba "Por Membro"
  const [membroId, setMembroId] = useState<number>(vendedores[0]?.id ?? 1);
  const [filtroStatus, setFiltroStatus] = useState<StatusPonto | 'TODOS'>('TODOS');
  const [buscaMembro, setBuscaMembro] = useState('');
  const [selecionadosManual, setSelecionadosManual] = useState<number[]>([]);

  // Aba "Resumo" - busca global
  const [buscaGlobal, setBuscaGlobal] = useState('');

  // Modal de edição / cadastro manual
  const [modalPonto, setModalPonto] = useState<ModalPontoState | null>(null);
  const [salvandoModal, setSalvandoModal] = useState(false);

  // Formulário de Configurações
  const [cfgTitulo, setCfgTitulo] = useState(config.titulo);
  const [cfgSubtitulo, setCfgSubtitulo] = useState(config.subtitulo);
  const [cfgDataSorteio, setCfgDataSorteio] = useState(config.data_sorteio);
  const [cfgPixChave, setCfgPixChave] = useState(config.pix_chave);
  const [cfgPixTitular, setCfgPixTitular] = useState(config.pix_titular);
  const [cfgPixBanco, setCfgPixBanco] = useState(config.pix_banco);
  const [cfgWhats, setCfgWhats] = useState(config.whatsapp_comprovante);
  const [cfgNovoPin, setCfgNovoPin] = useState('');
  const [salvandoCfg, setSalvandoCfg] = useState(false);

  // Estados de Arte Stories & Zona de Testes
  const [gerandoArte, setGerandoArte] = useState(false);
  const [executandoTeste, setExecutandoTeste] = useState(false);
  const [simulacaoSorteio, setSimulacaoSorteio] = useState<ResultadoSorteio | null>(null);
  const [roletaTeste, setRoletaTeste] = useState<number | null>(null);

  // Bloqueio exclusivo da aba PIX & Configurações + WhatsApps dos Vendedores
  const [pinConfig, setPinConfig] = useState('');
  const [configLiberada, setConfigLiberada] = useState(false);
  const [verificandoConfig, setVerificandoConfig] = useState(false);
  const [erroConfig, setErroConfig] = useState<string | null>(null);
  const [contatosVendedores, setContatosVendedores] = useState<VendedorContato[]>([]);
  const [salvandoContatos, setSalvandoContatos] = useState(false);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3000);
  };

  const recarregarTudo = async (pinAtual = pin) => {
    setCarregando(true);
    try {
      const [listaPontos] = await Promise.all([
        adminCarregarPontos(pinAtual),
        onAtualizarPublico(),
      ]);
      setPontos(listaPontos);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao atualizar dados.');
    } finally {
      setCarregando(false);
    }
  };

  const handleDesbloquearConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroConfig(null);
    if (!pinConfig.trim()) {
      setErroConfig('Informe a senha exclusiva.');
      return;
    }

    setVerificandoConfig(true);
    try {
      const ok = await verificarPinConfig(pinConfig.trim());
      if (!ok) {
        setErroConfig('Senha incorreta. Acesso restrito.');
        return;
      }

      const listaContatos = await adminCarregarWhatsappsVendedores(pinConfig.trim());
      setContatosVendedores(listaContatos);
      setConfigLiberada(true);
    } catch (err) {
      setErroConfig(err instanceof Error ? err.message : 'Erro ao validar senha.');
    } finally {
      setVerificandoConfig(false);
    }
  };

  const handleSalvarContatosVendedores = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvandoContatos(true);
    try {
      await adminSalvarWhatsappsVendedores(
        pinConfig,
        contatosVendedores.map((c) => ({ id: c.id, whatsapp: c.whatsapp }))
      );
      mostrarAviso('WhatsApps dos vendedores atualizados com sucesso!');
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : 'Erro ao salvar WhatsApps dos vendedores.'
      );
    } finally {
      setSalvandoContatos(false);
    }
  };

  const handleBaixarArte = async (vendedor: Vendedor | null) => {
    setGerandoArte(true);
    setErro(null);
    try {
      const modo = await gerarECompartilharImagemCartela({
        config,
        pontos,
        vendedor,
      });
      mostrarAviso(
        modo === 'compartilhado'
          ? 'Arte pronta para compartilhar!'
          : 'Imagem PNG baixada com sucesso!'
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao gerar imagem.');
    } finally {
      setGerandoArte(false);
    }
  };

  const handlePopularTeste = async () => {
    setErro(null);
    setExecutandoTeste(true);
    try {
      const qtd = await adminPopularTeste(pinConfig);
      await recarregarTudo();
      mostrarAviso(`${qtd} pontos fictícios de teste gerados nas cartelas!`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao gerar dados de teste.');
    } finally {
      setExecutandoTeste(false);
    }
  };

  const handleSimularSorteioTeste = async () => {
    setErro(null);
    setExecutandoTeste(true);
    setSimulacaoSorteio(null);

    const pagosAtuais = pontos.filter((p) => p.status === 'PAGO');
    const intervalo = window.setInterval(() => {
      if (pagosAtuais.length > 0) {
        const idx = Math.floor(Math.random() * pagosAtuais.length);
        setRoletaTeste(pagosAtuais[idx].numero);
      } else {
        setRoletaTeste(Math.floor(Math.random() * 175) + 1);
      }
    }, 75);

    try {
      const [res] = await Promise.all([
        adminSimularSorteioTeste(pinConfig),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
      window.clearInterval(intervalo);
      setRoletaTeste(null);
      setSimulacaoSorteio(res);
    } catch (err) {
      window.clearInterval(intervalo);
      setRoletaTeste(null);
      setErro(err instanceof Error ? err.message : 'Erro na simulação do sorteio.');
    } finally {
      setExecutandoTeste(false);
    }
  };

  const handleLimparTeste = async () => {
    if (
      !window.confirm(
        'Remover todos os pontos fictícios de teste? (Compradores reais NÃO serão apagados.)'
      )
    ) {
      return;
    }
    setErro(null);
    setExecutandoTeste(true);
    try {
      const removidos = await adminLimparTeste(pinConfig);
      setSimulacaoSorteio(null);
      await recarregarTudo();
      mostrarAviso(`${removidos} pontos fictícios removidos. Cartela limpa!`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao limpar dados de teste.');
    } finally {
      setExecutandoTeste(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!pin.trim()) {
      setErro('Informe o PIN da organização.');
      return;
    }

    setCarregando(true);
    try {
      const ok = await verificarPinRifa(pin.trim());
      if (!ok) {
        setErro('PIN incorreto.');
        return;
      }
      const listaPontos = await adminCarregarPontos(pin.trim());
      setPontos(listaPontos);
      if (vendedores.length > 0 && !vendedores.some((v) => v.id === membroId)) {
        setMembroId(vendedores[0].id);
      }
      setAutenticado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao autenticar.');
    } finally {
      setCarregando(false);
    }
  };

  // Estatísticas por vendedor
  const statsPorVendedor = useMemo(() => {
    return vendedores.map((v) => {
      const seus = pontos.filter((p) => p.vendedor_id === v.id);
      const pagos = seus.filter((p) => p.status === 'PAGO').length;
      const reservados = seus.filter((p) => p.status === 'RESERVADO').length;
      const disponiveis = seus.length - pagos - reservados;
      const meta = seus.length * config.valor_ponto;
      const arrecadado = pagos * config.valor_ponto;
      const pendente = reservados * config.valor_ponto;
      const percentual = seus.length ? Math.round((pagos / seus.length) * 100) : 0;
      return {
        vendedor: v,
        total: seus.length,
        pagos,
        reservados,
        disponiveis,
        meta,
        arrecadado,
        pendente,
        percentual,
      };
    });
  }, [vendedores, pontos, config.valor_ponto]);

  const resumoFinanceiro = useMemo(() => {
    const pagos = pontos.filter((p) => p.status === 'PAGO').length;
    const reservados = pontos.filter((p) => p.status === 'RESERVADO').length;
    const disponiveis = pontos.length - pagos - reservados;
    const arrecadado = pagos * config.valor_ponto;
    const aReceber = reservados * config.valor_ponto;
    const metaTotal = pontos.length * config.valor_ponto;
    const lucroLiquido = arrecadado - 100;
    return {
      pagos,
      reservados,
      disponiveis,
      arrecadado,
      aReceber,
      metaTotal,
      lucroLiquido,
    };
  }, [pontos, config.valor_ponto]);

  const statMembroAtual = useMemo(
    () => statsPorVendedor.find((s) => s.vendedor.id === membroId) ?? statsPorVendedor[0],
    [statsPorVendedor, membroId]
  );

  const pontosMembroAtual = useMemo(() => {
    if (!statMembroAtual) return [];
    const termo = buscaMembro.trim().toLowerCase();
    return pontos.filter((p) => {
      if (p.vendedor_id !== statMembroAtual.vendedor.id) return false;
      if (filtroStatus !== 'TODOS' && p.status !== filtroStatus) return false;
      if (termo) {
        return (
          String(p.numero).includes(termo) ||
          formatarPonto(p.numero).includes(termo) ||
          p.comprador_nome.toLowerCase().includes(termo) ||
          p.comprador_whatsapp.includes(termo)
        );
      }
      return true;
    });
  }, [pontos, statMembroAtual, filtroStatus, buscaMembro]);

  const compradoresMembroAtual = useMemo(
    () => pontosMembroAtual.filter((p) => p.status !== 'DISPONIVEL'),
    [pontosMembroAtual]
  );

  const resultadosBuscaGlobal = useMemo(() => {
    const termo = buscaGlobal.trim().toLowerCase();
    if (!termo) return [];
    return pontos.filter(
      (p) =>
        String(p.numero) === termo ||
        formatarPonto(p.numero).includes(termo) ||
        p.comprador_nome.toLowerCase().includes(termo) ||
        p.comprador_whatsapp.includes(termo)
    );
  }, [pontos, buscaGlobal]);

  const alternarPontoManual = (numero: number) => {
    setSelecionadosManual((prev) =>
      prev.includes(numero)
        ? prev.filter((n) => n !== numero)
        : [...prev, numero].sort((a, b) => a - b)
    );
  };

  const abrirModalCadastroManual = () => {
    if (selecionadosManual.length === 0) return;
    setModalPonto({
      numeros: [...selecionadosManual],
      status: 'PAGO',
      nome: '',
      whatsapp: '',
      endereco: '',
      forma_pagamento: 'PIX',
      observacao: '',
      editandoExistente: false,
    });
  };

  const abrirModalEditarPonto = (p: PontoAdmin) => {
    setModalPonto({
      numeros: [p.numero],
      status: p.status === 'RESERVADO' ? 'RESERVADO' : 'PAGO',
      nome: p.comprador_nome || '',
      whatsapp: p.comprador_whatsapp || '',
      endereco: p.comprador_endereco || '',
      forma_pagamento: p.forma_pagamento || 'PIX',
      observacao: p.observacao || '',
      editandoExistente: p.status !== 'DISPONIVEL',
    });
  };

  const handleConfirmarPagoRapido = async (p: PontoAdmin) => {
    setErro(null);
    try {
      await adminSalvarPontos({
        pin,
        numeros: [p.numero],
        status: 'PAGO',
        nome: p.comprador_nome,
        whatsapp: p.comprador_whatsapp,
        endereco: p.comprador_endereco,
        forma_pagamento: p.forma_pagamento || 'PIX',
        observacao: p.observacao,
      });
      await recarregarTudo();
      mostrarAviso(`Ponto ${formatarPonto(p.numero)} confirmado como PAGO!`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao confirmar pagamento.');
    }
  };

  const handleSalvarModalPonto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPonto) return;
    setErro(null);

    if (modalPonto.nome.trim().length < 2) {
      setErro('Informe o nome do comprador.');
      return;
    }

    setSalvandoModal(true);
    try {
      await adminSalvarPontos({
        pin,
        numeros: modalPonto.numeros,
        status: modalPonto.status,
        nome: modalPonto.nome,
        whatsapp: modalPonto.whatsapp,
        endereco: modalPonto.endereco,
        forma_pagamento: modalPonto.forma_pagamento,
        observacao: modalPonto.observacao,
      });
      setModalPonto(null);
      setSelecionadosManual([]);
      await recarregarTudo();
      mostrarAviso('Ponto(s) atualizado(s) com sucesso!');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar ponto.');
    } finally {
      setSalvandoModal(false);
    }
  };

  const handleLiberarPonto = async () => {
    if (!modalPonto) return;
    if (
      !window.confirm(
        `Liberar ponto ${modalPonto.numeros.map(formatarPonto).join(', ')} e apagar os dados deste comprador?`
      )
    ) {
      return;
    }

    setSalvandoModal(true);
    setErro(null);
    try {
      await adminSalvarPontos({
        pin,
        numeros: modalPonto.numeros,
        status: 'DISPONIVEL',
      });
      setModalPonto(null);
      await recarregarTudo();
      mostrarAviso('Ponto liberado e disponível novamente na cartela.');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao liberar ponto.');
    } finally {
      setSalvandoModal(false);
    }
  };

  const copiarLinkVendedor = async (vendedor: Vendedor) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${base}/?v=${vendedor.slug}`;
    try {
      await navigator.clipboard.writeText(link);
      mostrarAviso(`Link de ${vendedor.nome} copiado!`);
    } catch {
      mostrarAviso(`Link: ${link}`);
    }
  };

  const copiarRelatorioMembro = async () => {
    if (!statMembroAtual) return;
    const { vendedor, pagos, reservados, disponiveis, arrecadado, meta } = statMembroAtual;
    const livres = pontos
      .filter((p) => p.vendedor_id === vendedor.id && p.status === 'DISPONIVEL')
      .map((p) => formatarPonto(p.numero));

    const texto = [
      `📊 *${config.titulo} — Cartela de ${vendedor.nome}*`,
      `Faixa: ${formatarPonto(vendedor.ponto_inicio)} a ${formatarPonto(vendedor.ponto_fim)}`,
      `✅ Pagos: ${pagos} (${formatarMoeda(arrecadado)} / ${formatarMoeda(meta)})`,
      `⏳ Reservados: ${reservados}`,
      `⚪ Faltam vender: ${disponiveis}`,
      livres.length > 0 ? `\nNúmeros livres: ${livres.join(', ')}` : `\n🎉 Cartela 100% fechada!`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(texto);
      mostrarAviso(`Relatório de ${vendedor.nome} copiado para colar no WhatsApp!`);
    } catch {
      setErro('Não foi possível copiar o relatório.');
    }
  };

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvandoCfg(true);
    try {
      await adminAtualizarConfig({
        pin: pinConfig,
        titulo: cfgTitulo,
        subtitulo: cfgSubtitulo,
        data_sorteio: cfgDataSorteio,
        pix_chave: cfgPixChave,
        pix_titular: cfgPixTitular,
        pix_banco: cfgPixBanco,
        whatsapp_comprovante: cfgWhats,
        novo_pin: cfgNovoPin.trim() || undefined,
      });

      const pinParaUsar = cfgNovoPin.trim().length >= 4 ? cfgNovoPin.trim() : pin;
      if (cfgNovoPin.trim().length >= 4) {
        setPin(pinParaUsar);
        setCfgNovoPin('');
      }

      await recarregarTudo(pinParaUsar);
      mostrarAviso('Configurações da rifa salvas com sucesso!');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar configurações.');
    } finally {
      setSalvandoCfg(false);
    }
  };

  // ================= TELA DE LOGIN =================
  if (!autenticado) {
    return (
      <div className="min-h-[100dvh] flex flex-col justify-center max-w-md mx-auto px-5 py-8">
        <button
          type="button"
          onClick={onVoltar}
          className="self-start mb-6 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
        >
          ← Voltar para a Cartela
        </button>

        <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 p-6 space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">
              Área Restrita
            </p>
            <h1 className="text-2xl font-extrabold text-white mt-1">
              Painel dos Organizadores
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Controle de pontos por membro, confirmação de PIX, cadastro manual e sorteio.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Digite o PIN da Organização"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-4 py-3.5 text-center text-lg tracking-[0.35em] font-mono text-white outline-none"
            />

            {erro && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/35 px-3.5 py-2.5 text-xs text-red-300">
                ⚠️ {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full gold-button py-3.5 rounded-2xl font-extrabold text-sm disabled:opacity-60 cursor-pointer"
            >
              {carregando ? 'Verificando...' : 'Entrar no Painel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= PAINEL AUTENTICADO =================
  return (
    <div className="min-h-[100dvh] max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-4">
      {/* Topo */}
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
        >
          ← Cartela Pública
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={gerandoArte}
            onClick={() => handleBaixarArte(null)}
            className="px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-400/40 text-xs font-bold text-amber-300 hover:bg-amber-400/25 cursor-pointer disabled:opacity-50"
          >
            {gerandoArte ? 'Gerando...' : '📸 Arte Geral (1–175)'}
          </button>
          <button
            type="button"
            onClick={() => recarregarTudo()}
            disabled={carregando}
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200 hover:border-zinc-700 cursor-pointer"
          >
            {carregando ? '...' : '↻ Atualizar'}
          </button>
          <button
            type="button"
            onClick={() => exportarCsvRifa(pontos, vendedores, config.valor_ponto)}
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200 hover:border-amber-400/40 cursor-pointer"
          >
            📥 CSV
          </button>
        </div>
      </header>

      {/* Avisos / Erros */}
      {aviso && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-4 py-2.5 text-xs font-semibold text-emerald-300">
          ✅ {aviso}
        </div>
      )}
      {erro && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/35 px-4 py-2.5 text-xs text-red-300">
          ⚠️ {erro}
        </div>
      )}

      {/* Navegação Principal (4 Abas) */}
      <nav className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
        {(
          [
            { id: 'membros', label: '👥 Membros' },
            { id: 'resumo', label: '📊 Resumo' },
            { id: 'sorteio', label: '🎲 Sorteio' },
            { id: 'config', label: '⚙️ PIX' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setAba(item.id);
              setErro(null);
            }}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              aba === item.id
                ? 'bg-amber-400 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* ================= ABA 1: POR MEMBRO (8 ABINHAS DEDICADAS) ================= */}
      {aba === 'membros' && statMembroAtual && (
        <div className="space-y-4">
          {/* As 8 Abinhas Individuais dos Membros */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
            {statsPorVendedor.map((s) => {
              const ativo = s.vendedor.id === statMembroAtual.vendedor.id;
              return (
                <button
                  key={s.vendedor.id}
                  type="button"
                  onClick={() => {
                    setMembroId(s.vendedor.id);
                    setSelecionadosManual([]);
                    setBuscaMembro('');
                  }}
                  className={`px-3.5 py-2 rounded-2xl border text-left shrink-0 transition-all cursor-pointer ${
                    ativo
                      ? 'bg-amber-400/15 border-amber-400 text-white'
                      : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="block text-xs font-extrabold">{s.vendedor.nome}</span>
                  <span
                    className={`block text-[10px] font-mono mt-0.5 ${
                      ativo ? 'text-amber-300' : 'text-zinc-500'
                    }`}
                  >
                    {s.pagos}/{s.total} pagos
                    {s.reservados > 0 ? ` • ${s.reservados}⏳` : ''}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Card do Membro Selecionado */}
          <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 space-y-3.5">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-lg font-extrabold text-white">
                  Cartela de {statMembroAtual.vendedor.nome}
                </h2>
                <p className="text-xs text-zinc-400">
                  Pontos{' '}
                  <strong className="text-amber-300">
                    {formatarPonto(statMembroAtual.vendedor.ponto_inicio)} a{' '}
                    {formatarPonto(statMembroAtual.vendedor.ponto_fim)}
                  </strong>{' '}
                  ({statMembroAtual.total} pontos • Meta{' '}
                  {formatarMoeda(statMembroAtual.meta)})
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => copiarLinkVendedor(statMembroAtual.vendedor)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/40 text-[11px] font-bold text-amber-300 hover:bg-amber-400/25 cursor-pointer"
                >
                  🔗 Copiar Link
                </button>
                <button
                  type="button"
                  onClick={copiarRelatorioMembro}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-bold text-zinc-300 hover:text-white cursor-pointer"
                >
                  📋 Relatório
                </button>
                <button
                  type="button"
                  disabled={gerandoArte}
                  onClick={() => handleBaixarArte(statMembroAtual.vendedor)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-bold text-amber-300 hover:border-amber-400/40 cursor-pointer disabled:opacity-50"
                >
                  {gerandoArte ? '...' : '📸 Stories'}
                </button>
              </div>
            </div>

            {/* 3 Mini KPIs do Membro */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-zinc-950/80 border border-emerald-500/25 p-2.5">
                <span className="block text-[10px] font-bold uppercase text-emerald-400">
                  Pagos ({statMembroAtual.pagos})
                </span>
                <span className="block text-sm font-extrabold text-white mt-0.5">
                  {formatarMoeda(statMembroAtual.arrecadado)}
                </span>
              </div>
              <div className="rounded-xl bg-zinc-950/80 border border-amber-400/25 p-2.5">
                <span className="block text-[10px] font-bold uppercase text-amber-300">
                  Reservados ({statMembroAtual.reservados})
                </span>
                <span className="block text-sm font-extrabold text-white mt-0.5">
                  {formatarMoeda(statMembroAtual.pendente)}
                </span>
              </div>
              <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 p-2.5">
                <span className="block text-[10px] font-bold uppercase text-zinc-400">
                  Faltam
                </span>
                <span className="block text-sm font-extrabold text-white mt-0.5">
                  {statMembroAtual.disponiveis} pts
                </span>
              </div>
            </div>

            {/* Barra de progresso do membro */}
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden flex">
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{
                  width: `${
                    statMembroAtual.total
                      ? (statMembroAtual.pagos / statMembroAtual.total) * 100
                      : 0
                  }%`,
                }}
              />
              <div
                className="h-full bg-amber-400/80 transition-all"
                style={{
                  width: `${
                    statMembroAtual.total
                      ? (statMembroAtual.reservados / statMembroAtual.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Filtros do Membro */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                type="text"
                value={buscaMembro}
                onChange={(e) => setBuscaMembro(e.target.value)}
                placeholder="Filtrar nº ou comprador..."
                className="flex-1 min-w-[150px] rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none"
              />
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'TODOS', label: 'Todos' },
                    { id: 'DISPONIVEL', label: 'Livres' },
                    { id: 'RESERVADO', label: 'Reserv.' },
                    { id: 'PAGO', label: 'Pagos' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroStatus(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                      filtroStatus === f.id
                        ? 'bg-amber-400 text-zinc-950 border-amber-400'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrução rápida */}
            <p className="text-[11px] text-zinc-500">
              💡 Toque em pontos <strong className="text-zinc-300">livres</strong> para
              cadastrar vendas manuais (1 ou vários de uma vez), ou toque em pontos{' '}
              <strong className="text-amber-300">reservados</strong> /{' '}
              <strong className="text-emerald-400">pagos</strong> para editar ou confirmar PIX.
            </p>

            {/* Grade Interativa do Membro */}
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
              {pontosMembroAtual.map((p) => {
                const selecionado = selecionadosManual.includes(p.numero);
                const livre = p.status === 'DISPONIVEL';
                const pago = p.status === 'PAGO';

                return (
                  <button
                    key={p.numero}
                    type="button"
                    onClick={() =>
                      livre ? alternarPontoManual(p.numero) : abrirModalEditarPonto(p)
                    }
                    className={`rounded-xl py-2 px-1 border flex flex-col items-center justify-center transition-all cursor-pointer ${
                      selecionado
                        ? 'bg-amber-400 border-amber-300 text-zinc-950 font-extrabold'
                        : livre
                        ? 'bg-zinc-950 border-zinc-800 hover:border-amber-400/60 text-zinc-200'
                        : pago
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/45 text-amber-300'
                    }`}
                  >
                    <span className="font-mono text-xs font-extrabold">
                      {formatarPonto(p.numero)}
                    </span>
                    <span className="text-[9px] truncate max-w-full opacity-80">
                      {selecionado
                        ? '+add'
                        : livre
                        ? 'livre'
                        : p.comprador_nome.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de Compradores deste Membro */}
          <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
              Compradores de {statMembroAtual.vendedor.nome} ({compradoresMembroAtual.length})
            </h3>

            {compradoresMembroAtual.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3 text-center">
                Nenhuma venda registrada neste filtro ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {compradoresMembroAtual.map((p) => (
                  <div
                    key={p.numero}
                    className="rounded-xl bg-zinc-950/90 border border-zinc-800 p-3 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-amber-300">
                          {formatarPonto(p.numero)}
                        </span>
                        <span className="text-sm font-bold text-white truncate">
                          {p.comprador_nome}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            p.status === 'PAGO'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                              : 'bg-amber-400/15 text-amber-300 border border-amber-400/35'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {p.comprador_whatsapp || 'Sem WhatsApp'}
                        {p.comprador_endereco ? ` • ${p.comprador_endereco}` : ''}
                        {p.forma_pagamento ? ` • ${p.forma_pagamento}` : ''}
                      </p>
                      {p.observacao && (
                        <p className="text-[11px] text-zinc-500 italic mt-0.5">
                          Obs: {p.observacao}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.status === 'RESERVADO' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmarPagoRapido(p)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[11px] font-extrabold cursor-pointer"
                        >
                          ✓ Confirmar PIX
                        </button>
                      )}

                      {p.comprador_whatsapp && (
                        <a
                          href={gerarLinkWhatsApp(
                            p.comprador_whatsapp,
                            p.status === 'PAGO'
                              ? `Olá ${p.comprador_nome}! Confirmamos o pagamento do seu ponto Nº ${formatarPonto(
                                  p.numero
                                )} na ${config.titulo}. Boa sorte no sorteio dia ${
                                  config.data_sorteio
                                }! 🍀`
                              : `Olá ${p.comprador_nome}! Passando para lembrar da sua reserva do ponto Nº ${formatarPonto(
                                  p.numero
                                )} na ${config.titulo} (${formatarMoeda(
                                  config.valor_ponto
                                )}). Chave PIX: ${config.pix_chave} (${config.pix_titular}).`
                          )}
                          target="_blank"
                          rel="noreferrer"
                          title="Enviar mensagem no WhatsApp"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold"
                        >
                          💬
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => abrirModalEditarPonto(p)}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-[11px] font-semibold hover:border-amber-400/50 cursor-pointer"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Barra flutuante para Cadastro Manual em Lote */}
          {selecionadosManual.length > 0 && (
            <div className="fixed bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent">
              <div className="max-w-2xl mx-auto rounded-2xl bg-zinc-900 border border-amber-400/50 p-3.5 shadow-2xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-amber-300">
                    {selecionadosManual.length}{' '}
                    {selecionadosManual.length === 1
                      ? 'ponto selecionado'
                      : 'pontos selecionados'}{' '}
                    ({formatarMoeda(selecionadosManual.length * config.valor_ponto)})
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    Nº {selecionadosManual.map(formatarPonto).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelecionadosManual([])}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-400 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={abrirModalCadastroManual}
                    className="gold-button px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer"
                  >
                    + Cadastrar Comprador
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= ABA 2: RESUMO GERAL ================= */}
      {aba === 'resumo' && (
        <div className="space-y-4">
          {/* KPIs Financeiros */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-2xl bg-zinc-900/90 border border-emerald-500/30 p-3.5">
              <span className="text-[10px] font-bold uppercase text-emerald-400">
                Arrecadado (Pago)
              </span>
              <p className="text-lg font-extrabold text-white mt-1">
                {formatarMoeda(resumoFinanceiro.arrecadado)}
              </p>
              <span className="text-[11px] text-zinc-400">
                {resumoFinanceiro.pagos} pontos
              </span>
            </div>

            <div className="rounded-2xl bg-zinc-900/90 border border-amber-400/30 p-3.5">
              <span className="text-[10px] font-bold uppercase text-amber-300">
                A Confirmar
              </span>
              <p className="text-lg font-extrabold text-white mt-1">
                {formatarMoeda(resumoFinanceiro.aReceber)}
              </p>
              <span className="text-[11px] text-zinc-400">
                {resumoFinanceiro.reservados} reservados
              </span>
            </div>

            <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3.5">
              <span className="text-[10px] font-bold uppercase text-zinc-400">
                Saldo pós-Prêmio
              </span>
              <p
                className={`text-lg font-extrabold mt-1 ${
                  resumoFinanceiro.lucroLiquido >= 0 ? 'text-emerald-400' : 'text-zinc-300'
                }`}
              >
                {formatarMoeda(resumoFinanceiro.lucroLiquido)}
              </p>
              <span className="text-[11px] text-zinc-500">desc. PIX R$ 100</span>
            </div>

            <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3.5">
              <span className="text-[10px] font-bold uppercase text-zinc-400">
                Restam Vender
              </span>
              <p className="text-lg font-extrabold text-white mt-1">
                {resumoFinanceiro.disponiveis} pts
              </p>
              <span className="text-[11px] text-zinc-500">
                Meta {formatarMoeda(resumoFinanceiro.metaTotal)}
              </span>
            </div>
          </div>

          {/* Busca Global Rápida */}
          <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 space-y-2.5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-400">
              🔎 Busca Rápida (todos os 175 pontos)
            </label>
            <input
              type="text"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
              placeholder="Digite número do ponto, nome ou telefone..."
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 outline-none"
            />
            {buscaGlobal.trim() && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pt-1">
                {resultadosBuscaGlobal.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-2">
                    Nenhum resultado encontrado.
                  </p>
                ) : (
                  resultadosBuscaGlobal.map((p) => {
                    const vend = vendedores.find((v) => v.id === p.vendedor_id);
                    return (
                      <div
                        key={p.numero}
                        className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-extrabold text-amber-300 mr-2">
                            {formatarPonto(p.numero)}
                          </span>
                          <span className="font-bold text-white">
                            {p.comprador_nome || 'Disponível'}
                          </span>
                          <span className="text-zinc-500 ml-2">({vend?.nome})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => abrirModalEditarPonto(p)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-[11px] font-bold text-zinc-200 cursor-pointer shrink-0"
                        >
                          Abrir
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Desempenho por Membro */}
          <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
              Desempenho por Membro (clique para gerenciar)
            </h3>
            <div className="space-y-2.5">
              {statsPorVendedor.map((s) => (
                <button
                  key={s.vendedor.id}
                  type="button"
                  onClick={() => {
                    setMembroId(s.vendedor.id);
                    setAba('membros');
                  }}
                  className="w-full text-left rounded-xl bg-zinc-950/80 hover:bg-zinc-950 border border-zinc-800 hover:border-amber-400/40 p-3 transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-extrabold text-white">
                        {s.vendedor.nome}
                      </span>
                      <span className="text-[11px] text-zinc-500 ml-2">
                        ({formatarPonto(s.vendedor.ponto_inicio)}–
                        {formatarPonto(s.vendedor.ponto_fim)})
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-400">
                      {formatarMoeda(s.arrecadado)}{' '}
                      <span className="text-zinc-500 font-normal">
                        / {formatarMoeda(s.meta)}
                      </span>
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${s.total ? (s.pagos / s.total) * 100 : 0}%` }}
                    />
                    <div
                      className="h-full bg-amber-400/80"
                      style={{
                        width: `${s.total ? (s.reservados / s.total) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>
                      ✅ {s.pagos} pagos • ⏳ {s.reservados} reserv. • ⚪ {s.disponiveis}{' '}
                      livres
                    </span>
                    <span className="text-amber-300 font-bold">{s.percentual}% →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= ABA 3: SORTEIO OFICIAL ================= */}
      {aba === 'sorteio' && (
        <ModalSorteio
          adminPin={pin}
          config={config}
          pontos={pontos}
          onAtualizar={() => recarregarTudo()}
        />
      )}


      {/* ================= ABA 4: CONFIGURAÇÕES PIX & ZONA DE TESTES ================= */}
      {aba === 'config' && !configLiberada && (
        <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-6 max-w-md mx-auto space-y-4">
          <div className="text-center">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-400/40 text-xl mb-2">
              🔐
            </span>
            <h2 className="text-lg font-extrabold text-white">
              Chave PIX & Configurações
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Acesso exclusivo do administrador geral. Digite sua senha para desbloquear.
            </p>
          </div>

          <form onSubmit={handleDesbloquearConfig} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              value={pinConfig}
              onChange={(e) => setPinConfig(e.target.value)}
              placeholder="Senha exclusiva"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-4 py-3 text-center text-lg tracking-[0.35em] font-mono text-white outline-none"
            />

            {erroConfig && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/35 px-3 py-2 text-xs text-red-300 text-center">
                ⚠️ {erroConfig}
              </div>
            )}

            <button
              type="submit"
              disabled={verificandoConfig}
              className="w-full gold-button py-3 rounded-2xl font-extrabold text-sm disabled:opacity-60 cursor-pointer"
            >
              {verificandoConfig ? 'Verificando...' : 'Desbloquear Configurações'}
            </button>
          </form>
        </div>
      )}

      {aba === 'config' && configLiberada && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setConfigLiberada(false);
                setPinConfig('');
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-400/40 text-[11px] font-bold text-zinc-300 cursor-pointer"
            >
              🔒 Bloquear aba novamente
            </button>
          </div>

          <form
            onSubmit={handleSalvarConfig}
            className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-5 space-y-4"
          >
            <div>
              <h2 className="text-lg font-extrabold text-white">
                Chave PIX & Configurações
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Alterações aqui aparecem imediatamente na cartela pública e na tela de PIX.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Título da Rifa
                </label>
                <input
                  type="text"
                  value={cfgTitulo}
                  onChange={(e) => setCfgTitulo(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Data do Sorteio
                </label>
                <input
                  type="text"
                  value={cfgDataSorteio}
                  onChange={(e) => setCfgDataSorteio(e.target.value)}
                  placeholder="28/11/2026"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Frase de descrição (subtítulo)
              </label>
              <input
                type="text"
                value={cfgSubtitulo}
                onChange={(e) => setCfgSubtitulo(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <hr className="border-zinc-800" />

            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1">
                Chave PIX da Danyelle *
              </label>
              <input
                type="text"
                value={cfgPixChave}
                onChange={(e) => setCfgPixChave(e.target.value)}
                placeholder="CPF, telefone, e-mail ou chave aleatória"
                className="w-full rounded-xl bg-zinc-950 border border-amber-400/40 focus:border-amber-400 px-3.5 py-2.5 text-sm font-mono text-white outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Nome do Titular do PIX
                </label>
                <input
                  type="text"
                  value={cfgPixTitular}
                  onChange={(e) => setCfgPixTitular(e.target.value)}
                  placeholder="Ex: Danyelle Silva"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Banco (opcional)
                </label>
                <input
                  type="text"
                  value={cfgPixBanco}
                  onChange={(e) => setCfgPixBanco(e.target.value)}
                  placeholder="Ex: Nubank / Banco do Brasil"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                WhatsApp para receber os comprovantes (com DDD)
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={cfgWhats}
                onChange={(e) => setCfgWhats(aplicarMascaraTelefone(e.target.value))}
                placeholder="(98) 99185-2147"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <hr className="border-zinc-800" />

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Trocar PIN da Organização (deixe em branco para manter o atual)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={cfgNovoPin}
                onChange={(e) => setCfgNovoPin(e.target.value)}
                placeholder="Novo PIN (mínimo 4 dígitos)"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={salvandoCfg}
              className="w-full gold-button py-3.5 rounded-2xl font-extrabold text-sm disabled:opacity-60 cursor-pointer"
            >
              {salvandoCfg ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </form>

          {/* WHATSAPP DOS VENDEDORES (ROTEAMENTO DE COMPROVANTES) */}
          <form
            onSubmit={handleSalvarContatosVendedores}
            className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-5 space-y-4"
          >
            <div>
              <h3 className="text-base font-extrabold text-white">
                📱 WhatsApp dos Vendedores (Comprovantes)
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Cada comprovante vai automaticamente para o WhatsApp do vendedor responsável
                pelos pontos comprados. Em compras mistas, vai para quem tiver mais pontos
                naquela compra (desempate pela maior venda total).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contatosVendedores.map((c) => (
                <div key={c.id}>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    {c.nome}{' '}
                    <span className="text-[10px] font-mono text-zinc-500">
                      ({formatarPonto(c.ponto_inicio)}–{formatarPonto(c.ponto_fim)})
                    </span>
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={c.whatsapp}
                    onChange={(e) => {
                      const formatado = aplicarMascaraTelefone(e.target.value);
                      setContatosVendedores((prev) =>
                        prev.map((item) =>
                          item.id === c.id ? { ...item, whatsapp: formatado } : item
                        )
                      );
                    }}
                    placeholder="(98) 99999-9999"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-sm font-mono text-white outline-none"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={salvandoContatos}
              className="w-full gold-button py-3 rounded-2xl font-extrabold text-sm disabled:opacity-60 cursor-pointer"
            >
              {salvandoContatos ? 'Salvando contatos...' : 'Salvar WhatsApps dos Vendedores'}
            </button>
          </form>

          {/* ZONA DE TESTES (SOMENTE ORGANIZAÇÃO) */}
          <div className="rounded-2xl bg-zinc-900/80 border border-dashed border-amber-400/40 p-5 space-y-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-400">
                Ambiente de Validação • Somente Organização
              </p>
              <h3 className="text-base font-extrabold text-white mt-0.5">
                🧪 Testar Sistema & Simular Sorteio
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Gere vendas fictícias para testar as abas dos vendedores, a arte oficial
                marcada e a roleta do sorteio. Ao clicar em limpar, apenas os registros de
                teste são removidos (vendas reais ficam intactas).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={executandoTeste}
                onClick={handlePopularTeste}
                className="py-3 px-3 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-xs font-extrabold text-amber-300 cursor-pointer disabled:opacity-50"
              >
                🧪 1. Gerar Dados Teste
              </button>

              <button
                type="button"
                disabled={executandoTeste}
                onClick={handleSimularSorteioTeste}
                className="py-3 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-xs font-extrabold text-emerald-300 cursor-pointer disabled:opacity-50"
              >
                🎲 2. Simular Sorteio
              </button>

              <button
                type="button"
                disabled={executandoTeste}
                onClick={handleLimparTeste}
                className="py-3 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/35 text-xs font-extrabold text-red-300 cursor-pointer disabled:opacity-50"
              >
                🧹 3. Limpar Testes
              </button>
            </div>

            {(roletaTeste !== null || simulacaoSorteio) && (
              <div className="rounded-2xl bg-zinc-950 border border-amber-400/35 p-4 text-center space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                  {roletaTeste !== null
                    ? 'Girando simulação...'
                    : 'Simulação Concluída (Não publicado)'}
                </span>
                <p className="font-display text-4xl font-black gold-gradient-text">
                  Nº {formatarPonto(roletaTeste ?? simulacaoSorteio!.numero)}
                </p>
                {roletaTeste === null && simulacaoSorteio && (
                  <p className="text-xs text-zinc-300">
                    <strong>{simulacaoSorteio.ganhador_nome}</strong> • Cartela de{' '}
                    <span className="text-amber-300">{simulacaoSorteio.vendedor_nome}</span>{' '}
                    (entre {simulacaoSorteio.total_elegiveis} pontos pagos)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL DE EDIÇÃO / CADASTRO MANUAL ================= */}
      {modalPonto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSalvarModalPonto}
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-zinc-950 border border-zinc-800 p-5 space-y-3.5 max-h-[92dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  {modalPonto.editandoExistente ? 'Gerenciar Ponto' : 'Cadastro Manual'}
                </p>
                <h3 className="text-lg font-extrabold text-white">
                  Ponto{modalPonto.numeros.length > 1 ? 's' : ''}{' '}
                  {modalPonto.numeros.map(formatarPonto).join(', ')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalPonto(null)}
                className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Status Pago vs Reservado */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModalPonto({ ...modalPonto, status: 'PAGO' })}
                className={`py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  modalPonto.status === 'PAGO'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                ✅ PAGO
              </button>
              <button
                type="button"
                onClick={() => setModalPonto({ ...modalPonto, status: 'RESERVADO' })}
                className={`py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  modalPonto.status === 'RESERVADO'
                    ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                ⏳ RESERVADO
              </button>
            </div>

            <input
              type="text"
              value={modalPonto.nome}
              onChange={(e) => setModalPonto({ ...modalPonto, nome: e.target.value })}
              placeholder="Nome completo do comprador *"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-sm text-white outline-none"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="tel"
                inputMode="tel"
                value={modalPonto.whatsapp}
                onChange={(e) =>
                  setModalPonto({
                    ...modalPonto,
                    whatsapp: aplicarMascaraTelefone(e.target.value),
                  })
                }
                placeholder="WhatsApp com DDD"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-xs text-white outline-none"
              />

              <select
                value={modalPonto.forma_pagamento}
                onChange={(e) =>
                  setModalPonto({
                    ...modalPonto,
                    forma_pagamento: e.target.value as FormaPagamento,
                  })
                }
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-xs text-white outline-none"
              >
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>

            <input
              type="text"
              value={modalPonto.endereco}
              onChange={(e) => setModalPonto({ ...modalPonto, endereco: e.target.value })}
              placeholder="Endereço (opcional)"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-xs text-white outline-none"
            />

            <input
              type="text"
              value={modalPonto.observacao}
              onChange={(e) =>
                setModalPonto({ ...modalPonto, observacao: e.target.value })
              }
              placeholder="Observação interna (opcional)"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-amber-400 px-3.5 py-2.5 text-xs text-white outline-none"
            />

            <button
              type="submit"
              disabled={salvandoModal}
              className="w-full gold-button py-3.5 rounded-2xl font-extrabold text-sm disabled:opacity-60 cursor-pointer"
            >
              {salvandoModal ? 'Salvando...' : 'Salvar Alterações'}
            </button>

            {modalPonto.editandoExistente && (
              <button
                type="button"
                onClick={handleLiberarPonto}
                disabled={salvandoModal}
                className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/35 text-xs font-bold text-red-300 cursor-pointer"
              >
                🗑️ Liberar ponto (voltar para Disponível)
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}