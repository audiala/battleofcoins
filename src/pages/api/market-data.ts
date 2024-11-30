import type { APIRoute } from 'astro';
import { fetchMarketData } from '../../services/CoinGeckoService';

export const GET: APIRoute = async () => {
  try {
    const data = await fetchMarketData();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch market data' }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}; 