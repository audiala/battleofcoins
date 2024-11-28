import type { APIRoute } from 'astro';
import nanogptjs from 'nanogptjs';

interface Winner {
  coin: {
    name: string;
    ticker: string;
  };
  score: number;
}

interface ModelResult {
  modelName: string;
  winner: string;
  reason: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { battle, models, apiKey } = await request.json();

    if (!battle || !models || !apiKey) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters'
      }), { status: 400 });
    }

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

    const topThree = Object.values(battle.results.scores)
      .sort((a: Winner, b: Winner) => b.score - a.score)
      .slice(0, 3);

    const modelResults = Object.entries(battle.results.modelResults)
      .map(([modelId, result]) => {
        // Get the winning reason from the final round
        const finalRound = result.rounds[result.rounds.length - 1];
        const winningReason = finalRound?.pools[0]?.winners?.[0]?.reason || 'No reason provided';
        
        return {
          modelName: models[modelId]?.name || modelId,
          winner: result.winner.name,
          reason: winningReason
        };
      });

    const summaryPrompt = `You are a crypto battle analyst. Summarize this battle in 4-5 engaging sentences, focusing on why certain coins won:

Selection criteria: "${battle.prompt}"

Models used: ${modelResults.map((m: ModelResult) => m.modelName).join(', ')}

Top 3 winners:
🥇 ${topThree[0]?.coin.name} (Score: ${topThree[0]?.score})
🥈 ${topThree[1]?.coin.name} (Score: ${topThree[1]?.score})
🥉 ${topThree[2]?.coin.name} (Score: ${topThree[2]?.score})

Individual model winners and their winning reasons:
${modelResults.map((m: ModelResult) => `${m.modelName}: ${m.winner} - "${m.reason}"`).join('\n')}

Focus on the most interesting or recurring reasons for victory, and explain how they relate to the selection criteria.`;

    
        return new Response(JSON.stringify({
          summary: "Best it's the best!",
          text: summaryPrompt
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });

  } catch (error) {
    console.error('Error generating summary:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate summary' }), { status: 500 });
  }
}; 