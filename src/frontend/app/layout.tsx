import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Topbar } from '@/components/topbar';

export const metadata: Metadata = {
  title: 'ACS Inteligente — SMS Rio',
  description: 'Apoio à decisão para Agentes Comunitários de Saúde',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Topbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 sm:pb-8">{children}</main>
        {/* FAB mobile — acesso rápido a registrar visita */}
        <Link
          href="/registrar"
          aria-label="Registrar visita"
          className="md:hidden fixed bottom-5 right-5 z-50 flex items-center justify-center rounded-full shadow-lg"
          style={{
            width: 56, height: 56,
            background: 'var(--blue-primary)',
            color: '#fff',
            fontSize: 28,
            fontWeight: 900,
            boxShadow: 'var(--shadow-lg)',
            textDecoration: 'none',
          }}
        >
          +
        </Link>
        <footer
          style={{ background: 'var(--blue-dark)', color: 'rgba(255,255,255,0.6)' }}
          className="mt-16 px-6 py-8 text-center text-xs"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '13px' }}>
              ACS Inteligente
            </span>
            <span>
              Hackathon Claude Impact Lab 2026 ·{' '}
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                Secretaria Municipal de Saúde · Prefeitura do Rio de Janeiro
              </span>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
