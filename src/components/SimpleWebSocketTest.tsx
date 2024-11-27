import React, { useEffect, useState } from 'react';

const SimpleWebSocketTest: React.FC = () => {
  const [price, setPrice] = useState<string>('Loading...');

  useEffect(() => {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

    ws.onopen = () => {
      console.log('Simple WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.k && data.k.c) {
          setPrice(data.k.c);
        }
      } catch (err) {
        console.error('Simple WebSocket parsing error:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('Simple WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log(`Simple WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div>
      <h2>Simple Binance WebSocket Test</h2>
      <p>BTCUSDT Price: {price}</p>
    </div>
  );
};

export default SimpleWebSocketTest; 