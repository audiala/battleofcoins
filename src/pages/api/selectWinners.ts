import type { APIRoute } from 'astro';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

export const POST: APIRoute = async ({ request }) => {
  const { cryptos } = await request.json();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert cryptocurrency analyst."
        },
        {
          role: "user",
          content: `Select 4 winners and 4 losers from the following pool. For each coin, provide a brief explanation for why it was selected or excluded relative to the other coins. Answer with this exact format:
            Winners:
            ETH: reason for winning
            BNB: reason for winning
            SOL: reason for winning
            DOT: reason for winning
            
            Losers:
            DOGE: reason for losing
            ADA: reason for losing
            XRP: reason for losing
            LTC: reason for losing
            
            Pool:
            ${cryptos.map((crypto: any) => `- ${crypto.name} (${crypto.ticker})`).join('\n')}`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const aiResponse = response.choices[0].message.content;
    
    if (!aiResponse) {
      throw new Error('Empty response from OpenAI');
    }

    // Split the response into winners and losers sections
    const [winnersSection, losersSection] = aiResponse.split('Losers:');
    
    // Parse winners
    const winnersLines = winnersSection.replace('Winners:', '').trim().split('\n');
    const winners = winnersLines
      .filter(line => line.trim())
      .map(line => {
        const [ticker, reason] = line.split(':').map(s => s.trim());
        return {
          coin: cryptos.find((c: any) => c.ticker === ticker) || cryptos[0],
          reason: reason
        };
      });

    // Parse losers
    const losersLines = losersSection.trim().split('\n');
    const losers = losersLines
      .filter(line => line.trim())
      .map(line => {
        const [ticker, reason] = line.split(':').map(s => s.trim());
        return {
          coin: cryptos.find((c: any) => c.ticker === ticker) || cryptos[0],
          reason: reason
        };
      });

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