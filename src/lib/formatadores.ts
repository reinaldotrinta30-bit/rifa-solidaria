export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatarPonto(numero: number): string {
  return String(numero).padStart(3, '0');
}

export function aplicarMascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function validarTelefoneBR(valor: string): boolean {
  const d = valor.replace(/\D/g, '');
  return d.length === 10 || d.length === 11;
}

export function gerarLinkWhatsApp(telefone: string, mensagem: string): string {
  const digitos = telefone.replace(/\D/g, '');
  const textoCodificado = encodeURIComponent(mensagem.normalize('NFC'));

  if (digitos.length < 10) {
    return `https://api.whatsapp.com/send?text=${textoCodificado}`;
  }

  const comDDI =
    digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`;

  return `https://api.whatsapp.com/send?phone=${comDDI}&text=${textoCodificado}`;
}

export function formatarDataHoraBR(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}