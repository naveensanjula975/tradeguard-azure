'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
  badgeType?: 'danger' | 'warning' | 'accent';
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Surveillance & Monitoring',
    items: [
      { name: 'Dashboard', href: '/', icon: '📊' },
      { name: 'Alerts', href: '/alerts', icon: '🚨', badge: 'Live', badgeType: 'danger' },
      { name: 'Trader Profiles', href: '/traders', icon: '👤', badge: 'New', badgeType: 'accent' },
      { name: 'Watchlist', href: '/watchlist', icon: '👁️' },
    ],
  },
  {
    title: 'Compliance & Governance',
    items: [
      { name: 'Cases & Investigations', href: '/cases', icon: '📁', badge: '3 Open', badgeType: 'warning' },
      { name: 'Risk Rules', href: '/rules', icon: '⚖️' },
      { name: 'Audit Trail', href: '/audit', icon: '📜' },
    ],
  },
  {
    title: 'Engineering & Simulation',
    items: [
      { name: 'Simulator', href: '/simulator', icon: '🧪' },
      { name: 'Code Gen', href: '/codegen', icon: '⚡' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Top Header */}
      <div className="mobile-header">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <div className="logo">
          <div className="logo-shield">🛡</div>
          <span>TradeGuard</span>
        </div>
        <div className="live-badge-sm">
          <span className="live-dot" />
          Live
        </div>
      </div>

      {/* Main Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand / Logo */}
        <div className="sidebar-brand">
          <Link href="/" className="sidebar-logo-link">
            <div className="logo-shield">🛡</div>
            {!collapsed && (
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-name">TradeGuard</span>
                <span className="sidebar-brand-badge">Azure AI</span>
              </div>
            )}
          </Link>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Status Chip */}
        {!collapsed && (
          <div className="sidebar-status-banner">
            <span className="live-dot" />
            <div className="sidebar-status-info">
              <span className="status-title">Surveillance Online</span>
              <span className="status-sub">5 Microservices Active</span>
            </div>
          </div>
        )}

        {/* Nav Sections */}
        <div className="sidebar-nav-scroll">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="sidebar-section">
              {!collapsed && (
                <div className="sidebar-section-title">{section.title}</div>
              )}
              <nav className="sidebar-nav-items">
                {section.items.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                      title={collapsed ? item.name : undefined}
                    >
                      <span className="sidebar-nav-icon">{item.icon}</span>
                      {!collapsed && (
                        <span className="sidebar-nav-label">{item.name}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span
                          className={`sidebar-badge sidebar-badge-${item.badgeType || 'accent'}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {!collapsed ? (
            <div className="sidebar-user-card">
              <div className="sidebar-avatar">CO</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">Compliance Lead</div>
                <div className="sidebar-user-role">US-East · Azure Gov</div>
              </div>
              <div className="sidebar-env-tag">v2.4</div>
            </div>
          ) : (
            <div className="sidebar-avatar-mini" title="Compliance Officer (v2.4)">
              CO
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
