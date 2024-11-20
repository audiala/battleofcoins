import React, { useState, useEffect, useRef } from 'react';
import type { CryptoData } from './CryptoTable';
import axios from 'axios';
import { Tooltip } from './Tooltip';
import { CryptoCard } from './CryptoCard';

interface Winner {
  coin: CryptoData;
  reason: string;
}

interface Loser {
  coin: CryptoData;
  reason: string;
}

interface RoundWinners {
  winners: Winner[];
  losers: Loser[];
}

interface Round {
  name: string;
  pools: Pool[];
}

interface Pool {
  id: number;
  cryptos: CryptoData[];
  winners?: Winner[];
  losers?: Loser[];
  isLoading?: boolean;
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

  const processNextRound = async () => {
    try {
      // Get current state from refs
      const newRounds = [...roundsRef.current];
      const currentRoundPools = newRounds[currentRoundRef.current].pools;

      // Set all pools to loading state
      currentRoundPools.forEach(pool => {
        pool.isLoading = true;
      });
      setRounds(newRounds);

      // Process all pools in parallel
      const poolPromises = currentRoundPools.map(async pool => {
        try {
          const response = await axios.post('/api/selectWinners', {
            cryptos: pool.cryptos,
          });

          const data: RoundWinners = response.data;

          // Update the pool with winners and losers
          pool.winners = data.winners;
          pool.losers = data.losers;
        } catch (error) {
          console.error(`Error processing pool ${pool.id}:`, error);
        } finally {
          // Clear loading state
          pool.isLoading = false;
          // Update the UI to reflect the change
          setRounds([...newRounds]);
        }
      });

      // Wait for all pools to complete
      await Promise.all(poolPromises);

      // Continue with the rest of the logic
      if (currentRoundPools.every(pool => pool.winners)) {
        const allWinners = currentRoundPools.flatMap(pool => pool.winners || []);
        
        const nextRoundPools: Pool[] = [];
        for (let i = 0; i < allWinners.length; i += 8) {
          nextRoundPools.push({
            id: i / 8,
            cryptos: allWinners.map(w => w.coin).slice(i, i + Math.min(8, allWinners.length - i)),
          });
        }

        if (nextRoundPools.length > 0) {
          newRounds.push({
            name: `Round ${newRounds.length + 1}`,
            pools: nextRoundPools,
          });
          setCurrentRound(prev => {
            const updated = prev + 1;
            currentRoundRef.current = updated;
            return updated;
          });
        }
      }

      setRounds(newRounds);
    } catch (error) {
      console.error('Error processing next round:', error);
    }
  };

  const handleAutoPlay = async () => {
    setIsAutoPlaying(true);
    
    try {
      while (true) {
        await processNextRound();
        
        // Get latest state
        const currentRoundData = roundsRef.current[currentRoundRef.current];
        
        // Check if we should stop (when we have a single winner)
        if (
          currentRoundData?.pools.length === 1 &&
          currentRoundData.pools[0].cryptos.length === 1
        ) {
          break;
        }
        
        // Wait between rounds
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
              {round.pools.map(pool => (
                <div key={`pool-${roundIndex}-${pool.id}`} className="pool">
                  {pool.isLoading && (
                    <div className="pool-loading">
                      <div className="loading-spinner"></div>
                      <span>AI Analyzing...</span>
                    </div>
                  )}
                  <div className={`pool-cryptos ${pool.isLoading ? 'pool-loading-overlay' : ''}`}>
                    {pool.cryptos.map(crypto => {
                      const isWinner = pool.winners?.some(w => w.coin.ticker === crypto.ticker);
                      const reason = pool.winners?.find(w => w.coin.ticker === crypto.ticker)?.reason || 
                                     pool.losers?.find(l => l.coin.ticker === crypto.ticker)?.reason;

                      return (
                        <CryptoCard
                          key={`${roundIndex}-${pool.id}-${crypto.ticker}`}
                          crypto={crypto}
                          isWinner={isWinner || false}
                          reason={reason}
                          roundIndex={roundIndex}
                          poolId={pool.id}
                        />
                      );
                    })}
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