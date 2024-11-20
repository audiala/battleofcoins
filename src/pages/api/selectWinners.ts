import type { APIRoute } from 'astro';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

export const POST: APIRoute = async ({ request }) => {
  const { cryptos } = await request.json();
  
  // Calculate the number of winners needed (half of the pool)
  const numWinners = Math.ceil(cryptos.length / 2);

  try {
    const prompt = `Analyze this pool of cryptocurrencies and select exactly ${numWinners} winners and mark the rest as losers.
For each coin, provide an explanation for your decision.

Respond in this exact format (no extra text) as this example with this format (coin symbol in uppercase: reason for winning/losing):
$Winners$
${Array(numWinners).fill('COIN: reason for winning').join('\n')}

$Losers$
${Array(cryptos.length - numWinners).fill('COIN: reason for losing').join('\n')}
            
Pool:
${cryptos.map((crypto: any) => `${crypto.ticker}: ${crypto.name} (price: ${crypto.market_stats.price} marketcap: ${crypto.market_stats.market_cap} marketcap_fdv_ratio: ${crypto.market_stats.market_cap_fdv_ratio})`).join('\n')}`

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert cryptocurrency analyst. Your task is to analyze cryptocurrencies and provide clear, concise explanations for your selections."
        },
        {
            role: "system",
            content: "You never choose staked assets, wrapped assets or stablecoins."
          },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const aiResponse = response.choices[0].message.content;
    console.log('--------------------------------');
    console.log('--------------------------------');
    console.log(prompt);
    console.log('--------------------------------');
    console.log(aiResponse);
    console.log('--------------------------------');
    console.log('--------------------------------');

    if (!aiResponse) {
      throw new Error('Empty response from OpenAI');
    }

    // Split the response into winners and losers sections
    const [winnersSection, losersSection] = aiResponse.split('$Losers$');
    
    if (!winnersSection || !losersSection) {
      throw new Error('Invalid response format from OpenAI');
    }

    // Parse winners
    const winnersLines = winnersSection.replace('$Winners$', '').trim().split('\n');
    const winners = winnersLines
      .filter(line => line.trim())
      .map(line => {
        const [tickerPart, ...reasonParts] = line.split(':');
        const ticker = tickerPart.trim();
        const reason = reasonParts.join(':').trim();
        const coin = cryptos.find((c: any) => c.ticker === ticker);
        
        if (!coin) {
          console.error(`Could not find coin with ticker: ${ticker}`);
          console.log(cryptos);
          return null;
        }

        return {
          coin,
          reason
        };
      })
      .filter((winner): winner is { coin: any; reason: string } => winner !== null);

    // Parse losers - all cryptos that aren't winners
    const loserCoins = cryptos.filter(
      crypto => !winners.some(winner => winner.coin.ticker === crypto.ticker)
    );

    const losersLines = losersSection.trim().split('\n');
    const losersMap = new Map(
      losersLines
        .filter(line => line.trim())
        .map(line => {
          const [tickerPart, ...reasonParts] = line.split(':');
          return [tickerPart.trim(), reasonParts.join(':').trim()];
        })
    );

    const losers = loserCoins.map(coin => ({
      coin,
      reason: losersMap.get(coin.ticker) || 'Did not meet selection criteria'
    }));

    // Validate the response
    if (winners.length !== numWinners) {
      throw new Error(`Expected ${numWinners} winners, got ${winners.length}`);
    }

    const mappedResponse = {
      winners, // No need to slice, we want all winners
      losers
    };

    return new Response(JSON.stringify(mappedResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error in selectWinners:', error);
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