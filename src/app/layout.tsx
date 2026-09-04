import type { Metadata } from 'next';
import './globals.css';
import InvisibleTracker from '@/components/InvisibleTracker';
import AIChatWidget from '@/components/AIChatWidget';

export const metadata: Metadata = {
  title: 'Expedientes — Fundamiga',
  description: 'Gestor de expedientes de personal Fundamiga',
  icons: { icon: '/LOGO.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased bg-slate-50 text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <InvisibleTracker />
        {children}
        <AIChatWidget />
      </body>
    </html>
  );
}


