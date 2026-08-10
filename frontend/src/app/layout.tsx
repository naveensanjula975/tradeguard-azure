import './globals.css';
import type { Metadata } from 'next';
import NavLink from './NavLink';

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
      <body>
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
          </nav>
        </header>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
