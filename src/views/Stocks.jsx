'use client';

import Stocks from '../components/stocks/Stocks';

export default function StocksPage() {
  return (
    <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
      <div className="row g-0">
        <div className="col-12">
          <Stocks />
        </div>
      </div>
    </div>
  );
}
