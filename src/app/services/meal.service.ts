import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

export interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MealService {
  private client = generateClient<Schema>();

  async getAllMeals(): Promise<Meal[]> {
    try {
      const response = await this.client.models.Meal.list();
      return (response.data || []).map(m => ({
        id: m.id,
        name: m.name,
        calories: m.calories,
        protein: m.protein ?? null,
        carbs: m.carbs ?? null,
        fats: m.fats ?? null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      }));
    } catch (error) {
      console.error('Error fetching meals:', error);
      return [];
    }
  }

  async createMeal(meal: Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Meal | null> {
    try {
      const response = await this.client.models.Meal.create({
        name: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats
      });
      
      if (response.data) {
        return {
          id: response.data.id,
          name: response.data.name,
          calories: response.data.calories,
          protein: response.data.protein ?? null,
          carbs: response.data.carbs ?? null,
          fats: response.data.fats ?? null,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt
        };
      }
      return null;
    } catch (error) {
      console.error('Error creating meal:', error);
      return null;
    }
  }

  async updateMeal(id: string, meal: Partial<Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Meal | null> {
    try {
      const response = await this.client.models.Meal.update({
        id,
        ...meal
      });
      
      if (response.data) {
        return {
          id: response.data.id,
          name: response.data.name,
          calories: response.data.calories,
          protein: response.data.protein ?? null,
          carbs: response.data.carbs ?? null,
          fats: response.data.fats ?? null,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt
        };
      }
      return null;
    } catch (error) {
      console.error('Error updating meal:', error);
      return null;
    }
  }

  async deleteMeal(id: string): Promise<boolean> {
    try {
      await this.client.models.Meal.delete({ id });
      return true;
    } catch (error) {
      console.error('Error deleting meal:', error);
      return false;
    }
  }
}
