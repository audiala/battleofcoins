import React, { useRef, useState } from 'react';
import { Tooltip } from './Tooltip';
import type { CryptoData } from './CryptoTable';

interface CryptoCardProps {
  crypto: CryptoData;
  isWinner: boolean;
  reason?: string;
  roundIndex: number;
  poolId: number;
}

export function CryptoCard({ crypto, isWinner, reason, roundIndex, poolId }: CryptoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      ref={cardRef}
      key={`${roundIndex}-${poolId}-${crypto.ticker}`}
      className={`crypto-card ${isWinner ? 'winner' : 'loser'}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <img
        src={`/logos/${crypto.ticker.toLowerCase()}.png`}
        alt={crypto.name}
        className="crypto-logo"
      />
      <div className="crypto-info">
        <span className="crypto-name">{crypto.name}</span>
        <span className="crypto-ticker">{crypto.ticker}</span>
      </div>
      {showTooltip && reason && (
        <Tooltip 
          content={reason} 
          parentRef={cardRef}
          isWinner={isWinner}
        />
      )}
    </div>
  );
} 