import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'TradeGuard - Trade Surveillance & Risk Platform',
  description: 'Real-time trade risk detection and investigation dashboard',
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
            🛡️ TradeGuard Azure
          </div>
          <nav className="nav">
            <Link href="/" className="nav-link">Dashboard</Link>
            <Link href="/alerts" className="nav-link">Alerts</Link>
            <Link href="/rules" className="nav-link">Risk Rules</Link>
          </nav>
        </header>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
