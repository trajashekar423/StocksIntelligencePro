'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../../src/components/DashboardLayout';
import StocksView from '../../src/views/Stocks';

export default function Stocks() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DashboardLayout>
      {mounted ? (
        <StocksView />
      ) : (
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading Stocks Intelligence...</span>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
