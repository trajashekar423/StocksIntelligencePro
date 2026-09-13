'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiChevronDown, FiLogOut, FiTrendingUp, FiZap, FiShield } from 'react-icons/fi';
import useAuth from '../hooks/useAuth';
import { getUser } from '../utils/authStorage';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'TR';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function getUserName(user) {
  return user?.name || user?.merchant_name || user?.business_name || user?.email || 'Trader Pro';
}

export default function Header() {
  const pathname = usePathname() || '';
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const profileRef = useRef(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const userName = getUserName(user);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <header className="dl-topbar shadow-sm border-bottom bg-white px-3 py-2">
      <div className="d-flex align-items-center justify-content-between w-100 flex-wrap gap-2">
        {/* Brand Logo & Title */}
        <div className="d-flex align-items-center gap-3">
          <Link href="/stocks" className="d-flex align-items-center text-decoration-none">
            <img
              src="/stocks_intelligence_pro_logo.png"
              alt="Stocks Intelligence Pro"
              style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => {
                e.target.src = '/logo.png';
              }}
            />
          </Link>

          {/* Primary Navigation Pills */}
          <nav className="d-none d-md-flex align-items-center gap-2 ms-3" aria-label="Primary navigation">
            <Link
              href="/stocks"
              className={`btn btn-sm px-3 py-1.5 rounded-pill d-flex align-items-center gap-1.5 fw-bold transition-all ${
                pathname.startsWith('/stocks')
                  ? 'btn-primary shadow-sm text-white'
                  : 'btn-light text-secondary border'
              }`}
            >
              <FiTrendingUp size={16} />
              <span>Stocks Intelligence Pro</span>
            </Link>
            <Link
              href="/trading"
              className={`btn btn-sm px-3 py-1.5 rounded-pill d-flex align-items-center gap-1.5 fw-bold transition-all ${
                pathname.startsWith('/trading')
                  ? 'btn-success shadow-sm text-white'
                  : 'btn-light text-success border border-success-subtle'
              }`}
            >
              <FiZap size={16} />
              <span>Groww Trading</span>
            </Link>
          </nav>
        </div>

        {/* User Account Controls */}
        <div className="d-flex align-items-center gap-2">
          <div className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1.5 d-flex align-items-center gap-1 fw-bold">
            <span className="spinner-grow spinner-grow-sm text-success" role="status" style={{ width: 8, height: 8 }}></span>
            <span>Quant Engine Active</span>
          </div>

          {user && (
            <div className="position-relative ms-2" ref={profileRef}>
              <button
                type="button"
                className="btn btn-light btn-sm rounded-pill d-flex align-items-center gap-2 border px-2.5 py-1"
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                <div
                  className="rounded-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center"
                  style={{ width: 28, height: 28, fontSize: '0.75rem' }}
                >
                  {getInitials(userName)}
                </div>
                <span className="d-none d-sm-inline fw-semibold small text-dark">{userName}</span>
                <FiChevronDown size={14} className="text-muted" />
              </button>

              {menuOpen && (
                <div
                  className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg border p-2 z-3"
                  style={{ width: 200 }}
                >
                  <div className="px-3 py-2 border-bottom mb-1">
                    <p className="fw-bold mb-0 text-dark small">{userName}</p>
                    <span className="badge bg-primary-subtle text-primary rounded-pill small mt-1">PRO Subscriber</span>
                  </div>
                  <button
                    type="button"
                    className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 rounded-2 text-danger small fw-semibold"
                    onClick={logout}
                  >
                    <FiLogOut size={14} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
