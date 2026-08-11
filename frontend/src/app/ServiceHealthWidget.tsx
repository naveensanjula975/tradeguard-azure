'use client';

import { useState, useEffect } from 'react';

interface ServiceStatus {
  name: string;
  url: string;
  healthy: boolean;
  checking: boolean;
}

const SERVICES = [
  { name: 'Ingestion', url: process.env.NEXT_PUBLIC_INGESTION_URL || 'http://localhost:8001' },
  { name: 'Anomaly ML', url: process.env.NEXT_PUBLIC_ANOMALY_URL || 'http://localhost:8002' },
  { name: 'Alert Service', url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8003' },
  { name: 'Simulator', url: process.env.NEXT_PUBLIC_SIMULATOR_URL || 'http://localhost:8004' },
  { name: 'Risk Engine', url: process.env.NEXT_PUBLIC_RISK_ENGINE_URL || 'http://localhost:8005' },
];

export default function ServiceHealthWidget() {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(
    SERVICES.map(s => ({ name: s.name, url: s.url, healthy: true, checking: false }))
  );

  const checkHealth = async () => {
    const updated = await Promise.all(
      SERVICES.map(async s => {
        try {
          const res = await fetch(`${s.url}/health`, { cache: 'no-store' });
          return { name: s.name, url: s.url, healthy: res.ok, checking: false };
        } catch {
          return { name: s.name, url: s.url, healthy: false, checking: false };
        }
      })
    );
    setStatuses(updated);
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const allHealthy = statuses.every(s => s.healthy);

  return (
    <footer style={{
      marginTop: 'auto',
      padding: '1rem 2rem',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      fontSize: '0.75rem',
      color: 'var(--text-secondary)',
    }}>
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: allHealthy ? 'var(--success)' : 'var(--warning)',
            boxShadow: allHealthy ? '0 0 8px var(--success)' : '0 0 8px var(--warning)',
            display: 'inline-block',
          }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            System Status: {allHealthy ? 'All Microservices Operational' : 'Degraded Services'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {statuses.map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: s.healthy ? 'var(--success)' : 'var(--danger)',
                display: 'inline-block',
              }} />
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
