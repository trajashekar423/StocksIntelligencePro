export const dynamic = 'force-dynamic';

export async function GET() {
  const fallbackUniverse = [
    { symbol: 'SUZLON', companyName: 'Suzlon Energy Limited' },
    { symbol: 'YESBANK', companyName: 'Yes Bank Limited' },
    { symbol: 'IDEA', companyName: 'Vodafone Idea Limited' },
    { symbol: 'PCJEWELLER', companyName: 'PC Jeweller Limited' },
    { symbol: 'MOTISONS', companyName: 'Motisons Jewellers Limited' },
    { symbol: 'IFCI', companyName: 'IFCI Limited' },
    { symbol: 'RENUKA', companyName: 'Shree Renuka Sugars Limited' },
    { symbol: 'SHIPROCKET', companyName: 'Shiprocket Logistics Limited' },
    { symbol: 'BAJAJHIND', companyName: 'Bajaj Hindusthan Sugar Limited' },
    { symbol: 'ASTERDM', companyName: 'Aster DM Healthcare Limited' },
    { symbol: 'ZAGGLE', companyName: 'Zaggle Prepaid Ocean Services' },
    { symbol: 'GTLINFRA', companyName: 'GTL Infrastructure Limited' },
    { symbol: 'RELIANCE', companyName: 'Reliance Industries Limited' },
    { symbol: 'TCS', companyName: 'Tata Consultancy Services Limited' },
    { symbol: 'HDFCBANK', companyName: 'HDFC Bank Limited' },
    { symbol: 'ICICIBANK', companyName: 'ICICI Bank Limited' },
    { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Limited' },
    { symbol: 'INFY', companyName: 'Infosys Limited' },
    { symbol: 'ITC', companyName: 'ITC Limited' },
    { symbol: 'SBIN', companyName: 'State Bank of India' },
    { symbol: 'LT', companyName: 'Larsen & Toubro Limited' },
    { symbol: 'TATAMOTORS', companyName: 'Tata Motors Limited' },
    { symbol: 'TATASTEEL', companyName: 'Tata Steel Limited' },
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
