import React, { useState, useEffect } from 'react';
import type { CryptoData } from './CryptoTable';

interface Round {
  name: string;
  pools: Pool[];
}

interface Pool {
  id: number;
  cryptos: CryptoData[];
  winners?: CryptoData[];
}

export default function CryptoBattle({ cryptos }: { cryptos: CryptoData[] }) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  useEffect(() => {
    // Create initial pools of 8
    const initialPools: Pool[] = [];
    for (let i = 0; i < cryptos.length; i += 8) {
      initialPools.push({
        id: i / 8,
        cryptos: cryptos.slice(i, i + 8)
      });
    }

    // Calculate number of rounds needed
    const rounds: Round[] = [];
    let currentPoolSize = 8;
    let currentRoundSize = cryptos.length;
    let roundNumber = 1;

    while (currentRoundSize > 1) {
      const roundName = currentRoundSize <= 8 
        ? `Final ${currentRoundSize}` 
        : `Round of ${currentRoundSize}`;
      
      if (roundNumber === 1) {
        rounds.push({ name: roundName, pools: initialPools });
      } else {
        rounds.push({ name: roundName, pools: [] });
      }
      
      // For next round
      currentRoundSize = currentRoundSize <= 8 
        ? Math.floor(currentRoundSize / 2)
        : Math.floor(currentRoundSize / 2);
      roundNumber++;
    }

    setRounds(rounds);
  }, [cryptos]);

  const selectRandomWinners = (pool: Pool): CryptoData[] => {
    const shuffled = [...pool.cryptos].sort(() => Math.random() - 0.5);
    // If pool size is 8 or more, take top 4
    // If pool size is less than 8, take half
    const winnersCount = pool.cryptos.length >= 8 ? 4 : Math.ceil(pool.cryptos.length / 2);
    return shuffled.slice(0, winnersCount);
  };

  const processNextRound = () => {
    setRounds(prevRounds => {
      const newRounds = [...prevRounds];
      const currentRoundPools = newRounds[currentRound].pools;

      // Select winners from each pool
      currentRoundPools.forEach(pool => {
        if (!pool.winners) {
          pool.winners = selectRandomWinners(pool);
        }
      });

      // If all pools have winners, prepare next round
      if (currentRoundPools.every(pool => pool.winners)) {
        // Collect all winners
        const allWinners = currentRoundPools.flatMap(pool => pool.winners || []);
        
        // Create new pools for next round
        const nextRoundPools: Pool[] = [];
        const poolSize = allWinners.length <= 8 ? allWinners.length : 8;
        
        for (let i = 0; i < allWinners.length; i += poolSize) {
          nextRoundPools.push({
            id: i / poolSize,
            cryptos: allWinners.slice(i, i + poolSize)
          });
        }

        if (nextRoundPools.length > 0) {
          newRounds[currentRound + 1].pools = nextRoundPools;
          setCurrentRound(prev => prev + 1);
        }
      }

      return newRounds;
    });
  };

  const handleAutoPlay = async () => {
    setIsAutoPlaying(true);
    
    while (currentRound < rounds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      processNextRound();
    }
    
    setIsAutoPlaying(false);
  };

  return (
    <div className="crypto-battle">
      <div className="battle-controls">
        <button 
          onClick={handleAutoPlay}
          disabled={isAutoPlaying || currentRound === rounds.length - 1}
          className="auto-play-button"
        >
          {isAutoPlaying ? 'Battle in Progress...' : 
           currentRound === rounds.length - 1 ? 'Tournament Complete!' : 
           'Start Auto Battle'}
        </button>
        {currentRound === rounds.length - 1 && rounds[currentRound].pools[0]?.cryptos[0] && (
          <div className="winner-announcement">
            <h2>🏆 Tournament Winner 🏆</h2>
            <div className="final-winner">
              <img 
                src={`/${rounds[currentRound].pools[0].cryptos[0].logo_local}`} 
                alt={rounds[currentRound].pools[0].cryptos[0].name}
                className="winner-logo"
              />
              <span className="winner-name">
                {rounds[currentRound].pools[0].cryptos[0].name}
              </span>
              <span className="winner-ticker">
                {rounds[currentRound].pools[0].cryptos[0].ticker}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="rounds-container">
        {rounds.map((round, roundIndex) => (
          <div 
            key={round.name} 
            className={`round ${roundIndex === currentRound ? 'active' : ''}`}
          >
            <h3 className="round-title">{round.name}</h3>
            <div className="pools-container">
              {round.pools.map((pool) => (
                <div key={pool.id} className="pool">
                  <div className="pool-cryptos">
                    {pool.cryptos.map((crypto) => (
                      <div
                        key={crypto.ticker}
                        className={`crypto-card ${pool.winners?.includes(crypto) ? 'winner' : ''}`}
                      >
                        <img 
                          src={`/${crypto.logo_local}`} 
                          alt={crypto.name} 
                          className="crypto-logo"
                        />
                        <div className="crypto-info">
                          <span className="crypto-name">{crypto.name}</span>
                          <span className="crypto-ticker">{crypto.ticker}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 