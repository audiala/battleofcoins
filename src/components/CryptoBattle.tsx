import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CryptoData } from './CryptoTable';
import axios from 'axios';
import { Tooltip } from './Tooltip';
import { CryptoCard } from './CryptoCard';
import { ModelTooltip } from './ModelTooltip';
import { 
  saveBattleHistory as saveHistory,
  getBattleById as getPublicBattleById,
  getAllBattleHistories as getAllBattleHistoriesPublic
} from '../services/BattleDatabase';

import {
  saveBattleHistory as saveBattleHistoryLocal,
  getAllBattleHistories as getAllBattleHistoriesLocal,
  getBattleById as getBattleByIdLocal,
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
  summary?: string;
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

// Add this interface for the battle summary
interface BattleSummary {
  text: string;
  isLoading: boolean;
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

// Update the createBattleHash function to handle the model results structure
const createBattleHash = (modelResults: { [modelId: string]: { rounds: Round[]; winner: CryptoData; } }): string => {
  // Create a string representation of all rounds from all models
  const battleString = Object.values(modelResults)
    .flatMap(result => result.rounds)
    .map(round => 
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
  return Math.abs(hash).toString(36); // Convert to base36 for shorter string
};

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

// Add these helper functions for image generation
const generateBattleImage = async (battle: BattleHistory, models: TextModels) => {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Set canvas size
  canvas.width = 1200;
  canvas.height = 800;

  // Set background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Load all images first (returns array of [path, loaded_image])
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  try {
    // Set styles
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial';
    
    // Draw title
    ctx.fillText('🏆 Crypto Battle Results 🏆', 50, 50);

    // Draw prompt
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Selection Criteria:', 50, 100);
    ctx.font = '18px Arial';

    // Word wrap the prompt
    const words = battle.prompt.split(' ');
    let line = '';
    let y = 130;
    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > canvas.width - 100) {
        ctx.fillText(line, 50, y);
        line = word + ' ';
        y += 25;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 50, y);

    // Draw models used
    y += 50;
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Models Used:', 50, y);
    y += 30;
    ctx.font = '18px Arial';
    Object.entries(battle.results.modelResults).forEach(([modelId]) => {
      ctx.fillText(`• ${models[modelId]?.name || modelId}`, 50, y);
      y += 25;
    });

    // Draw winners
    y += 30;
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Top 3 Winners:', 50, y);
    y += 50;

    // Load and draw winner logos
    const topThree = getTopThreeWinners(battle.results.scores);
    const medals = ['🥇', '🥈', '🥉'];
    
    for (let i = 0; i < topThree.length; i++) {
      const winner = topThree[i];
      try {
        const logo = await loadImage(`/public/logos/${winner.coin.ticker.toLowerCase()}.png`);
        // Draw medal emoji
        ctx.font = '24px Arial';
        ctx.fillText(medals[i], 50, y);
        // Draw logo
        ctx.drawImage(logo, 90, y - 30, 30, 30);
        // Draw name and score
        ctx.font = '18px Arial';
        ctx.fillText(`${winner.coin.name} - Score: ${winner.score}`, 130, y);
        y += 40;
      } catch (error) {
        console.error(`Failed to load logo for ${winner.coin.name}`, error);
        // Skip logo and just draw text
        ctx.fillText(`${medals[i]} ${winner.coin.name} - Score: ${winner.score}`, 50, y);
        y += 40;
      }
    }
    y += 50;
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Summary:', 50, y);
    y += 30;
    ctx.font = '18px Arial';
    ctx.fillText(battle.results.summary?.text || 'No summary available', 50, y);

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating battle image:', error);
    throw error;
  }
};

// Add this helper function at the top level if not already present
// const createBattleHash = (modelResults: any): string => {
//   // Create a string representation of the battle results
//   const battleString = JSON.stringify(modelResults);
  
//   // Simple hash function
//   let hash = 0;
//   for (let i = 0; i < battleString.length; i++) {
//     const char = battleString.charCodeAt(i);
//     hash = ((hash << 5) - hash) + char;
//     hash = hash & hash; // Convert to 32-bit integer
//   }
//   return Math.abs(hash).toString(36); // Convert to base36 for shorter string
// };

export default function CryptoBattle({ cryptos, ...props }: CryptoBattleProps & { [key: string]: any }) {
  // console.log('CryptoBattle received cryptos:', cryptos?.length);

  // Store initial cryptos in a ref to avoid re-renders
  const initialCryptosRef = useRef<CryptoData[]>(cryptos);
  
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [battleHistories, setBattleHistories] = useState<BattleHistory[]>([]);
  const [publicBattleHistories, setPublicBattleHistories] = useState<BattleHistory[]>([]);
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
  const [battleSummary, setBattleSummary] = useState<BattleSummary>({
    text: '',
    isLoading: false
  });

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
        const publicHistories = await getAllBattleHistoriesPublic(1, 100);
        setPublicBattleHistories(publicHistories.battles);
        
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

          // console.log('Battle found:', battle);
          setCurrentBattle(battle);
          

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
            setBattleHistories(prev => [...prev, battle]);
            setSelectedBattleId(battleId);
            setPrompt(battle.prompt);
            setBattleSummary({
              text: battle.summary,
              isLoading: false
            });
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

  // Update the handleBattleSelect function
  const handleBattleSelect = async (battleId: string) => {
    if (!battleId) {
      // Clear all state for new battle
      setCurrentBattle(null);
      setBattlesByModel({});
      setCurrentRoundByModel({});
      setSelectedBattleId(null);
      setPrompt('');
      setBattleSummary({
        text: '',
        isLoading: false
      });
      battleSavedRef.current = false;
      
      // Reset URL
      const newUrl = window.location.pathname;
      window.history.pushState({}, '', newUrl);
      
      // Initialize with default model if none selected
      if (selectedModels.length === 0 && Object.keys(models).length > 0) {
        const defaultModel = Object.keys(models)[0];
        setSelectedModels([{ modelId: defaultModel, active: true }]);
        setActiveModelId(defaultModel);
      }
      
      return;
    }

    // Load existing battle...
    await loadBattle(battleId);
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

          const response = await axios.post('/api/selectWinners', {
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

  // Add state for save target
  const [savePublicly, setSavePublicly] = useState(false);

  // Modify handleAutoPlay to use the correct save target
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

      // Generate battle hash from model results
      const battleHash = createBattleHash(modelResults);

      // Create battle object
      const newBattle: BattleHistory = {
        id: battleHash,
        date: new Date().toISOString(),
        results: {
          modelResults,
          globalWinner: globalWinner || {
            coin: Object.values(modelResults)[0].winner,
            score: 1
          },
          scores
        },
        prompt
      };

      try {
        if (savePublicly) {
          // First save without summary
          await saveHistory(newBattle);
          
          // Generate summary
          const response = await fetch('/api/generate-battle-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              battle: newBattle,
              models,
              apiKey: localStorage.getItem('nanoGptApiKey')
            })
          });

          if (!response.ok) {
            throw new Error('Failed to generate summary');
          }

          const { summary } = await response.json();
          
          // Save again with summary
          const battleWithSummary = { ...newBattle, summary };
          await saveHistory(battleWithSummary);
          
          // Update local state
          setBattleSummary({
            text: summary,
            isLoading: false
          });
          setBattleHistories(prev => [...prev, battleWithSummary]);
          setCurrentBattle(battleWithSummary);

        } else {
          // Generate summary before saving locally
          const response = await fetch('/api/generate-battle-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              battle: newBattle,
              models,
              apiKey: localStorage.getItem('nanoGptApiKey')
            })
          });

          if (!response.ok) {
            throw new Error('Failed to generate summary');
          }

          const { summary } = await response.json();
          
          // Save locally with summary
          const battleWithSummary = { ...newBattle, summary };
          await saveBattleHistoryLocal(battleWithSummary);
          
          // Update local state
          setBattleSummary({
            text: summary,
            isLoading: false
          });
          setBattleHistories(prev => [...prev, battleWithSummary]);
          setCurrentBattle(battleWithSummary);
        }

        // Update URL and selected battle ID
        const newUrl = `${window.location.pathname}?battle=${battleHash}`;
        window.history.pushState({}, '', newUrl);
        setSelectedBattleId(battleHash);
        battleSavedRef.current = true;

      } catch (error) {
        console.error('Error saving battle:', error);
        throw error;
      }

      // Refresh the wallet balance
      await fetchWalletBalance();

    } catch (error) {
      console.error('Error during auto play:', error);
    } finally {
      setIsAutoPlaying(false);
    }
  };

  // Add new state for current battle
  const [currentBattle, setCurrentBattle] = useState<BattleHistory | null>(null);

  // Update loadBattle function to use the setter
  const loadBattle = async (battleId: string) => {
    console.log(`Loading battle with ID: ${battleId}`);
    
    // Try to load from private history first
    let battle = await getBattleByIdLocal(battleId);
    
    // If not found in private history, try public history
    if (!battle) {
      battle = await getPublicBattleById(battleId);
    }

    if (battle) {
      setCurrentBattle(battle); // Set the current battle      
      // Update URL without reloading the page
      const newUrl = battleId ? 
        `${window.location.pathname}?battle=${battleId}` : 
        window.location.pathname;
      window.history.pushState({}, '', newUrl);

      if (battle.results?.modelResults) {
        // Set up the battles and rounds for each model
        const modelIds = Object.keys(battle.results.modelResults);
        
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
        
        setSelectedModels(
          modelIds.map(modelId => ({
            modelId,
            active: true
          }))
        );
        
        setActiveModelId(modelIds[0]);
      }
      
      // Set the saved summary if available
      setBattleSummary({
        text: battle.summary || '',
        isLoading: false
      });
      setSelectedBattleId(battleId);
      setPrompt(battle.prompt);
      battleSavedRef.current = true;
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



  // Modify the save function to use the appropriate database
  const handleSaveBattle = async (newBattle: BattleHistory) => {
    try {
      if (savePublicly) {
        await saveHistory({ ...newBattle, public: true }); // Save to Supabase
      } else {
        await saveBattleHistoryLocal(newBattle); // Save to IndexedDB
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

  // Add to component state


  // Update the generateBattleSummary function
  const generateBattleSummary = async (battle: BattleHistory) => {
    setBattleSummary(prev => {
      console.log('Setting loading state:', { ...prev, text: '', isLoading: true });
      return { text: '', isLoading: true };
    });
    
    try {
      const response = await fetch('/api/generate-battle-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          battle,
          models,
          apiKey: localStorage.getItem('nanoGptApiKey')
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setBattleSummary(prev => {
        console.log('Setting success state:', { ...prev, text: data.summary, isLoading: false });
        return { text: data.summary, isLoading: false };
      });
    } catch (error) {
      console.error('Error generating battle summary:', error);
      setBattleSummary(prev => {
        console.log('Setting error state:', { 
          ...prev, 
          text: '', 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Failed to generate summary' 
        });
        return {
          text: '',
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to generate summary'
        };
      });
    }
  };

  // Move handleTwitterShare inside the component
  const handleTwitterShare = useCallback(async (battle: BattleHistory) => {
    if (!battle.id) return;

    let battleToShare = battle;

    // If battle is not public, ask for permission
    if (!battleToShare.public) {
      const shouldMakePublic = window.confirm(
        'This battle needs to be public to share it. Would you like to make it public?'
      );
      
      if (shouldMakePublic) {
        try {
          // First save without summary
          const { summary, ...battleWithoutSummary } = battleToShare;
          const publicBattle = { ...battleWithoutSummary, public: true };
          
          // Save initial version publicly
          await saveHistory(publicBattle);
          
          // Generate summary
          const response = await fetch('/api/generate-battle-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              battle: publicBattle,
              models,
              apiKey: localStorage.getItem('nanoGptApiKey')
            })
          });

          if (!response.ok) {
            throw new Error('Failed to generate summary');
          }

          const { summary: generatedSummary } = await response.json();
          
          // Update battle with summary and save again
          const battleWithSummary = {
            ...publicBattle,
            summary: generatedSummary
          };
          
          // Save updated version with summary
          await saveHistory(battleWithSummary);
          
          // Update the battle object to use for sharing
          battleToShare = battleWithSummary;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Failed to make battle public:', error);
          alert(`Failed to make battle public: ${errorMessage}`);
          return;
        }
      } else {
        return; // User declined to make public
      }
    }

    try {
      if (Object.keys(models).length === 0) {
        throw new Error('Models not loaded yet');
      }

      // Generate the image using models from component state
      const imageData = await generateBattleImage(battleToShare, models);
      
      // Create a blob from the image data
      const imageBlob = await (await fetch(imageData)).blob();
      
      // Create form data for the image upload
      const formData = new FormData();
      formData.append('image', imageBlob, 'battle-results.png');
      
      // Upload image and get URL
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const { imageUrl } = await response.json();
      
      // Create tweet text
      const tweetText = encodeURIComponent(
        `Check out my Crypto Battle results!\n` +
        `🏆 Winners selected using AI\n` +
        `🔗 View full results: ${window.location.origin}/battle?id=${battleToShare.id}\n` +
        `#CryptoBattle #AI #Crypto`
      );

      // Open Twitter share dialog
      window.open(
        `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(imageUrl)}`,
        '_blank'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error sharing to Twitter:', error);
      alert(`Failed to share to Twitter: ${errorMessage}`);
    }
  }, [models]); // Add models as a dependency

  // Add this function to handle public switch changes
  const handlePublicSwitchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const isPublic = e.target.checked;
    setSavePublicly(isPublic);
    
    // Only attempt to save if we have a selected battle
    if (selectedBattleId) {
      const battle = battleHistories.find(h => h.id === selectedBattleId);
      if (!battle) {
        console.log('No battle found with ID:', selectedBattleId);
        return;
      }

      try {
        console.log('Attempting to save battle as public:', isPublic);
        console.log('Battle data:', battle);

        if (isPublic) {
          // First save without summary
          console.log('Saving initial battle without summary to Supabase...');
          await saveHistory(battle);
          
          // Generate summary
          console.log('Generating battle summary...');
          try {
            const response = await fetch('/api/generate-battle-summary', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                battle,
                models,
                apiKey: localStorage.getItem('nanoGptApiKey')
              })
            });

            if (!response.ok) {
              throw new Error('Failed to generate summary');
            }

            const { summary } = await response.json();
            console.log('Summary generated:', summary);
            
            // Save again with summary
            const battleWithSummary = { ...battle, summary };
            console.log('Saving battle with summary to Supabase...');
            await saveHistory(battleWithSummary);
            
            // Update local state
            console.log('Setting summary local state:', summary);
            setBattleSummary({
              text: summary,
              isLoading: false
            });
          } catch (error) {
            console.error('Error generating/saving summary:', error);
            // Continue with the battle saved without summary
          }
        } else {
          // Save as private to local storage
          console.log('Saving battle as private...');
          await saveBattleHistoryLocal(battle);
          console.log('Battle saved successfully as private');
        }
      } catch (error) {
        console.error('Error saving battle:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to save battle: ${errorMessage}`);
        // Revert switch state on error
        setSavePublicly(!isPublic);
      }
    }
  };

  return (
    <div className="crypto-battle" data-component="CryptoBattle" {...props}>
      <a href="/" className="site-logo">
        <img src="/logo.png" alt="Crypto Battle" className="logo-image" />
        <span className="logo-text">Battle Of Coins</span>
      </a>

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
            <optgroup label="Local Battles">
              {battleHistories.map((battle, index) => (
                <option key={`local-${battle.id}-${index}`} value={battle.id}>
                  {new Date(battle.date).toLocaleString()} - {battle.results.globalWinner.coin.ticker}: {battle.results.globalWinner.score }
                </option>
              ))}
            </optgroup>
            <optgroup label="Public Battles">
              {publicBattleHistories.map((battle, index) => (
                <option key={`public-${battle.id}-${index}`} value={battle.id}>
                  {new Date(battle.date).toLocaleString()} - {battle.results.globalWinner.coin.ticker}: {battle.results.globalWinner.score }
                </option>
              ))}
            </optgroup>
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
                        <div className="model-name">{model.name}</div>
                        <div className="model-cost">{model.cost.replace('Average cost', 'avg')}</div>
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
                    <div className="result-actions">
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
                      {/* <button 
                        onClick={() => {
                          const battle = battleHistories.find(h => h.id === selectedBattleId);
                          if (battle && Object.keys(models).length > 0) {
                            handleTwitterShare(battle);
                          } else if (!Object.keys(models).length) {
                            alert('Please wait for models to load before sharing');
                          }
                        }}
                        className="share-button"
                        disabled={!selectedBattleId || Object.keys(models).length === 0}
                      >
                        🐦 Share on Twitter
                      </button> */}
                    </div>
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
                              src={`/logos/${winner.ticker.toLowerCase()}.png`} 
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
                  <div className="battle-summary loading">
                      <h4>Battle Summary:</h4>
                      <div className="loading-spinner"></div>
                      <p>Generating battle summary...</p>
                    </div>
                  
                  
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
                <div className="battle-summary loading">
                      <h4>Battle Summary:</h4>
                      <div className="loading-spinner"></div>
                      <p>Generating battle summary...</p>
                    </div>
              </div>
            )}
            
            
            {isValidModelId(activeModelId) && isTournamentComplete(activeModelId) && (
              <div className="winner-announcement">
                <div className="winner-header">
                  <h2>🏆 Results 🏆</h2>
                  <div className="result-actions">
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
                    {/* <button 
                      onClick={() => {
                        const battle = battleHistories.find(h => h.id === selectedBattleId);
                        if (battle && Object.keys(models).length > 0) {
                          handleTwitterShare(battle);
                        } else if (!Object.keys(models).length) {
                          alert('Please wait for models to load before sharing');
                        }
                      }}
                      className="share-button"
                      disabled={!selectedBattleId || Object.keys(models).length === 0}
                    >
                      🐦 Share on Twitter
                    </button> */}
                  </div>
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
                        <h3>{models[modelId]?.name}:</h3>
                        <div className="winner-card">
                          <img 
                            src={`/logos/${winner.ticker.toLowerCase()}.png`} 
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
                {/* {console.log(battleHistories)} */}
                {selectedBattleId && currentBattle?.results?.globalWinner && (
                  <div className="global-winner">
                    <h3>Tournament Winners</h3>
                    <div className="winners-podium">
                      {(() => {
                        if (!currentBattle?.results?.scores) return null;

                        const topThree = getTopThreeWinners(currentBattle.results.scores);
                        
                        return topThree.map((winner, index) => (
                          <div key={winner.coin.ticker} className={`winner-card place-${index + 1}`}>
                            <div className="place-indicator">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </div>
                            <img 
                              src={`/logos/${winner.coin.ticker.toLowerCase()}.png`}
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
                  {battleSummary.isLoading ? (
                    <div className="battle-summary loading">
                      <h4>Battle Summary:</h4>
                      <div className="loading-spinner"></div>
                      <p>Generating battle summary...</p>
                    </div>
                  ) : battleSummary.text ? (
                    <div className="battle-summary">
                      <h4>Battle Summary:</h4>
                      <p>{battleSummary.text}</p>
                      <div className="disclaimer">
                        <h4>Disclaimer:</h4>
                        <p>This summary is generated by an AI and is likely not accurate. It is provided for entertainment purposes only.
                        The information contained on this Website and the resources available for download through this
                        website is not intended as, and shall not be understood or construed as, financial advice.
                        </p>
                      </div>
                    </div>
                  ) : battleSummary.error ? (
                    <div className="battle-summary error">
                      <p>Failed to generate summary: {battleSummary.error}</p>
                    </div>
                  ) : null}
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
                onChange={handlePublicSwitchChange}
                // disabled={isAutoPlaying || !selectedBattleId}
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