'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import sidebarConfig from '../config/sidebarConfig.json';
import themeConfig from '../config/themeConfig.json';
import * as Icons from 'react-icons/fi';

// Map icon name from config to react-icons/fi (Feather Icons)
function getIcon(iconName) {
  const map = {
    users: Icons.FiUsers,
    gift: Icons.FiGift,
    'credit-card': Icons.FiCreditCard,
    settings: Icons.FiSettings,
    'log-in': Icons.FiLogIn,
    dashboard: Icons.FiGrid,
  };
  return map[iconName] || Icons.FiCircle;
}

export default function Sidebar({ collapsed, mobileOpen = false, onToggle, onClose }) {
  const pathname = usePathname() || '';
  const [navItems, setNavItems] = useState([]);
  const [theme, setTheme] = useState({});

  useEffect(() => {
    setNavItems(sidebarConfig);
    setTheme(themeConfig);
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sb-overlay" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        id="dashboard-sidebar"
        className={`sidebar sb-sidebar d-flex flex-column p-3 ${collapsed ? 'sb-collapsed' : ''} ${mobileOpen ? 'sb-mobile-open' : ''}`}
        style={{
          color: theme.sidebarColor,
          width: collapsed ? theme.sidebarCollapsedWidth : theme.sidebarExpandedWidth,
          fontFamily: theme.fontFamily,
        }}
      >
        {/* Brand */}
        <div className="sb-brand d-flex align-items-center gap-2 px-1 py-2">
          <img
            src="/stocks_intelligence_pro_logo.png"
            alt="Stocks Intelligence Pro"
            style={{ height: collapsed ? '28px' : '36px', width: 'auto', objectFit: 'contain' }}
            onError={(e) => {
              e.target.src = '/logo.png';
            }}
          />
        </div>

        {/* Nav */}
        <nav className="sb-nav d-flex flex-column gap-2">
          <p className="sb-section-label text-muted small fw-bold">{!collapsed && 'MAIN MENU'}</p>
          {navItems.filter((item) => item.visibility !== false).map(({ label, path, icon, color }) => {
            const Icon = getIcon(icon);
            const isActive = pathname === path || (path !== '/' && pathname.startsWith(path));
            return (
              <div key={path} className={label === 'Settings' ? 'sb-admin-group' : undefined}>
                {label === 'Settings' && (
                  <p className="sb-section-label sb-admin-label text-muted small fw-bold">
                    {!collapsed && 'ADMIN'}
                  </p>
                )}
                <Link
                  href={path}
                  onClick={onClose}
                  className={`sidebar-item sb-nav-item d-flex align-items-center gap-2 rounded-3 fw-semibold ${isActive ? 'active sb-active' : ''}`}
                  style={isActive ? {
                    color: theme.sidebarActiveColor,
                    ...(color ? { color } : {}),
                  } : (color ? { color } : {})}
                >
                  <span className="sb-icon"><Icon size={18} /></span>
                  {!collapsed && <span className="sb-label">{label}</span>}
                </Link>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
