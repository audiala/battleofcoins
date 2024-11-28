import React, { useState, useEffect, useRef } from 'react';
import type { CryptoData } from './CryptoTable';
import axios from 'axios';
import { Tooltip } from './Tooltip';
import { CryptoCard } from './CryptoCard';
import { ModelTooltip } from './ModelTooltip';
import { 
  saveBattleHistory as saveHistory,
  getBattleById as getPublicBattleById 
} from '../services/BattleDatabase';

import {
  saveBattleHistory as saveBattleHistoryLocal,
  getAllBattleHistories as getAllBattleHistoriesLocal,
  getBattleById as getBattleByIdLocal
} from '../services/BattleDatabaseLocal';

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
  results: BattleResults;
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

// Add new interfaces for scoring
interface GlobalScore {
  [ticker: string]: {
    coin: CryptoData;
    score: number;
  };
}

interface BattleResults {
  modelResults: {
    [modelId: string]: {
      rounds: Round[];
      winner: CryptoData;
    };
  };
  globalWinner: {
    coin: CryptoData;
    score: number;
  };
  scores: GlobalScore;
}

interface WalletInfo {
  balance: string;
  error?: string;
}

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

// Update the calculateGlobalScores function
const calculateGlobalScores = (modelResults: { [modelId: string]: { rounds: Round[]; winner: CryptoData; } }): GlobalScore => {
  const scores: GlobalScore = {};
  
  // Process each model's results
  Object.values(modelResults).forEach(({ rounds, winner }) => {
    // Process each round
    rounds.forEach(round => {
      round.pools.forEach(pool => {
        // Add points for winners that advanced to next round
        pool.winners?.forEach(winner => {
          const ticker = winner.coin.ticker;
          if (!scores[ticker]) {
            scores[ticker] = {
              coin: winner.coin,
              score: 0
            };
          }
          // Add 1 point for advancing to next round
          scores[ticker].score += 1;
        });
      });
    });

    // Add extra 2 points for the overall winner of each model battle
    if (winner) {
      const ticker = winner.ticker;
      if (!scores[ticker]) {
        scores[ticker] = {
          coin: winner,
          score: 0
        };
      }
      scores[ticker].score += 2;
    }
  });

  return scores;
};

// Update the determineGlobalWinner function to return top 3
const determineGlobalWinner = (scores: GlobalScore) => {
  const scoreValues = Object.values(scores);
  if (scoreValues.length === 0) {
    return null;
  }
  
  // Sort all scores in descending order
  const sortedScores = scoreValues.sort((a, b) => b.score - a.score);
  
  // Return the top scorer
  return sortedScores[0];
};

// Add new function to get top 3 winners
const getTopThreeWinners = (scores: GlobalScore) => {
  const scoreValues = Object.values(scores);
  if (scoreValues.length === 0) {
    return [];
  }
  
  // Sort all scores in descending order
  return scoreValues
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
};

// Add a type guard function to check if activeModelId is valid
const isValidModelId = (modelId: string | null): modelId is string => {
  return modelId !== null;
};

// Add this helper function at the top of the file, outside the component
const downloadBattleAsJson = (battleResults: any) => {
  const dataStr = JSON.stringify(battleResults, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `battle-${new Date().toISOString()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Update the helper function to remove marketcap
const stripCryptoData = (crypto: CryptoData) => {
  return {
    id: crypto.id,
    name: crypto.name,
    ticker: crypto.ticker,
    logo_local: crypto.logo_local,
  };
};

// Add this helper function to calculate total rounds and pools
const calculateBattleStats = (cryptoCount: number) => {
  let totalPools = 0;
  let currentCount = cryptoCount;
  let rounds = 0;

  while (currentCount > 1) {
    // Calculate number of pools for this round
    const poolsInRound = Math.ceil(currentCount / 8);
    totalPools += poolsInRound;
    
    // For next round, we'll have half the cryptos
    currentCount = Math.ceil(currentCount / 2);
    rounds++;
  }

  return { totalPools, rounds };
};

// Add this function to calculate total cost
const calculateTotalCost = (cryptoCount: number, modelCost: number) => {
  const { totalPools } = calculateBattleStats(cryptoCount);
  return (totalPools * modelCost).toFixed(4);
};

export default function CryptoBattle({ cryptos, ...props }: CryptoBattleProps & { [key: string]: any }) {
  // console.log('CryptoBattle received cryptos:', cryptos?.length);

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
      try {
        // First, fetch the models
        const response = await axios.get('/api/models');
        const modelsData = response.data.models.text;
        setModels(modelsData);
        
        // Set default model selection with the first model
        const defaultModel = Object.keys(modelsData)[0];
        const initialSelectedModels = [{ modelId: defaultModel, active: true }];
        setSelectedModels(initialSelectedModels);
        setActiveModelId(defaultModel);

        // Load battle histories from IndexedDB instead of Supabase
        const histories = await getAllBattleHistoriesLocal();
        setBattleHistories(histories);
        
        // Check URL for battle ID
        const params = new URLSearchParams(window.location.search);
        const battleId = params.get('battle');
        if (battleId) {
          // Try private battle first
          let battle = await getBattleByIdLocal(battleId);
          
          // If not found in private, try public
          if (!battle) {
            battle = await getPublicBattleById(battleId);
          }

          if (battle && battle.results?.modelResults) {
            // Get all model IDs from the battle that have completed rounds
            const modelIds = Object.entries(battle.results.modelResults)
              .filter(([_, result]) => result && result.rounds) // Only include models with valid rounds
              .map(([modelId]) => modelId);

            if (modelIds.length > 0) {
              // Set up the battles and rounds for each valid model
              setBattlesByModel(
                modelIds.reduce((acc, modelId) => {
                  const modelResult = battle.results.modelResults[modelId];
                  if (modelResult && modelResult.rounds) {
                    acc[modelId] = modelResult.rounds;
                  }
                  return acc;
                }, {})
              );
              
              setCurrentRoundByModel(
                modelIds.reduce((acc, modelId) => {
                  const modelResult = battle.results.modelResults[modelId];
                  if (modelResult && modelResult.rounds) {
                    acc[modelId] = modelResult.rounds.length - 1;
                  }
                  return acc;
                }, {})
              );
              
              // Set up selected models
              setSelectedModels(
                modelIds.map(modelId => ({
                  modelId,
                  active: true
                }))
              );
              
              // Set the first valid model as active
              setActiveModelId(modelIds[0]);
            }
            
            setSelectedBattleId(battleId);
            setPrompt(battle.prompt);
            battleSavedRef.current = true;
            return;
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

    // Create initial pools once and share them across all models
    const initialPools = createInitialPools(battleCryptos).map(pool => ({
      ...pool,
      isLoading: true
    }));
    const initialBattles: { [key: string]: Round[] } = {};
    const initialRounds: { [key: string]: number } = {};

    modelsToUse.forEach(({ modelId }) => {
      // Create a deep copy of initialPools for each model
      const modelPools = initialPools.map(pool => ({
        ...pool,
        cryptos: [...pool.cryptos],
        id: pool.id
      }));

      initialBattles[modelId] = [{ name: 'Round 1', pools: modelPools }];
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
  const processNextRound = async (modelId: string): Promise<number | null> => {
    console.log(`Processing next round for model: ${modelId}`);
    try {
      // Ensure the model has battles initialized
      if (!battlesByModelRef.current[modelId]) {
        console.error(`No battles found for model ${modelId}`);
        return null;
      }

      // Get current state for this model from Refs
      const modelBattles = [...(battlesByModelRef.current[modelId] || [])];
      const currentRoundIndex = currentRoundByModelRef.current[modelId] || 0;
      const currentRoundPools = modelBattles[currentRoundIndex]?.pools;

      if (!currentRoundPools) {
        console.error(`No pools found for model ${modelId} round ${currentRoundIndex}`);
        return null;
      }

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
            
            // Force a re-render after updating pool
            setBattlesByModel(prev => {
              const updated = { ...prev };
              updated[modelId] = modelBattles;
              return updated;
            });
            return;
          }

          // Set loading state
          pool.isLoading = true;
          // Force a re-render to show loading state
          setBattlesByModel(prev => {
            const updated = { ...prev };
            updated[modelId] = modelBattles;
            return updated;
          });
          
          console.log(`Model ${modelId} - Pool ${pool.id} is loading`);

          const response = await axios.post('/api/selectWinnersRandom', {
            cryptos: pool.cryptos,
            prompt,
            model: modelId,
            winnersCount: Math.floor(pool.cryptos.length / 2),
            apiKey: localStorage.getItem('nanoGptApiKey')
          });

          const data: RoundWinners = response.data;
          pool.winners = data.winners;
          pool.losers = data.losers;
          console.log(`Model ${modelId} - Pool ${pool.id} winners:`, data.winners);
          
          // Force a re-render after updating winners/losers
          setBattlesByModel(prev => {
            const updated = { ...prev };
            updated[modelId] = modelBattles;
            return updated;
          });
        } catch (error) {
          console.error(`Error processing pool ${pool.id} for model ${modelId}:`, error);
          setModelErrors(prev => ({
            ...prev,
            [modelId]: `Error processing pool ${pool.id}: ${error.message || 'Unknown error'}`
          }));
        } finally {
          pool.isLoading = false;
          // Force a re-render after loading completes
          setBattlesByModel(prev => {
            const updated = { ...prev };
            updated[modelId] = modelBattles;
            return updated;
          });
          console.log(`Model ${modelId} - Pool ${pool.id} loading complete`);
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

          // Update states with force re-render for all models
          setBattlesByModel(prev => {
            const updated = { ...prev };
            updated[modelId] = modelBattles;
            return updated;
          });
          
          // Set the active model to the one that just progressed
          setActiveModelId(modelId);
          
          setCurrentRoundByModel(prev => {
            const updated = { ...prev };
            updated[modelId] = currentRoundIndex + 1;
            currentRoundByModelRef.current = updated;
            return updated;
          });

          // Return the new round index
          return currentRoundIndex + 1;
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

          // Update states
          setBattlesByModel(prev => {
            const updated = { ...prev };
            updated[modelId] = modelBattles;
            return updated;
          });
          
          setCurrentRoundByModel(prev => {
            const updated = { ...prev };
            updated[modelId] = currentRoundIndex + 1;
            currentRoundByModelRef.current = updated;
            return updated;
          });

          // Indicate completion
          return null;
        } else {
          console.log(`Model ${modelId} - Unexpected number of winners: ${allWinners.length}`);
          return null;
        }
      } else {
        console.log(`Model ${modelId} - Not all pools have winners yet`);
        return null;
      }
    } catch (error) {
      console.error(`Error processing next round for model ${modelId}:`, error);
      setModelErrors(prev => ({
        ...prev,
        [modelId]: `Error processing next round: ${error.message || 'Unknown error'}`
      }));
      return null;
    }
  };

  // Update handleAutoPlay to initialize battles first
  const handleAutoPlay = async () => {
    console.log('Auto Play started');
    setIsAutoPlaying(true);

    try {
      // Remove the description field from selected cryptos
      const cryptosToSave = initialCryptosRef.current.map(({ description, ...rest }) => rest);
      localStorage.setItem('selectedCryptos', JSON.stringify(cryptosToSave));
      localStorage.setItem('lastPrompt', prompt);

      // First, initialize battles for all selected models if not already initialized
      const initialPools = createInitialPools(initialCryptosRef.current);

      // Initialize battles for all selected models
      setBattlesByModel(prev => {
        const newBattles = { ...prev };
        selectedModels.forEach(({ modelId }) => {
          if (!newBattles[modelId]) {
            // Create a deep copy of initialPools for each model
            const modelPools = initialPools.map(pool => ({
              ...pool,
              cryptos: [...pool.cryptos],
              id: pool.id
            }));

            newBattles[modelId] = [{ name: 'Round 1', pools: modelPools }];
          }
        });
        battlesByModelRef.current = newBattles;
        return newBattles;
      });

      // Initialize current round for all models
      setCurrentRoundByModel(prev => {
        const newRounds = { ...prev };
        selectedModels.forEach(({ modelId }) => {
          if (newRounds[modelId] === undefined) {
            newRounds[modelId] = 0;
          }
        });
        currentRoundByModelRef.current = newRounds;
        return newRounds;
      });

      // Wait a moment for state updates to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Initialize results object for tracking winners
      const modelResults: { [modelId: string]: { rounds: Round[]; winner: CryptoData; } } = {};

      // Run all model battles in parallel
      const battlePromises = selectedModels.map(async ({ modelId }) => {
        console.log(`Starting battle for model: ${modelId}`);
        let completed = false;

        while (!completed) {
          const newRoundIndex = await processNextRound(modelId);

          if (newRoundIndex === null) {
            // Tournament is complete for this model
            const finalRound = battlesByModelRef.current[modelId]?.slice(-1)[0];
            if (!finalRound) {
              console.error(`No final round found for model ${modelId}`);
              completed = true;
              continue;
            }

            // Get the winner from the winners array instead of just the first crypto
            const winner = finalRound.pools[0].winners?.[0]?.coin;
            if (!winner) {
              console.error(`No winner found in final round for model ${modelId}`);
              completed = true;
              continue;
            }

            modelResults[modelId] = {
              rounds: battlesByModelRef.current[modelId],
              winner
            };
            completed = true;
          }

          // Small delay between rounds
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      });

      // Wait for all battles to complete
      await Promise.all(battlePromises);

      // Calculate global scores and winner
      const scores = calculateGlobalScores(modelResults);
      const globalWinner = determineGlobalWinner(scores);

      // Create battle results
      const battleResults: BattleResults = {
        modelResults,
        globalWinner,
        scores
      };

      // Create battle hash from all results
      const battleHash = createBattleHash(Object.values(modelResults).flatMap(r => r.rounds));

      // Save battle history if not already saved
      if (!battleSavedRef.current) {
        const newBattle: BattleHistory = {
          id: battleHash,
          date: new Date().toISOString(),
          results: battleResults,
          prompt
        };

        // Save to either public or private storage based on savePublicly flag
        await handleSaveBattle(newBattle);
        
        // Update URL with battle ID
        const newUrl = `${window.location.pathname}?battle=${battleHash}`;
        window.history.pushState({}, '', newUrl);
        
        // Set selected battle ID
        setSelectedBattleId(battleHash);
      }

      // Refresh the wallet balance
      await fetchWalletBalance();

    } catch (error) {
      console.error('Error during auto play:', error);
    } finally {
      setIsAutoPlaying(false);
    }
  };

  // Modify loadBattle to ensure Refs are updated
  useEffect(() => {
    battlesByModelRef.current = battlesByModel;
  }, [battlesByModel]);

  useEffect(() => {
    currentRoundByModelRef.current = currentRoundByModel;
  }, [currentRoundByModel]);

  const loadBattle = async (battleId: string) => {
    console.log(`Loading battle with ID: ${battleId}`);
    
    // Try to load from private history first
    let battle = await getBattleByIdLocal(battleId);
    
    // If not found in private history, try public history
    if (!battle) {
      battle = await getPublicBattleById(battleId);
    }

    if (battle) {
      // Update URL without reloading the page
      const newUrl = battleId ? 
        `${window.location.pathname}?battle=${battleId}` : 
        window.location.pathname;
      window.history.pushState({}, '', newUrl);

      if (battle.results?.modelResults) {
        // Get all model IDs from the battle
        const modelIds = Object.keys(battle.results.modelResults);
        
        // Set up the battles and rounds for each model
        setBattlesByModel(
          modelIds.reduce((acc, modelId) => ({
            ...acc,
            [modelId]: (battle.results.modelResults[modelId] as { rounds: Round[] }).rounds
          }), {})
        );
        
        setCurrentRoundByModel(
          modelIds.reduce((acc, modelId) => ({
            ...acc,
            [modelId]: (battle.results.modelResults[modelId] as { rounds: Round[] }).rounds.length - 1
          }), {})
        );
        
        // Set up selected models
        setSelectedModels(
          modelIds.map(modelId => ({
            modelId,
            active: true
          }))
        );
        
        // Set the first model as active
        setActiveModelId(modelIds[0]);
      }
      
      setSelectedBattleId(battleId);
      setPrompt(battle.prompt);
      battleSavedRef.current = true;
      console.log('Battle loaded and saved flag set to true');
    } else {
      console.warn(`No battle found with ID: ${battleId}`);
    }
  };

  // Move isTournamentComplete inside the component
  const isTournamentComplete = (modelId: string | null): boolean => {
    if (!isValidModelId(modelId)) return false;
    
    const modelBattles = battlesByModel[modelId];
    const currentRound = currentRoundByModel[modelId];
    
    if (!modelBattles || currentRound === undefined) return false;
    
    const finalRound = modelBattles[currentRound];
    return finalRound?.pools?.length === 1 && 
           finalRound.pools[0]?.winners?.length === 1 &&
           finalRound.pools[0]?.winners[0]?.coin !== undefined;
  };

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

  // Add new state for save preference
  const [savePublicly, setSavePublicly] = useState(false);

  // Modify the save function to use the appropriate database
  const handleSaveBattle = async (newBattle: BattleHistory) => {
    try {
      if (savePublicly) {
        await saveHistory(newBattle); // Supabase
      } else {
        await saveBattleHistoryLocal(newBattle); // IndexedDB
      }
      setBattleHistories(prev => [...prev, newBattle]);
      battleSavedRef.current = true;
    } catch (error) {
      console.error('Error saving battle history:', error);
    }
  };

  // Add new state for wallet info
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);

  // Move fetchWalletBalance inside the component
  const fetchWalletBalance = async () => {
    const apiKey = localStorage.getItem('nanoGptApiKey');
    if (!apiKey) {
      setWalletInfo({ balance: '0', error: 'No API key set' });
      return;
    }

    try {
      const response = await fetch('/api/nano-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setWalletInfo({ balance: data.balance || '0' });
    } catch (error) {
      setWalletInfo({ 
        balance: '0', 
        error: error instanceof Error ? error.message : 'Failed to fetch balance' 
      });
    }
  };

  // Add effect to fetch initial balance
  useEffect(() => {
    fetchWalletBalance();
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelErrors, setModelErrors] = useState<{ [modelId: string]: string }>({});

  const handleSelectWinners = async () => {
    setLoading(true);
    setError(null); // Reset error before making the request

    try {
      const response = await axios.post('http://localhost:4321/api/selectWinners', {
        cryptos, // Ensure cryptos are passed correctly
        prompt,
        model: activeModelId,
        apiKey: localStorage.getItem('nanoGptApiKey')
      });

      // Handle successful response
      console.log('Winners selected:', response.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        // Set error message from the response
        setError(err.response.data.error || 'An unexpected error occurred');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to save selected cryptos to localStorage
  const saveSelectedCryptos = (selectedCryptos: CryptoData[]) => {
    localStorage.setItem('selectedCryptos', JSON.stringify(selectedCryptos));
  };

  // Function to load selected cryptos from localStorage
  const loadPreviousSelection = () => {
    const storedCryptos = localStorage.getItem('selectedCryptos');
    const storedPrompt = localStorage.getItem('lastPrompt');
    if (storedCryptos) {
      try {
        const parsedCryptos = JSON.parse(storedCryptos);
        startNewBattle(parsedCryptos);
        if (storedPrompt) {
          setPrompt(storedPrompt);
        }

        // Set isLoading to false for all pools after loading
        setBattlesByModel(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(modelId => {
            updated[modelId] = updated[modelId].map(round => ({
              ...round,
              pools: round.pools.map(pool => ({
                ...pool,
                isLoading: false
              }))
            }));
          });
          return updated;
        });

      } catch (error) {
        console.error('Failed to parse stored cryptos:', error);
      }
    } else {
      console.warn('No previous selection found.');
    }
  };

  // Example function to handle coin selection
  const handleCoinSelection = (selectedCryptos: CryptoData[]) => {
    saveSelectedCryptos(selectedCryptos);
    startNewBattle(selectedCryptos);
  };

  // Function to start a new battle
  const handleStartNewBattle = () => {
    startNewBattle(initialCryptosRef.current);
  };

  return (
    <div className="crypto-battle" data-component="CryptoBattle" {...props}>
      <div className="battle-header">
        <a href="/my-wallet" className="wallet-balance">
          <span className="balance-label">Balance:</span>
          <span className="balance-amount">
          Ӿ {parseFloat(walletInfo?.balance || '0').toString()} 
          </span>
          {walletInfo?.error && (
            <span className="balance-error" title={walletInfo.error}>⚠️</span>
          )}
        </a>
      </div>
      <div className="selection-container">
        <a href="/crypto-table" className="select-coins-button">
          Select Coins
          <span className="arrow">→</span>
        </a>
        <button onClick={loadPreviousSelection} className="reuse-selection-button">
          Reuse Previous Selection
        </button>
       
      </div>

      <div className="battle-controls">
        <div className="battle-history">
          <select 
            value={selectedBattleId || ''} 
            onChange={(e) => handleBattleSelect(e.target.value)}
            className="battle-select"
          >
            <option key="new-battle" value="">Start New Battle</option>
            {Array.isArray(battleHistories) && battleHistories.map((battle, index) => {
              const winner = battle.results?.globalWinner?.coin || 
                            (battle.results?.modelResults && 
                             Object.values(battle.results.modelResults)[0]?.winner);
              
              return (
                <option 
                  key={`battle-${battle.id}-${index}`} 
                  value={battle.id}
                >
                  {new Date(battle.date).toLocaleString()} - Winner: {winner?.name}
                </option>
              );
            })}
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

            {/* Add winners announcement when tournament completes */}
            {isValidModelId(activeModelId) && isTournamentComplete(activeModelId) && (
              <div className="battle-view">
                <div className="winner-announcement">
                  <div className="winner-header">
                    <h2>🏆 Results 🏆</h2>
                    <button 
                      onClick={() => {
                        const battle = selectedBattleId 
                          ? battleHistories.find(h => h.id === selectedBattleId)
                          : {
                              id: createBattleHash(Object.values(battlesByModel).flatMap(r => r)),
                              date: new Date().toISOString(),
                              results: {
                                modelResults: Object.fromEntries(
                                  selectedModels.map(({ modelId }) => [
                                    modelId,
                                    {
                                      rounds: battlesByModel[modelId].map(round => ({
                                        name: round.name,
                                        pools: round.pools.map(pool => ({
                                          id: pool.id,
                                          cryptos: pool.cryptos.map(stripCryptoData),
                                          winners: pool.winners?.map(w => ({
                                            coin: stripCryptoData(w.coin),
                                            reason: w.reason
                                          })),
                                          losers: pool.losers?.map(l => ({
                                            coin: stripCryptoData(l.coin),
                                            reason: l.reason
                                          }))
                                        }))
                                      })),
                                      winner: battlesByModel[modelId]?.slice(-1)[0]?.pools[0]?.winners?.[0]?.coin 
                                        ? stripCryptoData(battlesByModel[modelId].slice(-1)[0].pools[0].winners[0].coin)
                                        : null
                                    }
                                  ])
                                ),
                                globalWinner: null,
                                scores: {}
                              },
                              prompt
                            };
                        downloadBattleAsJson(battle);
                      }}
                      className="download-button"
                    >
                      📥 Download Results
                    </button>
                  </div>
                  <div className="model-winners">
                    {selectedModels.map(({ modelId }) => {
                      const modelBattles = battlesByModel[modelId];
                      const currentRound = currentRoundByModel[modelId];
                      if (!modelBattles || currentRound === undefined) return null;
                      
                      const winner = modelBattles[currentRound]?.pools[0]?.winners?.[0]?.coin;
                      if (!winner) return null;

                      return (
                        <div key={modelId} className="model-winner">
                          <h3>{models[modelId]?.name} Winner:</h3>
                          <div className="winner-card">
                            <img 
                              src={`/${winner.logo_local}`} 
                              alt={winner.name}
                              className="winner-logo"
                            />
                            <span className="winner-name">
                              {winner.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="prompt-display">
                  <h4>Selection Criteria:</h4>
                  <p>{prompt}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="battle-view">

            {!isTournamentComplete(activeModelId) && (
              <div className="prompt-display">
                <h4>Selection Criteria:</h4>
                <p>{prompt}</p>
              </div>
            )}
            
            {isValidModelId(activeModelId) && isTournamentComplete(activeModelId) && (
              <div className="winner-announcement">
                <div className="winner-header">
                  <h2>🏆 Results 🏆</h2>
                  <button 
                    onClick={() => {
                      const battle = selectedBattleId 
                        ? battleHistories.find(h => h.id === selectedBattleId)
                        : {
                            id: createBattleHash(Object.values(battlesByModel).flatMap(r => r)),
                            date: new Date().toISOString(),
                            results: {
                              modelResults: Object.fromEntries(
                                selectedModels.map(({ modelId }) => [
                                  modelId,
                                  {
                                    rounds: battlesByModel[modelId].map(round => ({
                                      name: round.name,
                                      pools: round.pools.map(pool => ({
                                        id: pool.id,
                                        cryptos: pool.cryptos.map(stripCryptoData),
                                        winners: pool.winners?.map(w => ({
                                          coin: stripCryptoData(w.coin),
                                          reason: w.reason
                                        })),
                                        losers: pool.losers?.map(l => ({
                                          coin: stripCryptoData(l.coin),
                                          reason: l.reason
                                        }))
                                      }))
                                    })),
                                    winner: battlesByModel[modelId]?.slice(-1)[0]?.pools[0]?.winners?.[0]?.coin 
                                      ? stripCryptoData(battlesByModel[modelId].slice(-1)[0].pools[0].winners[0].coin)
                                      : null
                                  }
                                ])
                              ),
                              globalWinner: null,
                              scores: {}
                            },
                            prompt
                          };
                      downloadBattleAsJson(battle);
                    }}
                    className="download-button"
                  >
                    📥 Download Results
                  </button>
                </div>
                <div className="model-winners">
                  {selectedModels.map(({ modelId }) => {
                    const modelBattles = battlesByModel[modelId];
                    const currentRound = currentRoundByModel[modelId];
                    if (!modelBattles || currentRound === undefined) return null;
                    
                    // Get the winner from the winners array instead of cryptos array
                    const winner = modelBattles[currentRound]?.pools[0]?.winners?.[0]?.coin;
                    if (!winner) return null;

                    return (
                      <div key={modelId} className="model-winner">
                        <h3>{models[modelId]?.name} Winner:</h3>
                        <div className="winner-card">
                          <img 
                            src={`/${winner.logo_local}`} 
                            alt={winner.name}
                            className="winner-logo"
                          />
                          <span className="winner-name">
                            {winner.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Show global winner with scores */}
                {selectedBattleId && battleHistories.find(h => h.id === selectedBattleId)?.results?.globalWinner && (
                  <div className="global-winner">
                    <h3>Tournament Winners</h3>
                    <div className="winners-podium">
                      {(() => {
                        const battle = battleHistories.find(h => h.id === selectedBattleId);
                        if (!battle?.results?.scores) return null;

                        const topThree = getTopThreeWinners(battle.results.scores);
                        
                        return topThree.map((winner, index) => (
                          <div key={winner.coin.ticker} className={`winner-card place-${index + 1}`}>
                            <div className="place-indicator">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </div>
                            <img 
                              src={`/${winner.coin.logo_local}`}
                              alt={winner.coin.name}
                              className="winner-logo"
                            />
                            <div className="winner-info">
                              <span className="winner-name">
                                {winner.coin.name}
                              </span>
                              <span className="winner-score">
                                Score: {winner.score}
                              </span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="prompt-display">
                <h4>Selection Criteria:</h4>
                <p>{prompt}</p>
              </div>
          </div>
        )}
        {/* Auto Play Button: hide if tournament is complete */}
        <div className={`battle-button-group ${isTournamentComplete(activeModelId) ? 'tournament-complete' : ''}`}>
          <div className="cost-estimate">
            Est. Cost: Ӿ {
              selectedModels.reduce((total, { modelId }) => {
                const modelCost = models[modelId]?.costEstimate || 0;
                return total + Number(calculateTotalCost(initialCryptosRef.current.length, modelCost));
              }, 0).toFixed(4)
            }
          </div>
          <button 
            onClick={handleAutoPlay}
            style={{ display: isTournamentComplete(activeModelId) ? 'none' : 'block' }}
            disabled={
              isAutoPlaying || 
              !isValidModelId(activeModelId) || 
              isTournamentComplete(activeModelId) || 
              selectedBattleId !== null || 
              !prompt.trim()
            }
            className="auto-play-button"
          >
            {isAutoPlaying ? (
              <>
                <span className="button-spinner"></span>
                Battle in Progress...
              </>
            ) : 
             !isValidModelId(activeModelId) ? 'Select a Model' :
             isTournamentComplete(activeModelId) ? 'Tournament Complete!' : 
             selectedBattleId ? 'Viewing Past Battle' :
             !prompt.trim() ? 'Enter Selection Criteria' :
             'Start Auto Battle'}
          </button>

          <label className="save-switch">
            <span>Public</span>
            <span className="switch">
              <input
                type="checkbox"
                checked={savePublicly}
                onChange={(e) => setSavePublicly(e.target.checked)}
                disabled={isAutoPlaying}
              />
              <span className="slider"></span>
            </span>
          </label>
        </div>
      </div>

      {selectedModels.length > 0 && (
          <div className="model-tabs">
            {selectedModels.map(({ modelId }) => (
              <button
                key={modelId}
                className={`model-tab ${activeModelId === modelId ? 'active' : ''}`}
                onClick={() => setActiveModelId(modelId)}
                disabled={isAutoPlaying}
              >
                {models[modelId]?.name}
                {isTournamentComplete(modelId) && (
                  <span className="completion-indicator" title="Battle Complete">✓</span>
                )}
              </button>
            ))}
          </div>
        )}

      {/* Display battles for all selected models */}
      <div className="models-battles-container">
        {activeModelId && battlesByModel[activeModelId] && (
          <div 
            key={`model-${activeModelId}`} 
            className="model-battle active"
          >
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
          </div>
        )}
      </div>

      {Object.entries(modelErrors).map(([modelId, errorMessage]) => (
        <div key={modelId} className="error-message">
          <p>Error for model {modelId}: {errorMessage}</p>
        </div>
      ))}

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
} 