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
      { status: 401 }
    );
  }

  const nanogpt = nanogptjs({ apiKey });
  const numWinners = Math.ceil(cryptos.length / 2);

  try {
    // Make the prompt more structured and explicit
    const basePrompt = `You are a cryptocurrency analyst. Your task is to analyze a pool of cryptocurrencies and select winners based on the given criteria.

Pool of cryptocurrencies:
${cryptos.map((crypto: any) => `- ${crypto.ticker}: ${crypto.name}`).join('\n')}

Selection criteria:
${prompt}

Instructions:
1. Select exactly ${numWinners} winners from the pool
2. Provide a brief explanation for each selection
3. Explain why the remaining coins were not selected

Format your response exactly as follows:
$Winners$
${Array(numWinners).fill('TICKER: clear and concise reason for selection').join('\n')}

$Losers$
${Array(cryptos.length - numWinners).fill('TICKER: clear and concise reason for non-selection').join('\n')}`;

    // Add retry logic
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any;

    while (attempts < maxAttempts) {
      try {
        const { reply } = await nanogpt.chat({
          prompt: basePrompt,
          model: model,
          context: [],
          temperature: 0.7, // Add temperature to control randomness
          max_tokens: 2000,
          timeout: 30000 // 30 second timeout
        });

        if (!reply) {
          throw new Error('Empty response from NanoGPT');
        }

        // Validate response format
        const [winnersSection, losersSection] = reply.split('$Losers$');
        if (!winnersSection?.includes('$Winners$') || !losersSection) {
          throw new Error('Invalid response format');
        }

        // Parse winners with validation
        const winnersLines = winnersSection.replace('$Winners$', '').trim().split('\n');
        const winners = winnersLines
          .filter((line: string) => line.trim())
          .map((line: string) => {
            const [tickerPart, ...reasonParts] = line.split(':');
            const ticker = tickerPart.trim();
            const reason = reasonParts.join(':').trim();

            const coin = cryptos.find((c: any) => c.ticker === ticker);
            if (!coin) {
              throw new Error(`Invalid coin ticker: ${ticker}`);
            }

            if (!reason) {
              throw new Error(`Missing reason for winner: ${ticker}`);
            }

            return { coin, reason };
          });

        // Validate winner count
        if (winners.length !== numWinners) {
          throw new Error(`Expected ${numWinners} winners, got ${winners.length}`);
        }

        // Parse losers with validation
        const losersLines = losersSection.trim().split('\n');
        const losersMap = new Map(
          losersLines
            .filter((line: string) => line.trim())
            .map((line: string) => {
              const [tickerPart, ...reasonParts] = line.split(':');
              const ticker = tickerPart.trim();
              const reason = reasonParts.join(':').trim();

              if (!reason) {
                throw new Error(`Missing reason for loser: ${ticker}`);
              }

              return [ticker, reason];
            })
        );

        const loserCoins = cryptos.filter(
          (crypto: any) => !winners.some((winner: any) => winner.coin.ticker === crypto.ticker)
        );

        const losers = loserCoins.map((coin: any) => ({
          coin,
          reason: losersMap.get(coin.ticker) || 'Did not meet selection criteria'
        }));

        return new Response(
          JSON.stringify({ winners, losers }), 
          { status: 200 }
        );

      } catch (error) {
        lastError = error;
        attempts++;
        
        // Wait before retrying (exponential backoff)
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          console.log(`Retrying attempt ${attempts + 1}/${maxAttempts}...`);
          continue;
        }
        
        // Provide feedback to the user if all attempts fail
        console.error('Error in selectWinners:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to select winners',
            details: error instanceof Error ? error.message : 'Unknown error'
          }), 
          { status: 500 }
        );
      }
    }

    throw lastError;

  } catch (error) {
    console.error('Error in selectWinners:', error);
    
    // Provide more detailed error messages
    let errorMessage = 'Failed to process request';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('Invalid response format')) {
        errorMessage = 'AI model returned an invalid response format';
        statusCode = 422;
      } else if (error.message.includes('Invalid coin ticker')) {
        errorMessage = 'AI model returned an invalid coin ticker';
        statusCode = 422;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out';
        statusCode = 504;
      }
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { status: statusCode }
    );
  }
}; 