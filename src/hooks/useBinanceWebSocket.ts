import { useState, useEffect, useRef } from 'react';

export type KlineInterval = '1h' | '1d' | '1w' | '1m';

type WebSocketData = {
  [symbol: string]: {
    [interval in KlineInterval]?: {
      price: string;
      volume: string;
      quoteVolume: string;
      lastUpdate: number;
    };
  };
};

export function useBinanceWebSocket(symbols: string[], intervals: KlineInterval[]) {
  const [socketData, setSocketData] = useState<WebSocketData>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  useEffect(() => {
    const validSymbols = symbols
      .map(s => s.toUpperCase())
      .filter(
        s =>
          /^[A-Z0-9]+USDT$/.test(s) &&
          s !== 'USDT'
      );

    console.log('Valid Symbols:', validSymbols);
    console.log('Intervals:', intervals);

    if (validSymbols.length === 0) {
      console.warn('No valid symbols provided for WebSocket connection.');
      return;
    }

    if (intervals.length === 0) {
      console.warn('No intervals provided for WebSocket connection.');
      return;
    }

    const streams = validSymbols
      .flatMap(symbol => intervals.map(interval => `${symbol.toLowerCase()}@kline_${interval}`))
      .join('/');

    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    console.log(`Connecting to WebSocket URL: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttemptsRef.current = 0; // Reset on successful connection
    };

    ws.onmessage = (event) => {
      console.log('WebSocket message received:', event.data);
      try {
        const parsedData = JSON.parse(event.data);
        const streamData = parsedData.data;

        if (streamData && streamData.e === 'kline') {
          const symbol = streamData.s;
          const kline = streamData.k;
          const interval = kline.i as KlineInterval;

          console.log(`Received kline data for ${symbol} [${interval}]:`, kline);

          setSocketData(prev => ({
            ...prev,
            [symbol]: {
              ...prev[symbol],
              [interval]: {
                price: kline.c,
                volume: kline.v,
                quoteVolume: kline.q,
                lastUpdate: Date.now()
              }
            }
          }));
        } else {
          console.warn('Received unexpected stream data:', streamData);
        }
      } catch (err) {
        console.error('WebSocket data parsing error:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log(
        `WebSocket closed. Code: ${event.code}, Reason: ${event.reason}. Reconnecting...`
      );
      reconnectAttemptsRef.current += 1;
      const delay = Math.min(30000, 1000 * 2 ** reconnectAttemptsRef.current); // Exponential backoff up to 30 seconds
      console.log(`Reconnecting in ${delay / 1000} seconds...`);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [symbols, intervals]);

  return socketData;
} 