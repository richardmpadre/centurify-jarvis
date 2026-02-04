import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

export interface FoodEntry {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  completed: boolean;
  foodId: string | null;
  portion: number; // portion size multiplier (e.g., 1.0 = 1 serving, 0.5 = half serving)
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
export class FoodEntryService {
  private client = generateClient<Schema>();

  async getFoodEntriesForDate(date: string): Promise<FoodEntry[]> {
    try {
      const response = await this.client.models.FoodEntry.list({
        filter: { date: { eq: date } }
      });
      const entries = (response.data || []).map(f => this.mapToFoodEntry(f));
      console.log(`Loaded ${entries.length} food entries for ${date}:`, entries.map(e => ({ name: e.name, mealType: e.mealType, completed: e.completed })));
      return entries;
    } catch (error) {
      console.error('Error fetching food entries:', error);
      return [];
    }
  }

  async createFoodEntry(entry: Omit<FoodEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<FoodEntry | null> {
    try {
      const response = await this.client.models.FoodEntry.create({
        date: entry.date,
        mealType: entry.mealType,
        name: entry.name,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats,
        completed: entry.completed ?? false,
        foodId: entry.foodId,
        portion: entry.portion ?? 1
      });
      
      if (response.data) {
        return this.mapToFoodEntry(response.data);
      }
      return null;
    } catch (error) {
      console.error('Error creating food entry:', error);
      return null;
    }
  }

  async updateFoodEntry(id: string, updates: Partial<Omit<FoodEntry, 'id' | 'createdAt' | 'updatedAt'>>): Promise<FoodEntry | null> {
    try {
      const response = await this.client.models.FoodEntry.update({
        id,
        ...updates
      });
      
      if (response.data) {
        return this.mapToFoodEntry(response.data);
      }
      return null;
    } catch (error) {
      console.error('Error updating food entry:', error);
      return null;
    }
  }

  async deleteFoodEntry(id: string): Promise<boolean> {
    try {
      await this.client.models.FoodEntry.delete({ id });
      return true;
    } catch (error) {
      console.error('Error deleting food entry:', error);
      return false;
    }
  }

  async toggleFoodCompleted(id: string, completed: boolean): Promise<FoodEntry | null> {
    try {
      console.log(`Toggling food ${id} to completed: ${completed}`);
      const response = await this.client.models.FoodEntry.update({
        id,
        completed: completed
      });
      
      if (response.data) {
        console.log('Food updated successfully:', response.data);
        return this.mapToFoodEntry(response.data);
      }
      if (response.errors) {
        console.error('Errors updating food:', response.errors);
      }
      return null;
    } catch (error) {
      console.error('Error toggling food completed:', error);
      return null;
    }
  }

  calculateDailyTotals(entries: FoodEntry[]): DailyNutritionTotals {
    return entries.reduce((totals, entry) => ({
      totalCalories: totals.totalCalories + (entry.calories || 0),
      totalProtein: totals.totalProtein + (entry.protein || 0),
      totalCarbs: totals.totalCarbs + (entry.carbs || 0),
      totalFats: totals.totalFats + (entry.fats || 0)
    }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFats: 0 });
  }

  private mapToFoodEntry(data: any): FoodEntry {
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
      foodId: data.foodId ?? null,
      portion: data.portion ?? 1,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }
}
