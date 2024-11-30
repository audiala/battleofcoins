import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data', 'coingecko_cache.json');
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export type CoingeckoMarketData = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  last_updated: string;
};

type CacheData = {
  timestamp: number;
  data: CoingeckoMarketData[];
};

export async function fetchMarketData(): Promise<CoingeckoMarketData[]> {
  try {
    // Check if cache exists and is valid
    if (fs.existsSync(CACHE_FILE)) {
      const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cache: CacheData = JSON.parse(cacheContent);
      
      // If cache is less than 5 minutes old, use it
      if (Date.now() - cache.timestamp < CACHE_DURATION) {
        return cache.data;
      }
    }

    // Fetch fresh data from CoinGecko
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?' +
      new URLSearchParams({
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: '250',
        page: '1',
        sparkline: 'false',
        locale: 'en',
        x_cg_demo_api_key: process.env.COINGECKO_API_KEY || ''
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch market data: ${response.statusText}`);
    }

    const data: CoingeckoMarketData[] = await response.json();

    // Ensure the data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save to cache file
    const cacheData: CacheData = {
      timestamp: Date.now(),
      data
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));

    return data;
  } catch (error) {
    console.error('Error fetching/caching market data:', error);
    
    // If there's an error but we have cached data, return it regardless of age
    if (fs.existsSync(CACHE_FILE)) {
      const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cache: CacheData = JSON.parse(cacheContent);
      return cache.data;
    }
    
    throw error;
  }
} 