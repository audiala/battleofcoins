import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import type { BattleHistory } from '../types/battle';
import { saveBattleHistory as saveLocalHistory } from './BattleDatabaseLocal';

// Add this type for the database battle
interface DatabaseBattle {
  id: string;
  date: string;
  results: any; // or define a more specific type
  prompt: string;
  public?: boolean;
  // Note: summary is intentionally omitted for database compatibility
}

export const saveBattleHistory = async (battle: BattleHistory): Promise<void> => {
  try {
    // Remove the summary field before saving to database
    const { summary, ...battleForDb } = battle;
    
    // Use the existing supabase instance instead of creating a new client
    const { error } = await supabase
      .from('battle_histories')
      .upsert([battleForDb]);

    if (error) throw error;
  } catch (error) {
    console.error('Error saving battle history:', error);
    throw error;
  }
};

export const saveBattleHistoryLocal = saveLocalHistory;

export async function getAllBattleHistories(page: number, perPage: number) {
  try {
    // First get total count
    const { count, error: countError } = await supabase
      .from('battle_histories')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Then get paginated data
    const { data, error } = await supabase
      .from('battle_histories')
      .select('*')
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
    const { data, error } = await supabase
      .from('battle_histories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
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