export const dynamic = 'force-dynamic';

export async function GET() {
  const fallbackTopTen = [
    { symbol: 'SWIGGY', companyName: 'Swiggy Limited', lastPrice: 520.40, change: 18.50, pChange: 3.68, volume: 12500000 },
    { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', lastPrice: 2980.15, change: 45.20, pChange: 1.54, volume: 8500000 },
    { symbol: 'TATAMOTORS', companyName: 'Tata Motors Limited', lastPrice: 995.80, change: 22.40, pChange: 2.30, volume: 14200000 },
    { symbol: 'INFY', companyName: 'Infosys Limited', lastPrice: 1890.50, change: 35.10, pChange: 1.89, volume: 9100000 },
    { symbol: 'TATASTEEL', companyName: 'Tata Steel Limited', lastPrice: 154.20, change: 4.80, pChange: 3.21, volume: 22000000 },
    { symbol: 'HDFCBANK', companyName: 'HDFC Bank Limited', lastPrice: 1650.00, change: 18.00, pChange: 1.10, volume: 11000000 },
    { symbol: 'ICICIBANK', companyName: 'ICICI Bank Limited', lastPrice: 1210.30, change: 15.60, pChange: 1.31, volume: 9500000 },
    { symbol: 'SBIN', companyName: 'State Bank of India', lastPrice: 840.50, change: 12.80, pChange: 1.55, volume: 13500000 },
    { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Limited', lastPrice: 1580.90, change: 28.40, pChange: 1.83, volume: 6200000 },
    { symbol: 'LT', companyName: 'Larsen & Toubro Limited', lastPrice: 3650.00, change: 55.00, pChange: 1.53, volume: 4100000 }
  ];

  return new Response(JSON.stringify({ ok: true, data: fallbackTopTen }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

