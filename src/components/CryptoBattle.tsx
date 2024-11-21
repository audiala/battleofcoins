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

interface BattleHistory {
  id: string;
  date: string;
  rounds: Round[];
  winner?: CryptoData;
  prompt: string;
}

interface CryptoBattleProps {
  cryptos: CryptoData[];
}

function createBattleHash(rounds: Round[]): string {
  // Create a string representation of the battle results
  const battleString = rounds.map(round => 
    round.pools.map(pool => 
      pool.winners?.map(w => w.coin.ticker).join(',')
    ).join('|')
  ).join('_');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < battleString.length; i++) {
    const char = battleString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36); // Convert to base36 for shorter string
}

export default function CryptoBattle({ cryptos, ...props }: CryptoBattleProps & { [key: string]: any }) {
  console.log('CryptoBattle received cryptos:', cryptos?.length);

  // Store initial cryptos in a ref to avoid re-renders
  const initialCryptosRef = useRef<CryptoData[]>(cryptos);
  
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [battleHistories, setBattleHistories] = useState<BattleHistory[]>([]);
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');

  const roundsRef = useRef(rounds);
  const currentRoundRef = useRef(currentRound);
  const battleSavedRef = useRef(false);

  // Combine the initialization logic into a single effect
  useEffect(() => {
    const initializeBattle = async () => {
      const savedHistories = localStorage.getItem('cryptoBattleHistories');
      if (savedHistories) {
        const histories = JSON.parse(savedHistories);
        setBattleHistories(histories);
        
        // Check URL for battle ID
        const params = new URLSearchParams(window.location.search);
        const battleId = params.get('battle');
        if (battleId) {
          const battle = histories.find((h: BattleHistory) => h.id === battleId);
          console.log('Found battle:', battle);
          if (battle) {
            console.log('Loading battle:', battle.rounds.length, 'rounds');
            setRounds(battle.rounds);
            setCurrentRound(battle.rounds.length - 1);
            setSelectedBattleId(battleId);
            setPrompt(battle.prompt);
            battleSavedRef.current = true;
            return; // Return early to prevent startNewBattle
          }
        }
      }

      // Check for selected cryptos in localStorage
      const selectedCryptosJson = localStorage.getItem('selectedCryptos');
      if (selectedCryptosJson) {
        try {
          const selectedCryptos = JSON.parse(selectedCryptosJson);
          console.log('Found selected cryptos in component:', selectedCryptos.length);
          initialCryptosRef.current = selectedCryptos;
          startNewBattle(selectedCryptos);
          // Clear localStorage after use
          localStorage.removeItem('selectedCryptos');
        } catch (error) {
          console.error('Error parsing selected cryptos:', error);
          startNewBattle(cryptos); // Fallback to default cryptos
        }
      } else {
        console.log('Using default cryptos:', cryptos.length);
        startNewBattle(cryptos);
      }
    };

    initializeBattle();
  }, []); // Empty dependency array for mount only

  const startNewBattle = (battleCryptos: CryptoData[]) => {
    console.log('Starting new battle with cryptos:', battleCryptos?.length);
    
    if (!battleCryptos || battleCryptos.length === 0) {
      console.error('No cryptos provided for battle');
      return;
    }
    
    // Remove battle parameter from URL
    window.history.pushState({}, '', window.location.pathname);

    // Create initial pools of 8
    const initialPools: Pool[] = [];
    for (let i = 0; i < battleCryptos.length; i += 8) {
      initialPools.push({
        id: i / 8,
        cryptos: battleCryptos.slice(i, i + 8)
      });
    }

    setRounds([{ name: 'Round 1', pools: initialPools }]);
    setCurrentRound(0);
    setSelectedBattleId(null);
    setPrompt('');
    battleSavedRef.current = false;
  };

  // Update the select onChange handler
  const handleBattleSelect = (value: string) => {
    if (value) {
      loadBattle(value);
    } else {
      startNewBattle(initialCryptosRef.current);
    }
  };

  const processNextRound = async () => {
    try {
      // Get current state from refs
      const newRounds = [...roundsRef.current];
      const currentRoundPools = newRounds[currentRoundRef.current].pools;

      // Skip processing if any pool has only one contestant
      if (currentRoundPools.some(pool => pool.cryptos.length === 1)) {
        // If there's only one contestant, mark it as winner directly
        currentRoundPools.forEach(pool => {
          if (pool.cryptos.length === 1) {
            pool.winners = [{
              coin: pool.cryptos[0],
              reason: "Last contestant standing"
            }];
            pool.losers = [];
          }
        });
      } else {
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
              prompt
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
      }

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

  const loadBattle = (battleId: string) => {
    const battle = battleHistories.find(h => h.id === battleId);
    if (battle) {
      // Update URL without reloading the page
      const newUrl = battleId ? 
        `${window.location.pathname}?battle=${battleId}` : 
        window.location.pathname;
      window.history.pushState({}, '', newUrl);

      setRounds(battle.rounds);
      setCurrentRound(battle.rounds.length - 1);
      setSelectedBattleId(battleId);
      setPrompt(battle.prompt);
    }
  };

  const isTournamentComplete = rounds[currentRound]?.pools.length === 1 && 
                              rounds[currentRound].pools[0].cryptos.length === 1;

  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);

  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);

  useEffect(() => {
    if (isTournamentComplete && rounds.length > 0 && !battleSavedRef.current) {
      const winner = rounds[currentRound].pools[0].cryptos[0];
      const battleHash = createBattleHash(rounds);
      
      // Check if this battle already exists
      const battleExists = battleHistories.some(battle => 
        createBattleHash(battle.rounds) === battleHash
      );

      if (!battleExists) {
        const newBattle: BattleHistory = {
          id: battleHash,
          date: new Date().toISOString(),
          rounds,
          winner,
          prompt
        };

        const updatedHistories = [...battleHistories, newBattle];
        setBattleHistories(updatedHistories);
        localStorage.setItem('cryptoBattleHistories', JSON.stringify(updatedHistories));
        battleSavedRef.current = true;
      }
    }
  }, [isTournamentComplete, rounds, currentRound, battleHistories, prompt]);

  return (
    <div className="crypto-battle" data-component="CryptoBattle" {...props}>
      <div className="battle-controls">
        <div className="battle-history">
          <select 
            value={selectedBattleId || ''} 
            onChange={(e) => handleBattleSelect(e.target.value)}
            className="battle-select"
          >
            <option key="new-battle" value="">Start New Battle</option>
            {battleHistories.map((battle, index) => (
              <option 
                key={`battle-${battle.id}-${index}`} 
                value={battle.id}
              >
                {new Date(battle.date).toLocaleString()} - Winner: {battle.winner?.name}
              </option>
            ))}
          </select>
        </div>

        {!selectedBattleId ? (
          <div className="prompt-input">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your selection criteria..."
              disabled={isAutoPlaying}
              className="prompt-textarea"
            />
          </div>
        ) : (
          <div className="prompt-display">
            <h4>Selection Criteria:</h4>
            <p>{prompt}</p>
          </div>
        )}

        <button 
          onClick={handleAutoPlay}
          disabled={isAutoPlaying || isTournamentComplete || selectedBattleId !== null || !prompt.trim()}
          className="auto-play-button"
        >
          {isAutoPlaying ? 'Battle in Progress...' : 
           isTournamentComplete ? 'Tournament Complete!' : 
           selectedBattleId ? 'Viewing Past Battle' :
           !prompt.trim() ? 'Enter Selection Criteria' :
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