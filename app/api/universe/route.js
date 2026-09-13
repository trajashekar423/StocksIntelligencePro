export const dynamic = 'force-dynamic';

export async function GET() {
  const fallbackUniverse = [
    { symbol: 'RELIANCE', companyName: 'Reliance Industries Limited' },
    { symbol: 'TCS', companyName: 'Tata Consultancy Services Limited' },
    { symbol: 'HDFCBANK', companyName: 'HDFC Bank Limited' },
    { symbol: 'ICICIBANK', companyName: 'ICICI Bank Limited' },
    { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Limited' },
    { symbol: 'INFY', companyName: 'Infosys Limited' },
    { symbol: 'ITC', companyName: 'ITC Limited' },
    { symbol: 'SBIN', companyName: 'State Bank of India' },
    { symbol: 'LTIM', companyName: 'LTIMindtree Limited' },
    { symbol: 'LT', companyName: 'Larsen & Toubro Limited' },
    { symbol: 'HINDUNILVR', companyName: 'Hindustan Unilever Limited' },
    { symbol: 'AXISBANK', companyName: 'Axis Bank Limited' },
    { symbol: 'KOTAKBANK', companyName: 'Kotak Mahindra Bank Limited' },
    { symbol: 'TATAMOTORS', companyName: 'Tata Motors Limited' },
    { symbol: 'M&M', companyName: 'Mahindra & Mahindra Limited' },
    { symbol: 'NTPC', companyName: 'NTPC Limited' },
    { symbol: 'ONGC', companyName: 'Oil & Natural Gas Corporation Limited' },
    { symbol: 'POWERGRID', companyName: 'Power Grid Corporation of India Limited' },
    { symbol: 'TATASTEEL', companyName: 'Tata Steel Limited' },
    { symbol: 'ADANIENT', companyName: 'Adani Enterprises Limited' },
    { symbol: 'ADANIPORTS', companyName: 'Adani Ports and Special Economic Zone Limited' },
    { symbol: 'COALINDIA', companyName: 'Coal India Limited' },
    { symbol: 'BAJFINANCE', companyName: 'Bajaj Finance Limited' },
    { symbol: 'MARUTI', companyName: 'Maruti Suzuki India Limited' },
    { symbol: 'SUNPHARMA', companyName: 'Sun Pharmaceutical Industries Limited' },
    { symbol: 'TITAN', companyName: 'Titan Company Limited' },
    { symbol: 'ULTRACEMCO', companyName: 'UltraTech Cement Limited' },
    { symbol: 'ASIANPAINT', companyName: 'Asian Paints Limited' },
    { symbol: 'HEROMOTOCO', companyName: 'Hero MotoCorp Limited' },
    { symbol: 'BAJAJ-AUTO', companyName: 'Bajaj Auto Limited' },
    { symbol: 'WIPRO', companyName: 'Wipro Limited' },
    { symbol: 'HCLTECH', companyName: 'HCL Technologies Limited' },
    { symbol: 'TECHM', companyName: 'Tech Mahindra Limited' },
    { symbol: 'SWIGGY', companyName: 'Swiggy Limited' },
    { symbol: 'ZOMATO', companyName: 'Zomato Limited' },
    { symbol: 'CUPID', companyName: 'Cupid Limited' },
    { symbol: 'MOREPENLAB', companyName: 'Morepen Laboratories Limited' },
    { symbol: 'MILKYMIST', companyName: 'Milky Mist Dairy Foods Limited' },
    { symbol: 'ATHERENERG', companyName: 'Ather Energy Limited' }
  ];

  return new Response(JSON.stringify(fallbackUniverse), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

