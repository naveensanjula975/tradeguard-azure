import './globals.css';
import type { Metadata } from 'next';
import Sidebar from './Sidebar';
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
      <body>
        <div className="app-shell">
          <Sidebar />
          <div className="app-main-wrapper">
            <main className="app-content-container">
              {children}
            </main>
            <ServiceHealthWidget />
          </div>
        </div>
      </body>
    </html>
  );
}
