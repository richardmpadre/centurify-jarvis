import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

export interface Food {
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
export class FoodService {
  private client = generateClient<Schema>();

  async getAllFoods(): Promise<Food[]> {
    try {
      const response = await this.client.models.Food.list();
      return (response.data || []).map(f => ({
        id: f.id,
        name: f.name,
        calories: f.calories,
        protein: f.protein ?? null,
        carbs: f.carbs ?? null,
        fats: f.fats ?? null,
        defaultPortion: f.defaultPortion ?? null,
        defaultPortionUnit: f.defaultPortionUnit ?? null,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt
      }));
    } catch (error) {
      console.error('Error fetching foods:', error);
      return [];
    }
  }

  async createFood(food: Omit<Food, 'id' | 'createdAt' | 'updatedAt'>): Promise<Food | null> {
    try {
      console.log('FoodService: Creating food with data:', food);
      
      const response = await this.client.models.Food.create({
        name: food.name,
        calories: Math.round(food.calories), // Must be integer
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
        defaultPortion: food.defaultPortion,
        defaultPortionUnit: food.defaultPortionUnit
      });
      
      console.log('FoodService: Create response:', response);
      
      // Check for errors in response
      if (response.errors && response.errors.length > 0) {
        console.error('FoodService: API returned errors:', response.errors);
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
        const createdFood = {
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
        console.log('FoodService: Returning created food:', createdFood);
        return createdFood;
      }
      
      console.log('FoodService: No data in response');
      return null;
    } catch (error) {
      console.error('FoodService: Error creating food:', error);
      return null;
    }
  }

  async updateFood(id: string, food: Partial<Omit<Food, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Food | null> {
    try {
      const updateData = { ...food };
      if (updateData.calories !== undefined) {
        updateData.calories = Math.round(updateData.calories); // Must be integer
      }
      
      const response = await this.client.models.Food.update({
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
      console.error('Error updating food:', error);
      return null;
    }
  }

  async deleteFood(id: string): Promise<boolean> {
    try {
      await this.client.models.Food.delete({ id });
      return true;
    } catch (error) {
      console.error('Error deleting food:', error);
      return false;
    }
  }
}
