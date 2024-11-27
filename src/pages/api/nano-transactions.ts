import type { APIRoute } from 'astro';

const NANO_RPC_URL = 'https://rpc.nano.to'; // Using a public node, replace with your own if needed

export const POST: APIRoute = async ({ request }) => {
  try {
    const { address } = await request.json();

    // First, get account history
    const historyResponse = await fetch(NANO_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'account_history',
        account: address,
        count: '100', // Get last 100 transactions
        raw: false
      }),
    });

    if (!historyResponse.ok) {
      throw new Error('Failed to fetch account history');
    }

    const historyData = await historyResponse.json();
    
    // Transform the history data into our transaction format
    const transactions = historyData.history?.map((tx: any) => ({
      type: tx.type,
      amount: tx.amount/1000000000000000000000000000000,
      timestamp: new Date(parseInt(tx.local_timestamp) * 1000).toISOString(),
      account: tx.account,
      hash: tx.hash
    })) || [];

    return new Response(JSON.stringify({ transactions }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Nano RPC Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch transactions',
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