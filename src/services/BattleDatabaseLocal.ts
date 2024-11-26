import Dexie, { Table } from 'dexie';
import type { BattleHistory } from '../components/CryptoBattle';

export class BattleDatabase extends Dexie {
  battleHistories!: Table<BattleHistory>;

  constructor() {
    super('CryptoBattleDB');
    this.version(1).stores({
      battleHistories: 'id, date'
    });
  }
}

export const db = new BattleDatabase();

// Helper functions for database operations
export const saveBattleHistory = async (battle: BattleHistory) => {
  try {
    await db.battleHistories.put(battle);
  } catch (error) {
    console.error('Error saving battle to IndexedDB:', error);
    throw error;
  }
};

export const getAllBattleHistories = async (): Promise<BattleHistory[]> => {
  try {
    return await db.battleHistories.orderBy('date').reverse().toArray();
  } catch (error) {
    console.error('Error getting battle histories from IndexedDB:', error);
    return [];
  }
};

export const getBattleById = async (id: string): Promise<BattleHistory | undefined> => {
  try {
    return await db.battleHistories.get(id);
  } catch (error) {
    console.error('Error getting battle by ID from IndexedDB:', error);
    return undefined;
  }
};

export const deleteBattleHistory = async (id: string) => {
  try {
    await db.battleHistories.delete(id);
  } catch (error) {
    console.error('Error deleting battle from IndexedDB:', error);
    throw error;
  }
};

export const clearAllBattleHistories = async () => {
  try {
    await db.battleHistories.clear();
  } catch (error) {
    console.error('Error clearing battle histories from IndexedDB:', error);
    throw error;
  }
}; 