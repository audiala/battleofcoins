import type { CryptoData } from '../components/CryptoTable';

export async function fetchCryptoData(): Promise<CryptoData[]> {
  try {
    const response = await fetch('/api/cryptos');
    if (!response.ok) {
      throw new Error('Failed to fetch crypto data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching crypto data:', error);
    return [];
  }
} 