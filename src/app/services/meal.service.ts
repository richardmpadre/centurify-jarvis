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
  defaultPortion: number | null;
  defaultPortionUnit: string | null;
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
        defaultPortion: m.defaultPortion ?? null,
        defaultPortionUnit: m.defaultPortionUnit ?? null,
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
      console.log('MealService: Creating meal with data:', meal);
      
      const response = await this.client.models.Meal.create({
        name: meal.name,
        calories: Math.round(meal.calories), // Must be integer
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats,
        defaultPortion: meal.defaultPortion,
        defaultPortionUnit: meal.defaultPortionUnit
      });
      
      console.log('MealService: Create response:', response);
      
      // Check for errors in response
      if (response.errors && response.errors.length > 0) {
        console.error('MealService: API returned errors:', response.errors);
        response.errors.forEach((error: any, index: number) => {
          console.error(`Error ${index + 1}:`, {
            message: error.message,
            errorType: error.errorType,
            errorInfo: error.errorInfo,
            path: error.path,
            locations: error.locations
          });
        });
      }
      
      if (response.data) {
        const createdMeal = {
          id: response.data.id,
          name: response.data.name,
          calories: response.data.calories,
          protein: response.data.protein ?? null,
          carbs: response.data.carbs ?? null,
          fats: response.data.fats ?? null,
          defaultPortion: response.data.defaultPortion ?? null,
          defaultPortionUnit: response.data.defaultPortionUnit ?? null,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt
        };
        console.log('MealService: Returning created meal:', createdMeal);
        return createdMeal;
      }
      
      console.log('MealService: No data in response');
      return null;
    } catch (error) {
      console.error('MealService: Error creating meal:', error);
      return null;
    }
  }

  async updateMeal(id: string, meal: Partial<Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Meal | null> {
    try {
      const updateData = { ...meal };
      if (updateData.calories !== undefined) {
        updateData.calories = Math.round(updateData.calories); // Must be integer
      }
      
      const response = await this.client.models.Meal.update({
        id,
        ...updateData
      });
      
      if (response.data) {
        return {
          id: response.data.id,
          name: response.data.name,
          calories: response.data.calories,
          protein: response.data.protein ?? null,
          carbs: response.data.carbs ?? null,
          fats: response.data.fats ?? null,
          defaultPortion: response.data.defaultPortion ?? null,
          defaultPortionUnit: response.data.defaultPortionUnit ?? null,
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
