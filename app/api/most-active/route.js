export const dynamic = 'force-dynamic';

export async function GET() {
  const fallbackMostActive = [
    { symbol: 'TATASTEEL', companyName: 'Tata Steel Limited', lastPrice: 154.20, change: 4.80, pChange: 3.21, volume: 35000000 },
    { symbol: 'SWIGGY', companyName: 'Swiggy Limited', lastPrice: 520.40, change: 18.50, pChange: 3.68, volume: 28000000 },
    { symbol: 'ZOMATO', companyName: 'Zomato Limited', lastPrice: 245.10, change: 6.20, pChange: 2.60, volume: 25000000 },
    { symbol: 'TATAMOTORS', companyName: 'Tata Motors Limited', lastPrice: 995.80, change: 22.40, pChange: 2.30, volume: 18000000 },
    { symbol: 'SBIN', companyName: 'State Bank of India', lastPrice: 840.50, change: 12.80, pChange: 1.55, volume: 16500000 },
    { symbol: 'HDFCBANK', companyName: 'HDFC Bank Limited', lastPrice: 1650.00, change: 18.00, pChange: 1.10, volume: 14000000 },
    { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', lastPrice: 2980.15, change: 45.20, pChange: 1.54, volume: 12000000 },
    { symbol: 'ICICIBANK', companyName: 'ICICI Bank Limited', lastPrice: 1210.30, change: 15.60, pChange: 1.31, volume: 11500000 }
  ];

  return new Response(JSON.stringify({ ok: true, data: fallbackMostActive }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

