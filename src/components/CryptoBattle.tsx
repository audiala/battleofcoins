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

  const battleSavedRef = useRef(false);

  // Add Refs to keep track of the latest state
  const battlesByModelRef = useRef<{[key: string]: Round[]}>({});
  const currentRoundByModelRef = useRef<{[key: string]: number}>({});

  // Sync Refs with state whenever they change
  useEffect(() => {
    battlesByModelRef.current = battlesByModel;
  }, [battlesByModel]);

  useEffect(() => {
    currentRoundByModelRef.current = currentRoundByModel;
  }, [currentRoundByModel]);

  // Combine the initialization logic into a single effect
  useEffect(() => {
    const initializeBattle = async () => {
      console.log('Initializing battle...');
      // First, fetch the models
      try {
        const response = await axios.get('/api/models');
        const modelsData = response.data.models.text;
        setModels(modelsData);
        
        // Set default model selection with the first model
        const defaultModel = Object.keys(modelsData)[0];
        const initialSelectedModels = [{ modelId: defaultModel, active: true }];
        setSelectedModels(initialSelectedModels);
        setActiveModelId(defaultModel);

        // Check for saved battle history
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
                [defaultModel]: battle.rounds
              });
              setCurrentRoundByModel({
                [defaultModel]: battle.rounds.length - 1
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
            
            // Initialize battles for the default model
            const initialPools = createInitialPools(selectedCryptos);
            setBattlesByModel({
              [defaultModel]: [{ name: 'Round 1', pools: initialPools }]
            });
            setCurrentRoundByModel({
              [defaultModel]: 0
            });
            
            localStorage.removeItem('selectedCryptos');
          } catch (error) {
            console.error('Error parsing selected cryptos:', error);
            startNewBattle(cryptos);
          }
        } else {
          console.log('Using default cryptos:', cryptos.length);
          startNewBattle(cryptos);
        }

      } catch (error) {
        console.error('Error during initialization:', error);
      }
    };

    initializeBattle();
  }, []); // Empty dependency array for mount only

  const startNewBattle = (battleCryptos: CryptoData[]) => {
    const newUrl = window.location.pathname;
    window.history.pushState({}, '', newUrl);
    
    if (!battleCryptos || battleCryptos.length === 0) {
      console.error('No cryptos provided for battle');
      return;
    }

    // Use current selectedModels or default to first model if none selected
    const modelsToUse = selectedModels.length > 0 ? selectedModels : 
      Object.keys(models).length > 0 ? [{ modelId: Object.keys(models)[0], active: true }] : [];

    // Initialize battles for each selected model
    const initialBattles: {[key: string]: Round[]} = {};
    const initialRounds: {[key: string]: number} = {};

    modelsToUse.forEach(({ modelId }) => {
      const initialPools = createInitialPools(battleCryptos);
      initialBattles[modelId] = [{ name: 'Round 1', pools: initialPools }];
      initialRounds[modelId] = 0;
    });

    setBattlesByModel(initialBattles);
    setCurrentRoundByModel(initialRounds);
    setActiveModelId(modelsToUse[0]?.modelId);
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

  // Modify processNextRound to ensure Refs are updated correctly
  function processNextRound(modelId: string): Promise<number | null> {
    console.log(`Processing next round for model: ${modelId}`);
    return new Promise(async (resolve) => {
      try {
        // Get current state for this model from Refs
        const modelBattles = [...battlesByModelRef.current[modelId]];
        const currentRoundIndex = currentRoundByModelRef.current[modelId];
        const currentRoundPools = modelBattles[currentRoundIndex].pools;

        console.log(`Model ${modelId} - Current Round Index: ${currentRoundIndex}`);
        console.log(`Model ${modelId} - Current Round Pools:`, currentRoundPools);

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
              console.log(`Model ${modelId} - Pool ${pool.id} has a single crypto. Auto-winning.`);
              return;
            }

            // Set loading state
            pool.isLoading = true;
            console.log(`Model ${modelId} - Pool ${pool.id} is loading`);

            // Use AI selection for winners
            const response = await axios.post('/api/selectWinnersRandom', {
              cryptos: pool.cryptos,
              prompt,
              model: modelId,
              winnersCount: Math.floor(pool.cryptos.length / 2)
            });

            const data: RoundWinners = response.data;
            pool.winners = data.winners;
            pool.losers = data.losers;
            console.log(`Model ${modelId} - Pool ${pool.id} winners:`, data.winners);
          } catch (error) {
            console.error(`Error processing pool ${pool.id} for model ${modelId}:`, error);
          } finally {
            pool.isLoading = false;
            console.log(`Model ${modelId} - Pool ${pool.id} loading complete`);
            // Update the state with the modified pool
            setBattlesByModel(prev => {
              const updated = {
                ...prev,
                [modelId]: modelBattles
              };
              battlesByModelRef.current = updated; // Update Ref
              return updated;
            });
          }
        });

        // Wait for all pools to complete
        await Promise.all(poolPromises);
        console.log(`Model ${modelId} - All pools processed for round ${currentRoundIndex}`);

        // Check if all pools have winners before creating the next round
        if (currentRoundPools.every(pool => pool.winners)) {
          const allWinners = currentRoundPools.flatMap(pool => pool.winners || []);
          console.log(`Model ${modelId} - All winners for round ${currentRoundIndex}:`, allWinners);
          
          if (allWinners.length > 1) {
            // Create next round pools
            const nextRoundPools: Pool[] = [];
            for (let i = 0; i < allWinners.length; i += 8) {
              nextRoundPools.push({
                id: i / 8,
                cryptos: allWinners.slice(i, i + Math.min(8, allWinners.length - i)).map(w => w.coin)
              });
            }

            // Add the new round
            modelBattles.push({
              name: `Round ${modelBattles.length + 1}`,
              pools: nextRoundPools,
            });

            console.log(`Model ${modelId} - Next round created: Round ${modelBattles.length}`);

            // Update states
            setBattlesByModel(prev => {
              const updated = {
                ...prev,
                [modelId]: modelBattles
              };
              battlesByModelRef.current = updated; // Update Ref
              return updated;
            });
            
            setCurrentRoundByModel(prev => {
              const updated = {
                ...prev,
                [modelId]: currentRoundIndex + 1
              };
              currentRoundByModelRef.current = updated; // Update Ref
              return updated;
            });
            console.log(`Model ${modelId} - Current Round updated to ${currentRoundIndex + 1}`);

            // Return the new round index
            resolve(currentRoundIndex + 1);
          } else if (allWinners.length === 1) {
            // Create a final round with only the winner
            const finalWinner = allWinners[0].coin;
            modelBattles.push({
              name: `Final Round`,
              pools: [{
                id: 0,
                cryptos: [finalWinner],
                winners: [{
                  coin: finalWinner,
                  reason: "Final Winner"
                }],
                losers: []
              }],
            });

            console.log(`Model ${modelId} - Final round created with the winner.`);

            // Update states
            setBattlesByModel(prev => {
              const updated = {
                ...prev,
                [modelId]: modelBattles
              };
              battlesByModelRef.current = updated; // Update Ref
              return updated;
            });
            
            setCurrentRoundByModel(prev => {
              const updated = {
                ...prev,
                [modelId]: currentRoundIndex + 1
              };
              currentRoundByModelRef.current = updated; // Update Ref
              return updated;
            });
            console.log(`Model ${modelId} - Current Round updated to Final Round`);

            // Indicate completion
            resolve(null);
          } else {
            console.log(`Model ${modelId} - Unexpected number of winners: ${allWinners.length}`);
            resolve(null);
          }
        } else {
          console.log(`Model ${modelId} - Not all pools have winners yet`);
          resolve(null);
        }
      } catch (error) {
        console.error(`Error processing next round for model ${modelId}:`, error);
        resolve(null);
      }
    });
  }

  // Modify handleAutoPlay to use Refs for the latest state
  const handleAutoPlay = async () => {
    console.log('Auto Play started');
    setIsAutoPlaying(true);
    
    try {
      // Run battles for all selected models in parallel
      const battlePromises = selectedModels.map(async ({ modelId }) => {
        console.log(`Starting battle for model: ${modelId}`);
        let completed = false;

        while (!completed) {
          console.log(`Processing next round for model: ${modelId}`);
          const newRoundIndex = await processNextRound(modelId);
          
          if (newRoundIndex === null) {
            // Tournament is complete
            console.log(`Battle complete for model: ${modelId}`);
            completed = true;
          } else {
            // Verify if the tournament is complete using Refs
            const currentRoundData = battlesByModelRef.current[modelId][newRoundIndex];
            console.log(`Current Round Data for model ${modelId}:`, currentRoundData);
            
            if (
              currentRoundData?.pools.length === 1 &&
              currentRoundData.pools[0].cryptos.length === 1
            ) {
              console.log(`Tournament complete for model: ${modelId}`);
              completed = true;
            }

            // Wait between rounds
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      });

      // Wait for all battles to complete
      await Promise.all(battlePromises);
      console.log('All battles completed');
    } catch (error) {
      console.error('Error during auto play:', error);
    } finally {
      setIsAutoPlaying(false);
      console.log('Auto Play ended');
    }
  };

  // Modify loadBattle to ensure Refs are updated
  useEffect(() => {
    battlesByModelRef.current = battlesByModel;
  }, [battlesByModel]);

  useEffect(() => {
    currentRoundByModelRef.current = currentRoundByModel;
  }, [currentRoundByModel]);

  const loadBattle = (battleId: string) => {
    console.log(`Loading battle with ID: ${battleId}`);
    const battle = battleHistories.find(h => h.id === battleId);
    if (battle) {
      // Update URL without reloading the page
      const newUrl = battleId ? 
        `${window.location.pathname}?battle=${battleId}` : 
        window.location.pathname;
      window.history.pushState({}, '', newUrl);

      // Update both rounds and battlesByModel states
      setBattlesByModel({
        [activeModelId]: battle.rounds
      });
      setCurrentRoundByModel({
        [activeModelId]: battle.rounds.length - 1
      });
      console.log(`Model ${activeModelId} - Battles loaded:`, battle.rounds);
      
      setSelectedBattleId(battleId);
      setPrompt(battle.prompt);
      battleSavedRef.current = true;
      console.log('Battle loaded and saved flag set to true');
    } else {
      console.warn(`No battle found with ID: ${battleId}`);
    }
  };

  const isTournamentComplete =
    battlesByModel[activeModelId]?.[currentRoundByModel[activeModelId]]?.pools?.length === 1 && 
    battlesByModel[activeModelId]?.[currentRoundByModel[activeModelId]]?.pools[0]?.winners?.length === 1;

  useEffect(() => {
    console.log('Checking tournament completion:', isTournamentComplete);
    if (isTournamentComplete && !battleSavedRef.current) {
      console.log('Tournament is complete. Saving battle history...');
      const currentBattleRounds = battlesByModel[activeModelId];
      const winner = currentBattleRounds[currentRoundByModel[activeModelId]].pools[0].cryptos[0];
      const battleHash = createBattleHash(currentBattleRounds);
      
      // Check if this battle already exists
      const battleExists = battleHistories.some(battle => 
        createBattleHash(battle.rounds) === battleHash
      );
      console.log(`Battle exists: ${battleExists}`);

      if (!battleExists) {
        const newBattle: BattleHistory = {
          id: battleHash,
          date: new Date().toISOString(),
          rounds: currentBattleRounds,
          winner,
          prompt
        };

        const updatedHistories = [...battleHistories, newBattle];
        setBattleHistories(updatedHistories);
        localStorage.setItem('cryptoBattleHistories', JSON.stringify(updatedHistories));
        battleSavedRef.current = true;
        console.log('New battle history saved:', newBattle);
      } else {
        console.log('Battle already exists. Skipping save.');
      }
    }
  }, [isTournamentComplete, battlesByModel, currentRoundByModel, battleHistories, prompt, activeModelId]);

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
                src={`/${battlesByModel[activeModelId]?.[currentRoundByModel[activeModelId]]?.pools[0].cryptos[0].logo_local}`} 
                alt={battlesByModel[activeModelId]?.[currentRoundByModel[activeModelId]].pools[0].cryptos[0].name}
                className="winner-logo"
              />
              <span className="winner-name">
                {battlesByModel[activeModelId]?.[currentRoundByModel[activeModelId]].pools[0].cryptos[0].name}
              </span>
              <span className="winner-ticker">
                {battlesByModel[activeModelId]?.[currentRoundByModel[activeModelId]].pools[0].cryptos[0].ticker}
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
                        // Determine if the crypto is a winner
                        const isWinner = pool.winners?.some(w => w.coin.ticker === crypto.ticker) || pool.cryptos.length === 1;
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