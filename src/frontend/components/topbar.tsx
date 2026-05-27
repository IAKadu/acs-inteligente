'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const PRIMARY_NAV = [
  { href: '/',          label: 'Visão Geral' },
  { href: '/equipes',   label: 'Equipes' },
  { href: '/visitas',   label: 'Visitas' },
  { href: '/pacientes', label: 'Pacientes' },
  { href: '/eventos',   label: 'Eventos' },
];

const TOOLS_NAV = [
  { href: '/agenda', label: 'Agenda ACS' },
  { href: '/chat',   label: 'Chat IA' },
  { href: '/score',  label: 'Entenda o Score' },
];

const ALL_NAV = [...PRIMARY_NAV, ...TOOLS_NAV];

export function Topbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? path === '/' : path.startsWith(href);

  return (
    <header>
      {/* Utility bar */}
      <div
        style={{ background: 'var(--grey-bar)' }}
        className="text-white px-4 sm:px-6 py-2 flex items-center text-[11px] font-bold uppercase tracking-[0.15em]"
      >
        <span className="opacity-70">Prefeitura.Rio</span>
        <span className="ml-4 opacity-50 hidden sm:inline">Saúde da Família · SMS Rio</span>
        <span className="ml-auto opacity-50 hidden md:inline">Claude Impact Lab 2026</span>
      </div>

      {/* Main nav */}
      <div style={{ background: 'var(--blue-primary)' }} className="text-white px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand with logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0" style={{ textDecoration: 'none' }}>
            <Image
              src="/logo-prefeitura-saude.png"
              alt="Prefeitura Rio — Secretaria Municipal de Saúde"
              width={120}
              height={40}
              style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
              priority
            />
            <span
              className="opacity-60 text-sm hidden lg:inline"
              style={{ color: '#fff', borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '12px' }}
            >
              ACS Inteligente
            </span>
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden md:flex items-center overflow-x-auto">
            <div className="flex items-center">
              {PRIMARY_NAV.map(n => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="t-nav-link px-3 py-5 whitespace-nowrap transition-all border-b-2"
                  style={{
                    color: '#ffffff',
                    opacity: isActive(n.href) ? 1 : 0.6,
                    borderBottomColor: isActive(n.href) ? 'var(--cyan-accent)' : 'transparent',
                  }}
                >
                  {n.label}
                </Link>
              ))}
            </div>

            <span
              className="mx-3 h-5 w-px shrink-0"
              style={{ background: 'rgba(255,255,255,0.25)' }}
            />

            <div className="flex items-center">
              {TOOLS_NAV.map(n => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="t-nav-link px-3 py-5 whitespace-nowrap transition-all border-b-2"
                  style={{
                    color: '#ffffff',
                    opacity: isActive(n.href) ? 1 : 0.5,
                    fontSize: '11px',
                    borderBottomColor: isActive(n.href) ? 'var(--green-accent)' : 'transparent',
                  }}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </nav>

          {/* Hamburger — visible on mobile only */}
          <button
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            className="md:hidden flex flex-col justify-center items-center w-11 h-11 gap-1.5 rounded"
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer' }}
          >
            <span
              style={{
                display: 'block', width: 22, height: 2, background: '#fff', borderRadius: 2,
                transform: open ? 'translateY(6px) rotate(45deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
            <span
              style={{
                display: 'block', width: 22, height: 2, background: '#fff', borderRadius: 2,
                opacity: open ? 0 : 1,
                transition: 'opacity 0.2s',
              }}
            />
            <span
              style={{
                display: 'block', width: 22, height: 2, background: '#fff', borderRadius: 2,
                transform: open ? 'translateY(-6px) rotate(-45deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {open && (
        <div
          className="md:hidden"
          style={{
            background: 'var(--blue-dark)',
            borderBottom: '3px solid var(--cyan-accent)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Primary links */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Navegação
            </p>
            {PRIMARY_NAV.map(n => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 py-3 border-b"
                style={{
                  color: isActive(n.href) ? 'var(--cyan-accent)' : '#fff',
                  borderColor: 'rgba(255,255,255,0.08)',
                  fontWeight: isActive(n.href) ? 700 : 400,
                  textDecoration: 'none',
                  fontSize: '15px',
                }}
              >
                {isActive(n.href) && (
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--cyan-accent)', display: 'inline-block', flexShrink: 0 }} />
                )}
                {n.label}
              </Link>
            ))}
          </div>

          {/* Tools links */}
          <div className="px-4 pt-3 pb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Ferramentas
            </p>
            {TOOLS_NAV.map(n => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 py-3 border-b"
                style={{
                  color: isActive(n.href) ? 'var(--green-accent)' : 'rgba(255,255,255,0.8)',
                  borderColor: 'rgba(255,255,255,0.08)',
                  fontWeight: isActive(n.href) ? 700 : 400,
                  textDecoration: 'none',
                  fontSize: '15px',
                }}
              >
                {isActive(n.href) && (
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--green-accent)', display: 'inline-block', flexShrink: 0 }} />
                )}
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
