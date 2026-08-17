import './globals.css';
import type { Metadata } from 'next';
import NavLink from './NavLink';
import ServiceHealthWidget from './ServiceHealthWidget';

export const metadata: Metadata = {
  title: 'TradeGuard — Trade Surveillance & Risk Platform',
  description: 'Real-time trade risk detection, ML anomaly scoring, and compliance investigation dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header className="header">
          <div className="logo">
            <div className="logo-shield">🛡</div>
            TradeGuard Azure
          </div>
          <nav className="nav">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/alerts">Alerts</NavLink>
            <NavLink href="/rules">Risk Rules</NavLink>
            <NavLink href="/audit">Audit Trail</NavLink>
            <NavLink href="/simulator">Simulator</NavLink>
            <NavLink href="/watchlist">Watchlist</NavLink>
          </nav>
        </header>
        <main className="container" style={{ flex: 1 }}>
          {children}
        </main>
        <ServiceHealthWidget />
      </body>
    </html>
  );
}
