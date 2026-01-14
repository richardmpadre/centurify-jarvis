import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

export interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  weight?: number;
  notes?: string;
}

export interface Workout {
  id: string;
  name: string;
  description: string | null;
  duration: number | null;
  exercises: Exercise[];
  category: string | null;
  difficulty: string | null;
  estimatedCalories: number | null;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkoutService {
  private client = generateClient<Schema>();

  async getAllWorkouts(): Promise<Workout[]> {
    try {
      const response = await this.client.models.Workout.list();
      return (response.data || []).map(w => ({
        id: w.id,
        name: w.name,
        description: w.description ?? null,
        duration: w.duration ?? null,
        exercises: w.exercises ? JSON.parse(w.exercises) : [],
        category: w.category ?? null,
        difficulty: w.difficulty ?? null,
        estimatedCalories: w.estimatedCalories ?? null,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt
      }));
    } catch (error) {
      console.error('Error fetching workouts:', error);
      return [];
    }
  }

  async createWorkout(workout: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workout | null> {
    try {
      console.log('WorkoutService: Creating workout with data:', workout);
      
      const response = await this.client.models.Workout.create({
        name: workout.name,
        description: workout.description,
        duration: workout.duration,
        exercises: JSON.stringify(workout.exercises),
        category: workout.category,
        difficulty: workout.difficulty,
        estimatedCalories: workout.estimatedCalories
      });
      
      console.log('WorkoutService: Create response:', response);
      
      if (response.errors && response.errors.length > 0) {
        console.error('WorkoutService: API returned errors:', response.errors);
      }
      
      if (response.data) {
        const createdWorkout = {
          id: response.data.id,
          name: response.data.name,
          description: response.data.description ?? null,
          duration: response.data.duration ?? null,
          exercises: response.data.exercises ? JSON.parse(response.data.exercises) : [],
          category: response.data.category ?? null,
          difficulty: response.data.difficulty ?? null,
          estimatedCalories: response.data.estimatedCalories ?? null,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt
        };
        console.log('WorkoutService: Returning created workout:', createdWorkout);
        return createdWorkout;
      }
      
      console.log('WorkoutService: No data in response');
      return null;
    } catch (error) {
      console.error('WorkoutService: Error creating workout:', error);
      return null;
    }
  }

  async updateWorkout(id: string, workout: Partial<Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Workout | null> {
    try {
      const updateData: any = {
        id,
        ...workout
      };
      
      if (workout.exercises) {
        updateData.exercises = JSON.stringify(workout.exercises);
      }
      
      const response = await this.client.models.Workout.update(updateData);
      
      if (response.data) {
        return {
          id: response.data.id,
          name: response.data.name,
          description: response.data.description ?? null,
          duration: response.data.duration ?? null,
          exercises: response.data.exercises ? JSON.parse(response.data.exercises) : [],
          category: response.data.category ?? null,
          difficulty: response.data.difficulty ?? null,
          estimatedCalories: response.data.estimatedCalories ?? null,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt
        };
      }
      return null;
    } catch (error) {
      console.error('Error updating workout:', error);
      return null;
    }
  }

  async deleteWorkout(id: string): Promise<boolean> {
    try {
      await this.client.models.Workout.delete({ id });
      return true;
    } catch (error) {
      console.error('Error deleting workout:', error);
      return false;
    }
  }
}
