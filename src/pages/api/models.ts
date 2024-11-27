import type { APIRoute } from 'astro';
import axios from 'axios';

export const GET: APIRoute = async () => {
  try {
    const response = await axios.get('https://nano-gpt.com/api/models');
    return new Response(JSON.stringify(response.data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch models' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 