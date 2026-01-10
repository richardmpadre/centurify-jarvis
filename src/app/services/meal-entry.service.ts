import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

export interface MealEntry {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  completed: boolean;
  mealId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyNutritionTotals {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
}

@Injectable({
  providedIn: 'root'
})
export class MealEntryService {
  private client = generateClient<Schema>();

  async getMealEntriesForDate(date: string): Promise<MealEntry[]> {
    try {
      const response = await this.client.models.MealEntry.list({
        filter: { date: { eq: date } }
      });
      const entries = (response.data || []).map(m => this.mapToMealEntry(m));
      console.log(`Loaded ${entries.length} meal entries for ${date}:`, entries.map(e => ({ name: e.name, mealType: e.mealType, completed: e.completed })));
      return entries;
    } catch (error) {
      console.error('Error fetching meal entries:', error);
      return [];
    }
  }

  async createMealEntry(entry: Omit<MealEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MealEntry | null> {
    try {
      const response = await this.client.models.MealEntry.create({
        date: entry.date,
        mealType: entry.mealType,
        name: entry.name,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats,
        completed: entry.completed ?? false,
        mealId: entry.mealId
      });
      
      if (response.data) {
        return this.mapToMealEntry(response.data);
      }
      return null;
    } catch (error) {
      console.error('Error creating meal entry:', error);
      return null;
    }
  }

  async updateMealEntry(id: string, updates: Partial<Omit<MealEntry, 'id' | 'createdAt' | 'updatedAt'>>): Promise<MealEntry | null> {
    try {
      const response = await this.client.models.MealEntry.update({
        id,
        ...updates
      });
      
      if (response.data) {
        return this.mapToMealEntry(response.data);
      }
      return null;
    } catch (error) {
      console.error('Error updating meal entry:', error);
      return null;
    }
  }

  async deleteMealEntry(id: string): Promise<boolean> {
    try {
      await this.client.models.MealEntry.delete({ id });
      return true;
    } catch (error) {
      console.error('Error deleting meal entry:', error);
      return false;
    }
  }

  async toggleMealCompleted(id: string, completed: boolean): Promise<MealEntry | null> {
    try {
      console.log(`Toggling meal ${id} to completed: ${completed}`);
      const response = await this.client.models.MealEntry.update({
        id,
        completed: completed
      });
      
      if (response.data) {
        console.log('Meal updated successfully:', response.data);
        return this.mapToMealEntry(response.data);
      }
      if (response.errors) {
        console.error('Errors updating meal:', response.errors);
      }
      return null;
    } catch (error) {
      console.error('Error toggling meal completed:', error);
      return null;
    }
  }

  calculateDailyTotals(entries: MealEntry[]): DailyNutritionTotals {
    return entries.reduce((totals, entry) => ({
      totalCalories: totals.totalCalories + (entry.calories || 0),
      totalProtein: totals.totalProtein + (entry.protein || 0),
      totalCarbs: totals.totalCarbs + (entry.carbs || 0),
      totalFats: totals.totalFats + (entry.fats || 0)
    }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFats: 0 });
  }

  private mapToMealEntry(data: any): MealEntry {
    return {
      id: data.id,
      date: data.date,
      mealType: data.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
      name: data.name,
      calories: data.calories,
      protein: data.protein ?? null,
      carbs: data.carbs ?? null,
      fats: data.fats ?? null,
      completed: data.completed ?? false,
      mealId: data.mealId ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }
}
