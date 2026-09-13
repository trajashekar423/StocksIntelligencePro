export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const index = url.searchParams.get('index') || 'NIFTY 500';

  const fallbackData = [
    { symbol: 'SUZLON', companyName: 'Suzlon Energy Ltd', lastPrice: 74.50, change: 3.40, pChange: 4.80, open: 71.20, high: 75.00, low: 71.00, previousClose: 71.10, totalTradedVolume: 65000000 },
    { symbol: 'YESBANK', companyName: 'Yes Bank Ltd', lastPrice: 24.15, change: 0.75, pChange: 3.20, open: 23.40, high: 24.50, low: 23.30, previousClose: 23.40, totalTradedVolume: 85000000 },
    { symbol: 'IDEA', companyName: 'Vodafone Idea Ltd', lastPrice: 14.80, change: 0.80, pChange: 5.71, open: 14.00, high: 15.00, low: 13.90, previousClose: 14.00, totalTradedVolume: 120000000 },
    { symbol: 'PCJEWELLER', companyName: 'PC Jeweller Ltd', lastPrice: 168.40, change: 8.00, pChange: 4.98, open: 160.40, high: 168.40, low: 160.00, previousClose: 160.40, totalTradedVolume: 14000000 },
    { symbol: 'MOTISONS', companyName: 'Motisons Jewellers Ltd', lastPrice: 285.60, change: 16.80, pChange: 6.25, open: 269.00, high: 290.00, low: 268.00, previousClose: 268.80, totalTradedVolume: 9200000 },
    { symbol: 'IFCI', companyName: 'IFCI Ltd', lastPrice: 68.20, change: 3.00, pChange: 4.60, open: 65.20, high: 69.00, low: 65.00, previousClose: 65.20, totalTradedVolume: 32000000 },
    { symbol: 'RENUKA', companyName: 'Shree Renuka Sugars Ltd', lastPrice: 48.90, change: 1.80, pChange: 3.80, open: 47.10, high: 49.50, low: 47.00, previousClose: 47.10, totalTradedVolume: 18000000 },
    { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', lastPrice: 2980.15, change: 45.20, pChange: 1.54, open: 2940.00, high: 2990.00, low: 2935.00, previousClose: 2934.95, totalTradedVolume: 8500000 },
    { symbol: 'TCS', companyName: 'Tata Consultancy Services', lastPrice: 4250.80, change: -12.30, pChange: -0.29, open: 4270.00, high: 4285.00, low: 4240.00, previousClose: 4263.10, totalTradedVolume: 3200000 },
    { symbol: 'HDFCBANK', companyName: 'HDFC Bank Ltd', lastPrice: 1650.00, change: 18.00, pChange: 1.10, open: 1635.00, high: 1655.00, low: 1630.00, previousClose: 1632.00, totalTradedVolume: 11000000 },
    { symbol: 'ICICIBANK', companyName: 'ICICI Bank Ltd', lastPrice: 1210.30, change: 15.60, pChange: 1.31, open: 1198.00, high: 1215.00, low: 1195.00, previousClose: 1194.70, totalTradedVolume: 9500000 },
    { symbol: 'INFY', companyName: 'Infosys Ltd', lastPrice: 1890.50, change: 35.10, pChange: 1.89, open: 1860.00, high: 1895.00, low: 1855.00, previousClose: 1855.40, totalTradedVolume: 9100000 },
    { symbol: 'SWIGGY', companyName: 'Swiggy Limited', lastPrice: 520.40, change: 18.50, pChange: 3.68, open: 505.00, high: 525.00, low: 502.00, previousClose: 501.90, totalTradedVolume: 28000000 },
    { symbol: 'TATAMOTORS', companyName: 'Tata Motors Ltd', lastPrice: 995.80, change: 22.40, pChange: 2.30, open: 978.00, high: 1002.00, low: 975.00, previousClose: 973.40, totalTradedVolume: 14200000 },
    { symbol: 'TATASTEEL', companyName: 'Tata Steel Ltd', lastPrice: 154.20, change: 4.80, pChange: 3.21, open: 150.00, high: 155.50, low: 149.50, previousClose: 149.40, totalTradedVolume: 22000000 },
    { symbol: 'SBIN', companyName: 'State Bank of India', lastPrice: 840.50, change: 12.80, pChange: 1.55, open: 830.00, high: 844.00, low: 828.00, previousClose: 827.70, totalTradedVolume: 13500000 },
    { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Ltd', lastPrice: 1580.90, change: 28.40, pChange: 1.83, open: 1555.00, high: 1585.00, low: 1550.00, previousClose: 1552.50, totalTradedVolume: 6200000 }
  ];

  return new Response(JSON.stringify({ index, data: fallbackData }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
