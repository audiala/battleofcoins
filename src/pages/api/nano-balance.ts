import type { APIRoute } from 'astro';
import nanogptjs from 'nanogptjs';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { apiKey } = await request.json();

    // First, call the receive-nano endpoint
    try {
      const receiveResponse = await fetch('https://nano-gpt.com/api/receive-nano', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!receiveResponse.ok) {
        console.warn('Receive nano operation failed:', await receiveResponse.text());
      } else {
        console.log('Receive nano operation successful:', await receiveResponse.json());
      }
    } catch (receiveError) {
      console.warn('Error during receive nano operation:', receiveError);
      // Continue with the account info fetch even if receive fails
    }

    // Initialize nanogptjs with the API key
    const nanogpt = nanogptjs({
      apiKey: apiKey
    });

    // Get account info using nanogptjs
    const accountInfo = await nanogpt.account();

    // Log the response for debugging
    console.log('NanoGPT Account Info:', accountInfo);

    // Safely access properties with fallbacks
    const response = {
      address: accountInfo?.nanoDepositAddress || '',
      balance: accountInfo?.balance ? accountInfo.balance.toString() : '0',
      receivable: accountInfo?.receivable ? accountInfo.receivable.toString() : '0',
      earned: accountInfo?.earned ? accountInfo.earned.toString() : '0',
      transactions: [] // Could be populated if needed
    };

    // Log the formatted response
    console.log('Formatted Response:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('NanoGPT API Error:', error);
    // Log the full error object for debugging
    console.log('Full error object:', JSON.stringify(error, null, 2));
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch wallet data',
        details: error instanceof Error ? error.message : 'Unknown error',
        raw: error // Include raw error for debugging
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