import { supabase } from './supabase';
import type { BattleHistory } from '../types/battle';
import { saveBattleHistory as saveLocalHistory } from './BattleDatabaseLocal';

export async function saveBattleHistory(battle: BattleHistory) {
  try {
    const { data, error } = await supabase
      .from('battle_histories')
      .insert([battle])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving battle history:', error);
    throw error;
  }
}

export const saveBattleHistoryLocal = saveLocalHistory;

export async function getAllBattleHistories() {
  try {
    const { data, error } = await supabase
      .from('battle_histories')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting battle histories:', error);
    throw error;
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
    await db.battleHistories.delete(id);
  } catch (error) {
    console.error('Error deleting battle from IndexedDB:', error);
    throw error;
  }
}; 