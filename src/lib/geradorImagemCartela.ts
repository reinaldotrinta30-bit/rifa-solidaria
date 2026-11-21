import { ConfiguracaoPublica, StatusPonto, Vendedor } from '@/types/rifa';
import { formatarMoeda, formatarPonto } from '@/lib/formatadores';

export interface PontoParaImagem {
  numero: number;
  vendedor_id: number;
  status: StatusPonto;
}

function retanguloArredondado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const raio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.arcTo(x + w, y, x + w, y + h, raio);
  ctx.arcTo(x + w, y + h, x, y + h, raio);
  ctx.arcTo(x, y + h, x, y, raio);
  ctx.arcTo(x, y, x + w, y, raio);
  ctx.closePath();
}

export async function gerarECompartilharImagemCartela(params: {
  config: ConfiguracaoPublica;
  pontos: PontoParaImagem[];
  vendedor?: Vendedor | null;
}): Promise<'compartilhado' | 'baixado'> {
  const { config, vendedor = null } = params;
  const pontosLista = (
    vendedor
      ? params.pontos.filter((p) => p.vendedor_id === vendedor.id)
      : params.pontos
  ).sort((a, b) => a.numero - b.numero);

  const W = 1080;
  const H = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Navegador não suporta geração de imagem.');

  // 1. Fundo escuro com brilho dourado radial
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, W, H);

  const glowTopo = ctx.createRadialGradient(W / 2, 120, 40, W / 2, 220, 680);
  glowTopo.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
  glowTopo.addColorStop(1, 'rgba(9, 9, 11, 0)');
  ctx.fillStyle = glowTopo;
  ctx.fillRect(0, 0, W, H);

  // Moldura externa sutil
  retanguloArredondado(ctx, 28, 28, W - 56, H - 56, 42);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 2. Cabeçalho
  // Pílula de data do sorteio
  retanguloArredondado(ctx, W / 2 - 190, 68, 380, 48, 24);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`SORTEIO • ${config.data_sorteio}`, W / 2, 92);

  // Título com gradiente dourado
  const gradTitulo = ctx.createLinearGradient(240, 140, 840, 210);
  gradTitulo.addColorStop(0, '#ffffff');
  gradTitulo.addColorStop(0.55, '#fde047');
  gradTitulo.addColorStop(1, '#f59e0b');
  ctx.fillStyle = gradTitulo;
  ctx.font = '900 72px system-ui, -apple-system, sans-serif';
  ctx.fillText(config.titulo.toUpperCase(), W / 2, 178);

  // Subtítulo: Prêmio + Valor ou Cartela do Vendedor
  ctx.fillStyle = '#e4e4e7';
  ctx.font = '700 30px system-ui, -apple-system, sans-serif';
  const linhaDestaque = vendedor
    ? `Cartela de ${vendedor.nome} (${formatarPonto(vendedor.ponto_inicio)} a ${formatarPonto(
        vendedor.ponto_fim
      )}) • ${formatarMoeda(config.valor_ponto)}/pt`
    : `${config.premio_descricao} • Apenas ${formatarMoeda(config.valor_ponto)} o ponto`;
  ctx.fillText(linhaDestaque, W / 2, 240);

  // 3. Barra de Progresso e Contadores
  const pagos = pontosLista.filter((p) => p.status === 'PAGO').length;
  const reservados = pontosLista.filter((p) => p.status === 'RESERVADO').length;
  const livres = pontosLista.length - pagos - reservados;
  const total = Math.max(1, pontosLista.length);
  const pct = Math.round(((pagos + reservados) / total) * 100);

  retanguloArredondado(ctx, 60, 282, W - 120, 96, 22);
  ctx.fillStyle = 'rgba(24, 24, 27, 0.92)';
  ctx.fill();
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fafafa';
  ctx.font = '700 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Progresso: ${pct}%`, 88, 314);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '600 23px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `${livres} livres  •  ${reservados} reserv.  •  ${pagos} pagos`,
    W - 88,
    314
  );

  // Trilha da barra
  const barX = 88;
  const barY = 342;
  const barW = W - 176;
  const barH = 16;
  retanguloArredondado(ctx, barX, barY, barW, barH, 8);
  ctx.fillStyle = '#27272a';
  ctx.fill();

  const wPagos = (pagos / total) * barW;
  const wRes = (reservados / total) * barW;
  if (wPagos > 0) {
    retanguloArredondado(ctx, barX, barY, Math.max(16, wPagos), barH, 8);
    ctx.fillStyle = '#34d399';
    ctx.fill();
  }
  if (wRes > 0) {
    retanguloArredondado(
      ctx,
      barX + wPagos,
      barY,
      Math.max(10, Math.min(barW - wPagos, wRes)),
      barH,
      6
    );
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
  }

  // 4. Grade Automática de Números (adapta tamanho para 175 pts ou cota individual)
  const gridX = 56;
  const gridY = 408;
  const gridW = W - 112;
  const gridH = 1270;

  const colunas =
    pontosLista.length <= 25 ? 5 : pontosLista.length <= 50 ? 5 : 10;
  const linhas = Math.ceil(pontosLista.length / colunas);
  const gap = colunas === 10 ? 10 : 18;

  const cellW = (gridW - gap * (colunas - 1)) / colunas;
  const cellH = Math.min(
    colunas === 10 ? 64 : 112,
    (gridH - gap * (linhas - 1)) / Math.max(1, linhas)
  );
  const alturaRealGrid = linhas * cellH + (linhas - 1) * gap;
  const offsetY = gridY + Math.max(0, (gridH - alturaRealGrid) / 2);

  const fontNum = colunas === 10 ? 27 : pontosLista.length <= 25 ? 46 : 38;

  pontosLista.forEach((p, idx) => {
    const col = idx % colunas;
    const lin = Math.floor(idx / colunas);
    const x = gridX + col * (cellW + gap);
    const y = offsetY + lin * (cellH + gap);

    retanguloArredondado(ctx, x, y, cellW, cellH, colunas === 10 ? 13 : 20);

    if (p.status === 'DISPONIVEL') {
      // Livre: bem nítido e chamativo
      ctx.fillStyle = '#18181b';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${fontNum}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText(formatarPonto(p.numero), x + cellW / 2, y + cellH / 2 + 1);
    } else if (p.status === 'RESERVADO') {
      // Reservado: âmbar suave + marcador
      ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(252, 211, 77, 0.65)';
      ctx.font = `700 ${fontNum - 3}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText(formatarPonto(p.numero), x + cellW / 2, y + cellH / 2 + 1);

      // Linha diagonal simples (reservado)
      ctx.beginPath();
      ctx.moveTo(x + 12, y + cellH - 12);
      ctx.lineTo(x + cellW - 12, y + 12);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      // PAGO: apagado e riscado com X (mostra claramente que já saiu!)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.10)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(161, 161, 170, 0.35)';
      ctx.font = `700 ${fontNum - 3}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText(formatarPonto(p.numero), x + cellW / 2, y + cellH / 2 + 1);

      // X suave sobre o número vendido
      const pad = colunas === 10 ? 14 : 24;
      ctx.beginPath();
      ctx.moveTo(x + pad, y + pad * 0.75);
      ctx.lineTo(x + cellW - pad, y + cellH - pad * 0.75);
      ctx.moveTo(x + cellW - pad, y + pad * 0.75);
      ctx.lineTo(x + pad, y + cellH - pad * 0.75);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
      ctx.lineWidth = colunas === 10 ? 3 : 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  });

  // 5. Rodapé com legenda e chamada para ação
  const rodapeY = 1715;
  retanguloArredondado(ctx, 60, rodapeY, W - 120, 145, 24);
  ctx.fillStyle = 'rgba(24, 24, 27, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Legenda visual
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d4d4d8';
  ctx.font = '600 23px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    '⬜ Branco = Livre    •    🟡 Riscado = Reservado    •    ❌ X = Vendido',
    W / 2,
    rodapeY + 46
  );

  // CTA
  ctx.fillStyle = '#fde047';
  ctx.font = '800 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Escolha seu ponto (${formatarMoeda(config.valor_ponto)}) e concorra a ${config.premio_descricao}!`,
    W / 2,
    rodapeY + 100
  );

  // 6. Exportação (compartilhamento nativo no celular ou download no PC)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png', 1)
  );
  if (!blob) throw new Error('Falha ao gerar arquivo PNG.');

  const nomeArquivo = vendedor
    ? `rifa-solidaria-${vendedor.slug}.png`
    : 'rifa-solidaria-geral.png';

  const arquivo = new File([blob], nomeArquivo, { type: 'image/png' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [arquivo] })
  ) {
    try {
      await navigator.share({
        files: [arquivo],
        title: config.titulo,
        text: `Confira os números disponíveis da ${config.titulo}!`,
      });
      return 'compartilhado';
    } catch {
      // Se o usuário cancelar o compartilhamento ou o navegador bloquear, cai no download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
  return 'baixado';
}