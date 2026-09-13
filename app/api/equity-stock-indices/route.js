export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const index = url.searchParams.get('index') || 'NIFTY 500';

  const fallbackData = [
    { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', lastPrice: 2980.15, change: 45.20, pChange: 1.54, open: 2940.00, high: 2990.00, low: 2935.00, previousClose: 2934.95 },
    { symbol: 'TCS', companyName: 'Tata Consultancy Services', lastPrice: 4250.80, change: -12.30, pChange: -0.29, open: 4270.00, high: 4285.00, low: 4240.00, previousClose: 4263.10 },
    { symbol: 'HDFCBANK', companyName: 'HDFC Bank Ltd', lastPrice: 1650.00, change: 18.00, pChange: 1.10, open: 1635.00, high: 1655.00, low: 1630.00, previousClose: 1632.00 },
    { symbol: 'ICICIBANK', companyName: 'ICICI Bank Ltd', lastPrice: 1210.30, change: 15.60, pChange: 1.31, open: 1198.00, high: 1215.00, low: 1195.00, previousClose: 1194.70 },
    { symbol: 'INFY', companyName: 'Infosys Ltd', lastPrice: 1890.50, change: 35.10, pChange: 1.89, open: 1860.00, high: 1895.00, low: 1855.00, previousClose: 1855.40 },
    { symbol: 'SWIGGY', companyName: 'Swiggy Limited', lastPrice: 520.40, change: 18.50, pChange: 3.68, open: 505.00, high: 525.00, low: 502.00, previousClose: 501.90 },
    { symbol: 'TATAMOTORS', companyName: 'Tata Motors Ltd', lastPrice: 995.80, change: 22.40, pChange: 2.30, open: 978.00, high: 1002.00, low: 975.00, previousClose: 973.40 },
    { symbol: 'TATASTEEL', companyName: 'Tata Steel Ltd', lastPrice: 154.20, change: 4.80, pChange: 3.21, open: 150.00, high: 155.50, low: 149.50, previousClose: 149.40 },
    { symbol: 'SBIN', companyName: 'State Bank of India', lastPrice: 840.50, change: 12.80, pChange: 1.55, open: 830.00, high: 844.00, low: 828.00, previousClose: 827.70 },
    { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Ltd', lastPrice: 1580.90, change: 28.40, pChange: 1.83, open: 1555.00, high: 1585.00, low: 1550.00, previousClose: 1552.50 }
  ];

  return new Response(JSON.stringify({ index, data: fallbackData }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
