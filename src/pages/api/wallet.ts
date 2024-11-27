import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  try {
    // This is mock data - replace with actual Nano RPC calls
    const mockWalletInfo = {
      address: "nano_3rropjiqfxpmrrkooej4qtmm1pueu36f9ghinpho4esfdor8785a455d16nf",
      balance: "133.7",
      transactions: [
        {
          type: "receive",
          amount: "10.0",
          timestamp: "2024-01-20T14:30:00Z",
          account: "nano_1ipx847tk8o46pwxt5qjdbncjqcbwcc1rrmqnkztrfjy5k7z4imsrata9est",
          hash: "ABC123"
        },
        {
          type: "send",
          amount: "5.0",
          timestamp: "2024-01-19T10:15:00Z",
          account: "nano_3wm37qz19zhei7nzscjcopbrbnnachs4p1gnwo5oroi3qonw6inwgoeuufdp",
          hash: "DEF456"
        }
      ]
    };

    return new Response(JSON.stringify(mockWalletInfo), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch wallet data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 