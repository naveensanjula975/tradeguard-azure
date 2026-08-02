import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.75rem' }}>Surveillance Overview</h1>
      
      <div className="grid">
        <div className="card">
          <div className="card-title">Events Processed Today</div>
          <div className="card-value">12,450</div>
        </div>
        <div className="card">
          <div className="card-title">Total Open Alerts</div>
          <div className="card-value" style={{ color: 'var(--warning)' }}>18</div>
        </div>
        <div className="card">
          <div className="card-title">Critical Alerts</div>
          <div className="card-value" style={{ color: 'var(--danger)' }}>3</div>
        </div>
        <div className="card">
          <div className="card-title">High Risk Traders</div>
          <div className="card-value">4</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Recent Critical Alerts</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '0.75rem' }}>Alert ID</th>
              <th style={{ padding: '0.75rem' }}>Trader</th>
              <th style={{ padding: '0.75rem' }}>Rule</th>
              <th style={{ padding: '0.75rem' }}>Risk Score</th>
              <th style={{ padding: '0.75rem' }}>Severity</th>
              <th style={{ padding: '0.75rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.75rem' }}>ALT-7001</td>
              <td style={{ padding: '0.75rem' }}>TRD-1001</td>
              <td style={{ padding: '0.75rem' }}>New Device & High Value</td>
              <td style={{ padding: '0.75rem' }}>91.4</td>
              <td style={{ padding: '0.75rem' }}><span className="badge badge-critical">CRITICAL</span></td>
              <td style={{ padding: '0.75rem' }}>NEW</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.75rem' }}>ALT-7002</td>
              <td style={{ padding: '0.75rem' }}>TRD-1042</td>
              <td style={{ padding: '0.75rem' }}>Large Order</td>
              <td style={{ padding: '0.75rem' }}>78.0</td>
              <td style={{ padding: '0.75rem' }}><span className="badge badge-high">HIGH</span></td>
              <td style={{ padding: '0.75rem' }}>UNDER_REVIEW</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
