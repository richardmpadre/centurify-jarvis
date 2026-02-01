import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { TrainingSession, TrainingType, CompletedExercise } from '../models/health.models';
import { WhoopService } from './whoop.service';

@Injectable({
  providedIn: 'root'
})
export class TrainingSessionService {
  private client = generateClient<Schema>();

  constructor(private whoopService: WhoopService) {}

  // Get all training sessions
  async getAllSessions(): Promise<TrainingSession[]> {
    try {
      const response = await this.client.models.TrainingSession.list();
      return (response.data || []).map(s => this.mapToTrainingSession(s));
    } catch (error) {
      console.error('Error fetching training sessions:', error);
      return [];
    }
  }

  // Get sessions by date range
  async getSessionsByDateRange(startDate: string, endDate: string): Promise<TrainingSession[]> {
    try {
      const response = await this.client.models.TrainingSession.list({
        filter: {
          and: [
            { date: { ge: startDate } },
            { date: { le: endDate } }
          ]
        }
      });
      return (response.data || []).map(s => this.mapToTrainingSession(s));
    } catch (error) {
      console.error('Error fetching sessions by date range:', error);
      return [];
    }
  }

  // Get sessions by type
  async getSessionsByType(type: TrainingType): Promise<TrainingSession[]> {
    try {
      const response = await this.client.models.TrainingSession.list({
        filter: { type: { eq: type } }
      });
      return (response.data || []).map(s => this.mapToTrainingSession(s));
    } catch (error) {
      console.error('Error fetching sessions by type:', error);
      return [];
    }
  }

  // Get a single session by ID
  async getSessionById(id: string): Promise<TrainingSession | null> {
    try {
      const response = await this.client.models.TrainingSession.get({ id });
      if (response.data) {
        return this.mapToTrainingSession(response.data);
      }
      return null;
    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  }

  // Create a new training session (manual entry)
  async createSession(session: Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<TrainingSession | null> {
    try {
      const response = await this.client.models.TrainingSession.create({
        date: session.date,
        startTime: session.startTime || null,
        type: session.type,
        name: session.name || null,
        duration: session.duration || null,
        calories: session.calories || null,
        strain: session.strain || null,
        avgHR: session.avgHR || null,
        maxHR: session.maxHR || null,
        distance: session.distance || null,
        exercises: session.exercises ? JSON.stringify(session.exercises) : null,
        notes: session.notes || null,
        source: session.source,
        whoopWorkoutId: session.whoopWorkoutId || null,
      });

      if (response.data) {
        return this.mapToTrainingSession(response.data);
      }
      return null;
    } catch (error) {
      console.error('Error creating training session:', error);
      return null;
    }
  }

  // Update an existing training session
  async updateSession(id: string, updates: Partial<Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TrainingSession | null> {
    try {
      const updateData: any = { id };
      
      if (updates.date !== undefined) updateData.date = updates.date;
      if (updates.startTime !== undefined) updateData.startTime = updates.startTime;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.duration !== undefined) updateData.duration = updates.duration;
      if (updates.calories !== undefined) updateData.calories = updates.calories;
      if (updates.strain !== undefined) updateData.strain = updates.strain;
      if (updates.avgHR !== undefined) updateData.avgHR = updates.avgHR;
      if (updates.maxHR !== undefined) updateData.maxHR = updates.maxHR;
      if (updates.distance !== undefined) updateData.distance = updates.distance;
      if (updates.exercises !== undefined) updateData.exercises = JSON.stringify(updates.exercises);
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.source !== undefined) updateData.source = updates.source;
      if (updates.whoopWorkoutId !== undefined) updateData.whoopWorkoutId = updates.whoopWorkoutId;

      const response = await this.client.models.TrainingSession.update(updateData);
      
      if (response.data) {
        return this.mapToTrainingSession(response.data);
      }
      return null;
    } catch (error) {
      console.error('Error updating training session:', error);
      return null;
    }
  }

  // Delete a training session
  async deleteSession(id: string): Promise<boolean> {
    try {
      await this.client.models.TrainingSession.delete({ id });
      return true;
    } catch (error) {
      console.error('Error deleting training session:', error);
      return false;
    }
  }

  // Sync workouts from Whoop for a date range
  async syncWhoopWorkouts(startDate: string, endDate: string): Promise<{ synced: number; skipped: number }> {
    if (!this.whoopService.isConnected()) {
      throw new Error('Whoop not connected');
    }

    let synced = 0;
    let skipped = 0;

    try {
      const whoopData = await this.whoopService.getWorkouts(startDate, endDate);
      const workouts = whoopData.records || [];

      // Get existing sessions to check for duplicates
      const existingSessions = await this.getSessionsByDateRange(startDate, endDate);
      const existingWhoopIds = new Set(
        existingSessions
          .filter(s => s.whoopWorkoutId)
          .map(s => s.whoopWorkoutId)
      );

      for (const workout of workouts) {
        const whoopId = workout.id?.toString();
        
        // Skip if already synced
        if (whoopId && existingWhoopIds.has(whoopId)) {
          skipped++;
          continue;
        }

        const session = this.mapWhoopToSession(workout);
        const created = await this.createSession(session);
        
        if (created) {
          synced++;
        }
      }

      return { synced, skipped };
    } catch (error) {
      console.error('Error syncing Whoop workouts:', error);
      throw error;
    }
  }

  // Map Whoop workout to TrainingSession
  private mapWhoopToSession(whoopWorkout: any): Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt'> {
    const startTime = whoopWorkout.start;
    const date = startTime ? startTime.split('T')[0] : new Date().toISOString().split('T')[0];
    
    // Map Whoop sport_id to our training types
    const type = this.mapWhoopSportToType(whoopWorkout.sport_id, whoopWorkout.score?.sport_name);
    
    // Duration in minutes (Whoop returns milliseconds)
    const durationMs = whoopWorkout.score?.end_time && whoopWorkout.start
      ? new Date(whoopWorkout.score.end_time).getTime() - new Date(whoopWorkout.start).getTime()
      : 0;
    const duration = Math.round(durationMs / 60000);

    return {
      date,
      startTime: startTime || null,
      type,
      name: whoopWorkout.score?.sport_name || 'Workout',
      duration: duration > 0 ? duration : null,
      calories: whoopWorkout.score?.kilojoule ? Math.round(whoopWorkout.score.kilojoule * 0.239) : null,
      strain: whoopWorkout.score?.strain || null,
      avgHR: whoopWorkout.score?.average_heart_rate ? Math.round(whoopWorkout.score.average_heart_rate) : null,
      maxHR: whoopWorkout.score?.max_heart_rate ? Math.round(whoopWorkout.score.max_heart_rate) : null,
      distance: whoopWorkout.score?.distance_meter ? whoopWorkout.score.distance_meter / 1609.34 : null,
      exercises: undefined,
      notes: null,
      source: 'whoop',
      whoopWorkoutId: whoopWorkout.id?.toString() || null,
    };
  }

  // Map Whoop sport to our training type
  private mapWhoopSportToType(sportId: number, sportName?: string): TrainingType {
    // Common Whoop sport IDs
    const sportName_lower = (sportName || '').toLowerCase();
    
    if (sportName_lower.includes('run') || sportName_lower.includes('cycling') || 
        sportName_lower.includes('swim') || sportName_lower.includes('rowing') ||
        sportName_lower.includes('elliptical') || sportName_lower.includes('walk')) {
      return 'cardio';
    }
    
    if (sportName_lower.includes('weight') || sportName_lower.includes('strength') ||
        sportName_lower.includes('functional') || sportName_lower.includes('crossfit')) {
      return 'strength';
    }
    
    if (sportName_lower.includes('yoga') || sportName_lower.includes('stretch') ||
        sportName_lower.includes('pilates')) {
      return 'flexibility';
    }
    
    if (sportName_lower.includes('hiit') || sportName_lower.includes('interval')) {
      return 'hiit';
    }
    
    if (sportName_lower.includes('sauna') || sportName_lower.includes('steam') ||
        sportName_lower.includes('hot tub')) {
      return 'sauna';
    }
    
    if (sportName_lower.includes('basketball') || sportName_lower.includes('soccer') ||
        sportName_lower.includes('tennis') || sportName_lower.includes('golf') ||
        sportName_lower.includes('baseball') || sportName_lower.includes('football')) {
      return 'sports';
    }
    
    return 'other';
  }

  // Map database response to TrainingSession interface
  private mapToTrainingSession(data: any): TrainingSession {
    let exercises: CompletedExercise[] | undefined;
    if (data.exercises) {
      try {
        exercises = JSON.parse(data.exercises);
      } catch {
        exercises = undefined;
      }
    }

    return {
      id: data.id,
      date: data.date,
      startTime: data.startTime || null,
      type: data.type as TrainingType,
      name: data.name || null,
      duration: data.duration || null,
      calories: data.calories || null,
      strain: data.strain || null,
      avgHR: data.avgHR || null,
      maxHR: data.maxHR || null,
      distance: data.distance || null,
      exercises,
      notes: data.notes || null,
      source: data.source as 'whoop' | 'manual',
      whoopWorkoutId: data.whoopWorkoutId || null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  // Get training type display info
  getTypeInfo(type: TrainingType): { label: string; icon: string; color: string } {
    const typeMap: Record<TrainingType, { label: string; icon: string; color: string }> = {
      strength: { label: 'Strength', icon: '💪', color: '#ef4444' },
      cardio: { label: 'Cardio', icon: '🏃', color: '#3b82f6' },
      flexibility: { label: 'Flexibility', icon: '🧘', color: '#8b5cf6' },
      sports: { label: 'Sports', icon: '⚽', color: '#22c55e' },
      hiit: { label: 'HIIT', icon: '🔥', color: '#f59e0b' },
      sauna: { label: 'Sauna', icon: '🧖', color: '#f97316' },
      contrast_therapy: { label: 'Contrast Therapy', icon: '🧊', color: '#06b6d4' },
      other: { label: 'Other', icon: '📝', color: '#6b7280' },
    };
    return typeMap[type] || typeMap.other;
  }
}
