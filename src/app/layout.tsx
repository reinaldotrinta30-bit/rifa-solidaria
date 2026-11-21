import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RIFA SOLIDÁRIA | PIX de R$ 100,00',
  description:
    'Escolha seus pontos da sorte por apenas R$ 3,00 e concorra a um PIX de R$ 100,00. Sorteio dia 28/11!',
  openGraph: {
    title: 'RIFA SOLIDÁRIA — PIX de R$ 100,00',
    description:
      'Cada ponto custa apenas R$ 3,00. Escolha seus números online e participe do sorteio dia 28/11!',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${plusJakarta.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased selection:bg-amber-400/30 selection:text-amber-200">
        {children}
      </body>
    </html>
  );
}