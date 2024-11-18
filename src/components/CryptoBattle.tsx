import React, { useState, useEffect, useRef } from 'react';
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

  const roundsRef = useRef(rounds);
  const currentRoundRef = useRef(currentRound);

  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);

  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);

  useEffect(() => {
    // Create initial pools of 8
    const initialPools: Pool[] = [];
    for (let i = 0; i < cryptos.length; i += 8) {
      initialPools.push({
        id: i / 8,
        cryptos: cryptos.slice(i, i + 8)
      });
    }

    setRounds([{ name: 'Round 1', pools: initialPools }]);
  }, [cryptos]);

  const selectRandomWinners = (pool: Pool): CryptoData[] => {
    const shuffled = [...pool.cryptos].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.ceil(pool.cryptos.length / 2));
  };

  const processNextRound = () => {
    setRounds(prevRounds => {
      const newRounds = [...prevRounds];
      const currentRoundPools = newRounds[currentRoundRef.current].pools;

      // Select winners from each pool
      currentRoundPools.forEach(pool => {
        pool.winners = selectRandomWinners(pool);
        console.log(pool.winners);
      });

      // If all pools have winners, prepare next round
      if (currentRoundPools.every(pool => pool.winners)) {
        // Collect all winners
        const allWinners = currentRoundPools.flatMap(pool => pool.winners || []);
        
        // Create new pools of 8 (or less for final rounds)
        const nextRoundPools: Pool[] = [];
        for (let i = 0; i < allWinners.length; i += 8) {
          nextRoundPools.push({
            id: i / 8,
            cryptos: allWinners.slice(i, i + Math.min(8, allWinners.length - i))
          });
        }

        if (nextRoundPools.length > 0) {
          newRounds.push({
            name: `Round ${newRounds.length + 1}`,
            pools: nextRoundPools
          });
          setCurrentRound(prev => {
            const updated = prev + 1;
            currentRoundRef.current = updated;
            return updated;
          });
        }
      }

      return newRounds;
    });
  };

  const handleAutoPlay = async () => {
    setIsAutoPlaying(true);
    
    try {
      while (true) {
        // Get current state from refs
        const currentRoundData = roundsRef.current[currentRoundRef.current];
        
        // Check if we should stop
        if (
          !currentRoundData ||
          (currentRoundData.pools.length === 1 &&
            currentRoundData.pools[0].cryptos.length === 1)
        ) {
          break;
        }

        processNextRound();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Error during auto play:', error);
    } finally {
      setIsAutoPlaying(false);
    }
  };

  const isTournamentComplete = rounds[currentRound]?.pools.length === 1 && 
                              rounds[currentRound].pools[0].cryptos.length === 1;

  return (
    <div className="crypto-battle">
      <div className="battle-controls">
        <button 
          onClick={handleAutoPlay}
          disabled={isAutoPlaying || isTournamentComplete}
          className="auto-play-button"
        >
          {isAutoPlaying ? 'Battle in Progress...' : 
           isTournamentComplete ? 'Tournament Complete!' : 
           'Start Auto Battle'}
        </button>

        {isTournamentComplete && (
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
            key={`round-${roundIndex}`}
            className={`round ${roundIndex === currentRound ? 'active' : ''}`}
          >
            <h3 className="round-title">{round.name}</h3>
            <div className="pools-container">
              {round.pools.map((pool) => (
                <div key={`pool-${roundIndex}-${pool.id}`} className="pool">
                  <div className="pool-cryptos">
                    {pool.cryptos.map((crypto) => (
                      <div
                        key={`${roundIndex}-${pool.id}-${crypto.ticker}`}
                        className={`crypto-card ${pool.winners?.includes(crypto) ? 'winner' : ''}`}
                      >
                        <img 
                          src={`/${crypto.logo_local.toLowerCase()}`} 
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