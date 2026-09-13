'use client';

import Header from './Header';

export default function DashboardLayout({ children }) {
  return (
    <div className="dl-wrapper">
      <main className="w-100 overflow-hidden">
        <Header />
        <div className="dl-page">
          <div className="container-fluid px-0">
            <div className="row g-0">
              <div className="col-12">
                {children}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
