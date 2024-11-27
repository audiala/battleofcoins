import React, { useEffect, useMemo, useState } from 'react';
import { useBinanceWebSocket, KlineInterval } from '../hooks/useBinanceWebSocket';

const WebSocketTest: React.FC = () => {
  // Memoize the symbols array to maintain a consistent reference
  const symbols = useMemo(() => ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'], []);

  // Define the intervals you want to track
  const intervals: KlineInterval[] = useMemo(() => ['1h', '1d', '1w', '1m'], []);

  console.log('Symbols passed to WebSocket hook:', symbols);
  console.log('Intervals passed to WebSocket hook:', intervals);

  const socketData = useBinanceWebSocket(symbols, intervals);

  useEffect(() => {
    console.log('Socket Data Updated:', socketData);
  }, [socketData]);

  // State to store previous prices for calculating changes
  const [previousPrices, setPreviousPrices] = useState<{
    [key: string]: string;
  }>({});

  // Update previousPrices when socketData updates
  useEffect(() => {
    symbols.forEach((symbol) => {
      intervals.forEach((interval) => {
        const data = socketData[symbol]?.[interval];
        if (data) {
          const key = `${symbol}-${interval}`;
          const prevPrice = previousPrices[key] || data.price;
          const currentPrice = data.price;

          if (prevPrice !== currentPrice) {
            setPreviousPrices(prev => ({
              ...prev,
              [key]: currentPrice
            }));
          }
        }
      });
    });
  }, [socketData, symbols, intervals]);

  // Helper function to calculate price change percentage
  const calculateChange = (current: string, previous: string) => {
    if (!previous || previous === '0') return 'N/A';
    const change = ((parseFloat(current) - parseFloat(previous)) / parseFloat(previous)) * 100;
    return change.toFixed(2) + '%';
  };

  return (
    <div>
      <h2>Binance WebSocket Test</h2>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Interval</th>
            <th>Price</th>
            <th>Change (%)</th>
            <th>Volume</th>
            <th>Quote Volume</th>
            <th>Last Update</th>
          </tr>
        </thead>
        <tbody>
          {symbols.map((symbol) => {
            const dataForSymbol = socketData[symbol];
            return intervals.map((interval) => {
              const data = dataForSymbol ? dataForSymbol[interval] : undefined;
              const key = `${symbol}-${interval}`;
              const previousPrice = previousPrices[key] || data?.price || '0';
              const currentPrice = data ? data.price : 'Loading...';
              const change = data ? calculateChange(currentPrice, previousPrice) : 'N/A';

              return (
                <tr key={key}>
                  <td>{symbol}</td>
                  <td>{interval}</td>
                  <td>{data ? data.price : 'Loading...'}</td>
                  <td style={{ color: change === 'N/A' ? 'black' : (change.startsWith('-') ? 'red' : 'green') }}>
                    {change}
                  </td>
                  <td>{data ? data.volume : 'Loading...'}</td>
                  <td>{data ? data.quoteVolume : 'Loading...'}</td>
                  <td>
                    {data
                      ? new Date(data.lastUpdate).toLocaleTimeString()
                      : 'Loading...'}
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WebSocketTest; 