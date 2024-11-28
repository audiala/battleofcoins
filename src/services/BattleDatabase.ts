import { supabase } from './supabase';
import type { BattleHistory } from '../types/battle';
import { saveBattleHistory as saveLocalHistory } from './BattleDatabaseLocal';

// Helper function to strip unnecessary data from CryptoData
const stripCryptoData = (crypto: any) => ({
  id: crypto.id,
  name: crypto.name,
  ticker: crypto.ticker,
  logo_local: crypto.logo_local,
});

// Helper function to clean battle data
const cleanBattleData = (battle: BattleHistory) => {
  const cleanedResults = {
    ...battle.results,
    modelResults: Object.fromEntries(
      Object.entries(battle.results.modelResults).map(([modelId, result]) => [
        modelId,
        {
          rounds: result.rounds.map(round => ({
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
          winner: result.winner ? stripCryptoData(result.winner) : null
        }
      ])
    ),
    globalWinner: battle.results.globalWinner ? {
      coin: stripCryptoData(battle.results.globalWinner.coin),
      score: battle.results.globalWinner.score
    } : null,
    scores: Object.fromEntries(
      Object.entries(battle.results.scores).map(([ticker, score]) => [
        ticker,
        {
          coin: stripCryptoData(score.coin),
          score: score.score
        }
      ])
    )
  };

  return {
    id: battle.id,
    date: battle.date,
    prompt: battle.prompt,
    summary: battle.summary,
    results: cleanedResults
  };
};

export const saveBattleHistory = async (battle: BattleHistory): Promise<void> => {
  try {
    console.log('Cleaning battle data for Supabase...');
    const cleanedBattle = cleanBattleData(battle);
    console.log('Saving cleaned battle to Supabase...');
    
    const { error } = await supabase
      .from('battle_histories')
      .upsert([cleanedBattle]);

    if (error) throw error;
    console.log('Battle saved successfully to Supabase');
  } catch (error) {
    console.error('Error saving battle history:', error);
    throw error;
  }
};

// Update local save function to also clean the data
export const saveBattleHistoryLocal = async (battle: BattleHistory): Promise<void> => {
  try {
    console.log('Cleaning battle data for local storage...');
    const cleanedBattle = cleanBattleData(battle);
    console.log('Saving cleaned battle to IndexedDB...');
    await saveLocalHistory(cleanedBattle);
    console.log('Battle saved successfully to IndexedDB');
  } catch (error) {
    console.error('Error saving battle locally:', error);
    throw error;
  }
};

export async function getAllBattleHistories(page: number, perPage: number) {
  try {
    // First get total count
    const { count, error: countError } = await supabase
      .from('battle_histories')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Then get paginated data with all columns explicitly listed
    const { data, error } = await supabase
      .from('battle_histories')
      .select(`
        id,
        date,
        prompt,
        summary,
        results
      `)
      .order('date', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (error) throw error;

    return {
      battles: data || [],
      total: count || 0
    };
  } catch (error) {
    console.error('Error getting battle histories:', error);
    return { battles: [], total: 0 };
  }
}

export async function getBattleById(id: string) {
  try {
    console.log('Fetching battle with ID:', id);
    const { data, error } = await supabase
      .from('battle_histories')
      .select(`
        id,
        date,
        prompt,
        summary,
        results
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    
    console.log('Battle data loaded:', {
      id: data.id,
      date: data.date,
      hasSummary: !!data.summary,
      hasResults: !!data.results
    });
    
    return data;
  } catch (error) {
    console.error('Error getting battle by ID:', error);
    throw error;
  }
}

export const deleteBattleHistory = async (id: string) => {
  try {
    const { error } = await supabase
      .from('battle_histories')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting battle:', error);
    throw error;
  }
}; 