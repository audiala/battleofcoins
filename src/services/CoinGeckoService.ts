import fs from 'fs';
import path from 'path';
import https from 'https';

const CACHE_FILE = path.join(process.cwd(), 'data', 'coingecko_cache.json');
const LOGOS_DIR = path.join(process.cwd(), 'public', 'logos');
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const COINS_PER_PAGE = 250;
const TOTAL_COINS = 1000;

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
  price_change_percentage_24h: number;
  price_change_percentage_30d_in_currency: number;
  price_change_percentage_1y_in_currency: number;
};

type CacheData = {
  timestamp: number;
  data: CoingeckoMarketData[];
};

async function fetchPage(page: number): Promise<CoingeckoMarketData[]> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/coins/markets?' +
    new URLSearchParams({
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: COINS_PER_PAGE.toString(),
      page: page.toString(),
      sparkline: 'false',
      locale: 'en',
      price_change_percentage: '24h,30d,1y',
      x_cg_demo_api_key: process.env.COINGECKO_API_KEY || ''
    })
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch market data for page ${page}: ${response.statusText}`);
  }

  return response.json();
}

// Add function to download and save logo
async function downloadLogo(imageUrl: string, ticker: string): Promise<void> {
  const logoPath = path.join(LOGOS_DIR, `${ticker.toLowerCase()}.png`);
  
  // Skip if logo already exists
  if (fs.existsSync(logoPath)) {
    return;
  }

  return new Promise((resolve, reject) => {
    https.get(imageUrl, (response) => {
      if (response.statusCode === 200) {
        // Ensure logos directory exists
        if (!fs.existsSync(LOGOS_DIR)) {
          fs.mkdirSync(LOGOS_DIR, { recursive: true });
        }

        const fileStream = fs.createWriteStream(logoPath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      } else {
        reject(new Error(`Failed to download logo for ${ticker}: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

export async function fetchMarketData(): Promise<CoingeckoMarketData[]> {
  try {
    // Check if cache exists and is valid
    if (fs.existsSync(CACHE_FILE)) {
      const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cache: CacheData = JSON.parse(cacheContent);
      
      // If cache is less than 5 minutes old, use it
      if (Date.now() - cache.timestamp < CACHE_DURATION) {
        console.log('Using cached data');
        return cache.data;
      }
    }

    // Calculate number of pages needed
    const totalPages = Math.ceil(TOTAL_COINS / COINS_PER_PAGE);
    console.log(`Fetching ${totalPages} pages of market data...`);

    // Fetch all pages with a delay between requests to avoid rate limiting
    let allData: CoingeckoMarketData[] = [];
    for (let page = 1; page <= totalPages; page++) {
      console.log(`Fetching page ${page}/${totalPages}...`);
      try {
        const pageData = await fetchPage(page);
        allData = [...allData, ...pageData];
        
        // Add a delay between requests to respect rate limits (1.5 seconds)
        if (page < totalPages) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error);
        // If we have some data but encounter an error, break the loop
        if (allData.length > 0) {
          break;
        }
        throw error;
      }
    }

    // Ensure we don't exceed 1000 coins
    allData = allData.slice(0, TOTAL_COINS);

    // After fetching all data, download missing logos
    // for (const coin of allData) {
    //   try {
    //     await downloadLogo(coin.image, coin.symbol);
    //   } catch (error) {
    //     console.error(`Failed to download logo for ${coin.symbol}:`, error);
    //     // Continue with next logo even if one fails
    //   }
    // }

    // Ensure the data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save to cache file
    const cacheData: CacheData = {
      timestamp: Date.now(),
      data: allData
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
    console.log(`Cached ${allData.length} coins to ${CACHE_FILE}`);

    return allData;
  } catch (error) {
    console.error('Error fetching/caching market data:', error);
    
    // If there's an error but we have cached data, return it regardless of age
    if (fs.existsSync(CACHE_FILE)) {
      console.log('Falling back to cached data due to error');
      const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cache: CacheData = JSON.parse(cacheContent);
      return cache.data;
    }
    
    throw error;
  }
}

// Add a helper function to check cache age
export function getCacheAge(): number | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cache: CacheData = JSON.parse(cacheContent);
      return Date.now() - cache.timestamp;
    }
    return null;
  } catch (error) {
    console.error('Error checking cache age:', error);
    return null;
  }
} 