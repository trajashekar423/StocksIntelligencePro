'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

const SEVERITY_COLORS = {
  GREEN: '#10b981',
  AMBER: '#f59e0b',
  RED: '#ef4444',
  CRITICAL: '#1f1f1f',
};

const SEVERITY_BG_CLASSES = {
  GREEN: 'bg-success',
  AMBER: 'bg-warning text-dark',
  RED: 'bg-danger',
  CRITICAL: 'bg-dark border border-danger',
};

const SEVERITY_EMOJI = {
  GREEN: '🟢',
  AMBER: '🟡',
  RED: '🔴',
  CRITICAL: '💀',
};

function getRelativeTime(dateInput) {
  if (!dateInput) return 'Unknown time';
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  
  if (diffMs < 0) return 'Just now';
  
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours === 1) return '1 hr ago';
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

export default function GlobalRiskAlertBell({
  alerts = [],
  overallRiskLevel = 'GREEN',
  overallRiskScore = 0,
  riskSummary = 'No risk data available',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const hasAlerts = alerts && alerts.length > 0;
  const isDanger = overallRiskLevel === 'RED' || overallRiskLevel === 'CRITICAL';
  
  const badgeCount = hasAlerts ? alerts.length : 0;
  
  return (
    <div className="position-relative d-inline-block" ref={dropdownRef}>
      <style>
        {`
          @keyframes bell-pulse {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
          .risk-bell-pulse {
            animation: bell-pulse 2s infinite;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
          }
        `}
      </style>
      
      <button 
        className={`btn btn-sm rounded-pill border position-relative ${isDanger ? 'risk-bell-pulse' : ''}`}
        style={{ 
          backgroundColor: '#2b2b2b', 
          borderColor: '#444', 
          fontSize: '1.1rem',
          padding: '0.25rem 0.6rem'
        }}
        onClick={toggleDropdown}
        aria-label="Global Risk Alerts"
      >
        🔔
        {badgeCount > 0 && (
          <span 
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style={{ fontSize: '0.65rem', padding: '0.25em 0.5em' }}
          >
            {badgeCount}
            <span className="visually-hidden">unread alerts</span>
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className="position-absolute bg-dark text-white shadow-lg rounded"
          style={{
            top: 'calc(100% + 8px)',
            right: 0,
            width: '380px',
            maxWidth: '100vw',
            zIndex: 9999,
            border: '1px solid #444',
            overflow: 'hidden'
          }}
        >
          {/* Header Section */}
          <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <div>
              <div className="d-flex align-items-center mb-1">
                <span className={`badge ${SEVERITY_BG_CLASSES[overallRiskLevel] || 'bg-secondary'} me-2`}>
                  {overallRiskLevel} RISK
                </span>
                <span className="fw-bold" style={{ fontSize: '0.9rem' }}>Score: {overallRiskScore}/100</span>
              </div>
              <div className="text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.2' }}>
                {riskSummary}
              </div>
            </div>
            <button 
              className="btn btn-sm btn-link text-white text-decoration-none" 
              onClick={() => setIsOpen(false)}
              style={{ fontSize: '1.5rem', padding: '0', lineHeight: '1' }}
            >
              &times;
            </button>
          </div>

          {/* Alert List */}
          <div 
            className="custom-scrollbar"
            style={{ 
              maxHeight: '400px', 
              overflowY: 'auto' 
            }}
          >
            {!hasAlerts ? (
              <div className="text-center p-4">
                <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🛡️</div>
                <h6 className="text-success fw-bold mb-2">✅ All Clear</h6>
                <p className="text-muted small mb-0">No global risk alerts. Markets are stable for normal trading.</p>
              </div>
            ) : (
              <div className="d-flex flex-column">
                {alerts.map((alert) => {
                  const severityColor = SEVERITY_COLORS[alert.severity] || '#6c757d';
                  const emoji = SEVERITY_EMOJI[alert.severity] || '⚠️';
                  
                  return (
                    <div 
                      key={alert.id}
                      className="p-3 border-bottom border-secondary"
                      style={{ 
                        borderLeft: `4px solid ${severityColor}`,
                        backgroundColor: alert.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div className="fw-bold" style={{ fontSize: '0.95rem' }}>
                          {emoji} {alert.title}
                        </div>
                        <div className="text-muted flex-shrink-0" style={{ fontSize: '0.75rem', marginLeft: '8px' }}>
                          {getRelativeTime(alert.triggeredAt)}
                        </div>
                      </div>
                      
                      <p className="text-light opacity-75 mb-2" style={{ fontSize: '0.85rem' }}>
                        {alert.description}
                      </p>

                      {alert.sectorsToAvoid && alert.sectorsToAvoid.length > 0 && (
                        <div className="mb-2">
                          <div className="fw-bold mb-1" style={{ fontSize: '0.8rem' }}>❌ Sectors to AVOID:</div>
                          <div className="d-flex flex-wrap gap-1">
                            {alert.sectorsToAvoid.map((sector, idx) => (
                              <span 
                                key={idx} 
                                className="badge bg-danger rounded-pill" 
                                style={{ fontSize: '0.7rem' }}
                                title={sector.reason}
                              >
                                {sector.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {alert.sectorsToTry && alert.sectorsToTry.length > 0 && (
                        <div>
                          <div className="fw-bold mb-1" style={{ fontSize: '0.8rem' }}>✅ Sectors to TRY:</div>
                          <div className="d-flex flex-wrap gap-1">
                            {alert.sectorsToTry.map((sector, idx) => (
                              <span 
                                key={idx} 
                                className="badge bg-success rounded-pill" 
                                style={{ fontSize: '0.7rem' }}
                                title={sector.reason}
                              >
                                {sector.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
