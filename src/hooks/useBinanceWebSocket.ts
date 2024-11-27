import { useState, useEffect, useRef } from 'react';

type WebSocketData = {
  [symbol: string]: {
    price: string;
    volume: string;
    quoteVolume: string;
    lastUpdate: number;
  };
};

export function useBinanceWebSocket(symbols: string[]) {
  const [socketData, setSocketData] = useState<WebSocketData>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const validSymbols = symbols
      .map(s => s.toUpperCase())
      .filter(s => /^[A-Z0-9]+USDT$/.test(s));

    const connect = () => {
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          return wsRef.current;
        }

        const streams = validSymbols
          .map(symbol => `${symbol.toLowerCase()}@kline_1m`)
          .join('/');

        const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
          try {
            const { data: streamData } = JSON.parse(event.data);
            
            if (streamData && streamData.e === 'kline') {
              const symbol = streamData.s;
              const kline = streamData.k;
              
              setSocketData(prev => ({
                ...prev,
                [symbol]: {
                  price: kline.c,
                  volume: kline.v,
                  quoteVolume: kline.q,
                  lastUpdate: Date.now()
                }
              }));
            }
          } catch (err) {
            console.error('WebSocket data parsing error:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          if (wsRef.current === ws) {
            setTimeout(connect, 5000);
          }
        };

        return ws;
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        return null;
      }
    };

    const ws = connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [symbols]);

  return socketData;
} 