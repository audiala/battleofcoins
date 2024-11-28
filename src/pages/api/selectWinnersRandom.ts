import type { APIRoute } from 'astro';

// Random reasons for winning
const winningReasons = [
  "Strong momentum in recent trading",
  "Impressive technical indicators",
  "Growing community support",
  "Innovative technology adoption",
  "Strategic partnerships forming",
  "Solid tokenomics structure",
  "Promising market position",
  "High development activity"
];

// Random reasons for losing
const losingReasons = [
  "Declining market interest",
  "Technical resistance levels",
  "Increased selling pressure",
  "Market sentiment shift",
  "Competition concerns",
  "Limited ecosystem growth",
  "Regulatory uncertainties",
  "Weak volume metrics"
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const POST: APIRoute = async ({ request }) => {
  const { cryptos } = await request.json();

  try {
    // Shuffle the cryptos array
    const shuffledCryptos = shuffleArray(cryptos);
    
    // Take the first half as winners
    const halfLength = Math.ceil(cryptos.length / 2);
    const winnerCryptos = shuffledCryptos.slice(0, halfLength);
    const loserCryptos = shuffledCryptos.slice(halfLength);

    const winners = winnerCryptos.map(crypto => ({
      coin: crypto,
      reason: getRandomElement(winningReasons)
    }));

    const losers = loserCryptos.map(crypto => ({
      coin: crypto,
      reason: getRandomElement(losingReasons)
    }));

    const mappedResponse = {
      winners: winners.slice(0, 4), // Ensure exactly 4 winners
      losers
    };

    // add a delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return new Response(JSON.stringify(mappedResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error in selectWinnersRandom:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 