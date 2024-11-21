import React, { useState, useEffect, useRef } from 'react';
import type { CryptoData } from './CryptoTable';
import axios from 'axios';
import { Tooltip } from './Tooltip';
import { CryptoCard } from './CryptoCard';
import { ModelTooltip } from './ModelTooltip';

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

interface TextModel {
  name: string;
  model: string;
  description: string;
  cost: string;
  costEstimate: number;
  labelVariant?: string;
  label?: string;
  visible?: boolean;
}

interface TextModels {
  [key: string]: TextModel;
}

interface ModelSelection {
  modelId: string;
  active: boolean;
}

// Add this type for sorting options
type ModelSortOption = 'default' | 'name' | 'cost';

const createInitialPools = (cryptos: CryptoData[]): Pool[] => {
  const pools: Pool[] = [];
  for (let i = 0; i < cryptos.length; i += 8) {
    pools.push({
      id: i / 8,
      cryptos: cryptos.slice(i, i + Math.min(8, cryptos.length - i))
    });
  }
  return pools;
};

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
  const [models, setModels] = useState<TextModels>({});
  const [selectedModels, setSelectedModels] = useState<ModelSelection[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [battlesByModel, setBattlesByModel] = useState<{[key: string]: Round[]}>({});
  const [currentRoundByModel, setCurrentRoundByModel] = useState<{[key: string]: number}>({});
  const [modelSortOption, setModelSortOption] = useState<ModelSortOption>('default');
  const [allModelsSelected, setAllModelsSelected] = useState(false);
  const [isModelSelectionExpanded, setIsModelSelectionExpanded] = useState(false);

  const roundsRef = useRef(rounds);
  const currentRoundRef = useRef(currentRound);
  const battleSavedRef = useRef(false);

  // Combine the initialization logic into a single effect
  useEffect(() => {
    const initializeBattle = async () => {
      // First, fetch the models
      try {
        const response = await axios.get('/api/models');
        const modelsData = response.data.models.text;
        setModels(modelsData);
        
        // Set default model selection
        const defaultModel = Object.keys(modelsData)[0];
        if (defaultModel) {
          setSelectedModels([{ modelId: defaultModel, active: true }]);
          setActiveModelId(defaultModel);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }

      // Then handle battle initialization
      const savedHistories = localStorage.getItem('cryptoBattleHistories');
      if (savedHistories) {
        const histories = JSON.parse(savedHistories);
        setBattleHistories(histories);
        
        // Check URL for battle ID
        const params = new URLSearchParams(window.location.search);
        const battleId = params.get('battle');
        if (battleId) {
          const battle = histories.find((h: BattleHistory) => h.id === battleId);
          if (battle) {
            setBattlesByModel({
              [selectedModels[0]?.modelId]: battle.rounds
            });
            setCurrentRoundByModel({
              [selectedModels[0]?.modelId]: battle.rounds.length - 1
            });
            setSelectedBattleId(battleId);
            setPrompt(battle.prompt);
            battleSavedRef.current = true;
            return;
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
          
          // Initialize battles for each selected model
          const initialBattles: {[key: string]: Round[]} = {};
          const initialRounds: {[key: string]: number} = {};

          selectedModels.forEach(({ modelId }) => {
            const initialPools = createInitialPools(selectedCryptos);
            initialBattles[modelId] = [{ name: 'Round 1', pools: initialPools }];
            initialRounds[modelId] = 0;
          });

          setBattlesByModel(initialBattles);
          setCurrentRoundByModel(initialRounds);
          localStorage.removeItem('selectedCryptos');
        } catch (error) {
          console.error('Error parsing selected cryptos:', error);
          startNewBattle(cryptos);
        }
      } else {
        console.log('Using default cryptos:', cryptos.length);
        startNewBattle(cryptos);
      }
    };

    initializeBattle();
  }, []); // Empty dependency array for mount only

  const startNewBattle = (battleCryptos: CryptoData[]) => {
    if (!battleCryptos || battleCryptos.length === 0) {
      console.error('No cryptos provided for battle');
      return;
    }

    // Initialize battles for each selected model
    const initialBattles: {[key: string]: Round[]} = {};
    const initialRounds: {[key: string]: number} = {};

    selectedModels.forEach(({ modelId }) => {
      const initialPools = createInitialPools(battleCryptos);
      initialBattles[modelId] = [{ name: 'Round 1', pools: initialPools }];
      initialRounds[modelId] = 0;
    });

    setBattlesByModel(initialBattles);
    setCurrentRoundByModel(initialRounds);
    setActiveModelId(selectedModels[0]?.modelId);
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

  const processNextRound = async (modelId: string) => {
    try {
      // Get current state from refs
      const newRounds = [...roundsRef.current];
      const currentRoundPools = newRounds[currentRoundRef.current].pools;

      // Process all pools in parallel
      const poolPromises = currentRoundPools.map(async pool => {
        try {
          // If pool has only one contestant, it's automatically the winner
          if (pool.cryptos.length === 1) {
            pool.winners = [{
              coin: pool.cryptos[0],
              reason: "Last contestant standing"
            }];
            pool.losers = [];
            return;
          }

          // Set loading state
          pool.isLoading = true;
          setRounds([...newRounds]);

          // For all pools (including smaller ones), use AI selection
          const response = await axios.post('/api/selectWinners', {
            cryptos: pool.cryptos,
            prompt,
            model: modelId,
            winnersCount: Math.floor(pool.cryptos.length / 2) // Select half of the pool
          });

          const data: RoundWinners = response.data;
          pool.winners = data.winners;
          pool.losers = data.losers;
        } catch (error) {
          console.error(`Error processing pool ${pool.id}:`, error);
        } finally {
          pool.isLoading = false;
          setRounds([...newRounds]);
        }
      });

      // Wait for all pools to complete
      await Promise.all(poolPromises);

      // Continue with the rest of the logic
      if (currentRoundPools.every(pool => pool.winners)) {
        const allWinners = currentRoundPools.flatMap(pool => pool.winners || []);
        
        // Create next round pools
        const nextRoundPools: Pool[] = [];
        for (let i = 0; i < allWinners.length; i += 8) {
          nextRoundPools.push({
            id: i / 8,
            cryptos: allWinners.slice(i, i + Math.min(8, allWinners.length - i)).map(w => w.coin)
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
      // Run battles for all selected models in parallel
      const battlePromises = selectedModels.map(async ({ modelId }) => {
        while (true) {
          await processNextRound(modelId);
          
          // Get latest state for this model
          const currentRoundData = battlesByModel[modelId][currentRoundByModel[modelId]];
          
          // Check if this model's battle is complete
          if (
            currentRoundData?.pools.length === 1 &&
            currentRoundData.pools[0].cryptos.length === 1
          ) {
            break;
          }
          
          // Wait between rounds
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      });

      // Wait for all battles to complete
      await Promise.all(battlePromises);
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

  // Add effect to fetch models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await axios.get('/api/models');
        const modelsData = response.data.models.text;
        setModels(modelsData);
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };
    
    fetchModels();
  }, []);

  // Add model selection handler
  const handleModelToggle = (modelId: string) => {
    setSelectedModels(prev => {
      const existing = prev.find(m => m.modelId === modelId);
      if (existing) {
        return prev.filter(m => m.modelId !== modelId);
      }
      return [...prev, { modelId, active: true }];
    });
  };

  // Add these helper functions
  const getSortedModels = (models: TextModels, sortOption: ModelSortOption) => {
    const modelEntries = Object.entries(models);
    
    switch (sortOption) {
      case 'name':
        return modelEntries.sort((a, b) => a[1].name.localeCompare(b[1].name));
      case 'cost':
        return modelEntries.sort((a, b) => a[1].costEstimate - b[1].costEstimate);
      default:
        return modelEntries;
    }
  };

  const handleSelectAllModels = () => {
    if (allModelsSelected) {
      setSelectedModels([]);
    } else {
      const allModels = Object.keys(models).map(modelId => ({
        modelId,
        active: true
      }));
      setSelectedModels(allModels);
    }
    setAllModelsSelected(!allModelsSelected);
  };

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
          <>
            <div className="model-selection">
              <div className="model-controls">
                <div className="model-header">
                  <div className="model-title">
                    <h4>Select AI Models</h4>
                    <span className="model-counter">
                      {selectedModels.length} selected
                    </span>
                  </div>
                  {isModelSelectionExpanded && (
                  <div className="model-actions">
                    <select
                      value={modelSortOption}
                      onChange={(e) => setModelSortOption(e.target.value as ModelSortOption)}
                      className="model-sort-select"
                    >
                      <option value="default">Default Order</option>
                      <option value="name">Sort by Name</option>
                      <option value="cost">Sort by Cost</option>
                    </select>
                    <button
                      onClick={handleSelectAllModels}
                      className="select-all-button"
                    >
                      {allModelsSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                )}
                  <button 
                    onClick={() => setIsModelSelectionExpanded(!isModelSelectionExpanded)}
                    className="expand-button"
                  >
                    {isModelSelectionExpanded ? 'Show Less' : 'Show All'} 
                    <span className={`expand-icon ${isModelSelectionExpanded ? 'expanded' : ''}`}>
                      ▼
                    </span>
                  </button>
                </div>
                
              </div>
              
              <div className={`model-grid ${isModelSelectionExpanded ? 'expanded' : 'collapsed'}`}>
                {getSortedModels(models, modelSortOption).map(([key, model]) => (
                  <ModelTooltip
                    key={key}
                    name={model.name}
                    description={model.description}
                    cost={model.cost}
                  >
                    <div
                      className={`model-checkbox ${selectedModels.some(m => m.modelId === key) ? 'selected' : ''}`}
                      onClick={() => handleModelToggle(key)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModels.some(m => m.modelId === key)}
                        onChange={() => {}}
                        disabled={isAutoPlaying}
                      />
                      <div className="model-info">
                        <span className="model-name">{model.name}</span>
                        <span className="model-cost">{model.cost.replace('Average cost', 'avg')}</span>
                      </div>
                    </div>
                  </ModelTooltip>
                ))}
              </div>
              
              {selectedModels.length > 0 && (
                <div className="model-tabs">
                  {selectedModels.map(({ modelId }) => (
                    <button
                      key={modelId}
                      className={`model-tab ${activeModelId === modelId ? 'active' : ''}`}
                      onClick={() => setActiveModelId(modelId)}
                    >
                      {models[modelId].name}
                    </button>
                  ))}
                </div>
              )}
              {activeModelId && models[activeModelId] && (
                <div className="model-description">
                  <p>{models[activeModelId].description}</p>
                  {models[activeModelId].label && (
                    <span className={`model-label ${models[activeModelId].labelVariant || ''}`}>
                      {models[activeModelId].label}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="prompt-input">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your selection criteria..."
                disabled={isAutoPlaying}
                className="prompt-textarea"
              />
            </div>
          </>
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

      {/* Display active model's battle */}
      {activeModelId && battlesByModel[activeModelId] && (
        <div className="rounds-container">
          {battlesByModel[activeModelId].map((round, roundIndex) => (
            <div 
              key={`round-${roundIndex}`}
              className={`round ${roundIndex === currentRoundByModel[activeModelId] ? 'active' : ''}`}
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
      )}
    </div>
  );
} 