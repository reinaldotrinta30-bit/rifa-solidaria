import { ConfiguracaoPublica, StatusPonto, Vendedor } from '@/types/rifa';
import { formatarPonto } from '@/lib/formatadores';

export interface PontoParaImagem {
  numero: number;
  vendedor_id: number;
  status: StatusPonto;
}

// Coordenadas proporcionais (0 a 1) da grade 15x12 na imagem public/rifa-oficial.jpg
// Caso queira fazer microajuste fino depois, basta alterar estes 4 números:
const GRID_LEFT = 0.024;
const GRID_RIGHT = 0.976;
const GRID_TOP = 0.383;
const GRID_BOTTOM = 0.781;
const COLUNAS = 15;
const LINHAS = 12;

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

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          'Imagem oficial não encontrada. Salve a arte da rifa em public/rifa-oficial.jpg.'
        )
      );
    img.src = src;
  });
}

export async function gerarECompartilharImagemCartela(params: {
  config: ConfiguracaoPublica;
  pontos: PontoParaImagem[];
  vendedor?: Vendedor | null;
}): Promise<'compartilhado' | 'baixado'> {
  const { config, pontos, vendedor = null } = params;

  const img = await carregarImagem('/rifa-oficial.jpg');
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Navegador não suporta geração de imagem.');

  // 1. Desenha a arte oficial intacta no fundo
  ctx.drawImage(img, 0, 0, W, H);

  const colStep = (GRID_RIGHT - GRID_LEFT) / COLUNAS;
  const rowStep = (GRID_BOTTOM - GRID_TOP) / LINHAS;
  const cellW = colStep * W;
  const cellH = rowStep * H;

  const mapaPontos = new Map(pontos.map((p) => [p.numero, p]));

  // 2. Percorre os 175 números e marca cada quadradinho
  for (let num = 1; num <= 175; num++) {
    const p = mapaPontos.get(num);
    if (!p) continue;

    const idx = num - 1;
    const col = idx % COLUNAS;
    const row = Math.floor(idx / COLUNAS);

    const insetX = cellW * 0.06;
    const insetY = cellH * 0.07;
    const x = (GRID_LEFT + col * colStep) * W + insetX;
    const y = (GRID_TOP + row * rowStep) * H + insetY;
    const w = cellW - insetX * 2;
    const h = cellH - insetY * 2;
    const raio = Math.min(w, h) * 0.22;

    const foraDaCota = vendedor !== null && p.vendedor_id !== vendedor.id;

    if (foraDaCota) {
      // Suaviza números que pertencem a outros vendedores
      retanguloArredondado(ctx, x, y, w, h, raio);
      ctx.fillStyle = 'rgba(255, 245, 210, 0.78)';
      ctx.fill();
      continue;
    }

    if (p.status === 'PAGO') {
      // Fundo semi-transparente escuro + X vermelho marcante
      retanguloArredondado(ctx, x, y, w, h, raio);
      ctx.fillStyle = 'rgba(18, 33, 56, 0.52)';
      ctx.fill();

      const padX = w * 0.22;
      const padY = h * 0.2;
      ctx.beginPath();
      ctx.moveTo(x + padX, y + padY);
      ctx.lineTo(x + w - padX, y + h - padY);
      ctx.moveTo(x + w - padX, y + padY);
      ctx.lineTo(x + padX, y + h - padY);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(2.5, Math.min(w, h) * 0.13);
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (p.status === 'RESERVADO') {
      // Destaque laranja + traço diagonal (aguardando PIX)
      retanguloArredondado(ctx, x, y, w, h, raio);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.42)';
      ctx.fill();

      const padX = w * 0.2;
      const padY = h * 0.2;
      ctx.beginPath();
      ctx.moveTo(x + padX, y + h - padY);
      ctx.lineTo(x + w - padX, y + padY);
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = Math.max(2.2, Math.min(w, h) * 0.11);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  // 3. Etiqueta elegante no espaço vazio da última linha (à direita do nº 175)
  const pontosEscopo = vendedor
    ? pontos.filter((p) => p.vendedor_id === vendedor.id)
    : pontos;
  const livres = pontosEscopo.filter((p) => p.status === 'DISPONIVEL').length;

  const badgeX = (GRID_LEFT + 10.15 * colStep) * W;
  const badgeY = (GRID_TOP + 11.05 * rowStep) * H;
  const badgeW = (GRID_RIGHT - (GRID_LEFT + 10.15 * colStep)) * W;
  const badgeH = rowStep * 0.9 * H;

  retanguloArredondado(ctx, badgeX, badgeY, badgeW, badgeH, badgeH * 0.35);
  ctx.fillStyle = '#132743';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fde047';
  const fontSize = Math.max(11, Math.round(badgeH * 0.42));
  ctx.font = `800 ${fontSize}px system-ui, -apple-system, sans-serif`;

  const textoBadge = vendedor
    ? `${vendedor.nome.toUpperCase()} (${formatarPonto(vendedor.ponto_inicio)}–${formatarPonto(
        vendedor.ponto_fim
      )}) • ${livres} livres`
    : `✕ VENDIDO  •  ${livres} LIVRES`;

  ctx.fillText(textoBadge, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1, badgeW - 14);

  // 4. Exportação (compartilha direto no celular ou baixa PNG no PC)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png', 1)
  );
  if (!blob) throw new Error('Falha ao gerar arquivo PNG.');

  const nomeArquivo = vendedor
    ? `rifa-${vendedor.slug}.png`
    : 'rifa-oficial-atualizada.png';

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
      // Fallback para download
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