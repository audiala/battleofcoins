import type { APIRoute } from 'astro';
import nanogptjs from 'nanogptjs';

export const POST: APIRoute = async ({ request }) => {
  const { cryptos, prompt, model, apiKey } = await request.json();
  
  if (!apiKey) {
    return new Response(
      JSON.stringify({ 
        error: 'No API key provided',
        details: 'Please set your NanoGPT API key in Settings'
      }), 
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  const nanogpt = nanogptjs({
    apiKey: apiKey,
  });
  
  // Calculate the number of winners needed (half of the pool)
  const numWinners = Math.ceil(cryptos.length / 2);

  try {
    const basePrompt = `Analyze this pool of cryptocurrencies and select exactly ${numWinners} winners and mark the rest as losers.
For each coin, provide an explanation for your decision relative to the other coins in the pool.

Respond in this exact format (no extra text) as this example with this format (coin symbol in uppercase: reason for winning/losing):
$Winners$
${Array(numWinners).fill('COIN: reason for winning').join('\n')}

$Losers$
${Array(cryptos.length - numWinners).fill('COIN: reason for losing').join('\n')}
            
Pool:
${cryptos.map((crypto: any) => `${crypto.ticker}: ${crypto.name}`).join('\n')}`

    // Use NanoGPT chat with the specified model
    const { reply } = await nanogpt.chat({
      prompt: prompt + '\n\n' + basePrompt,
      model: model,
      context: []
    });

    if (!reply) {
      throw new Error('Empty response from NanoGPT');
    }

    console.log('--------------------------------');
    console.log('--------------------------------');
    console.log(prompt);
    console.log('--------------------------------');
    console.log(reply);
    console.log('--------------------------------');
    console.log('--------------------------------');

    // Split the response into winners and losers sections
    const [winnersSection, losersSection] = reply.split('$Losers$');
    
    if (!winnersSection || !losersSection) {
      throw new Error('Invalid response format from NanoGPT');
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
      winners,
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