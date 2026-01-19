import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

@Injectable({
  providedIn: 'root'
})
export class HealthDataService {
  private client = generateClient<Schema>();

  async saveEntry(entry: {
    date: string;
    bp?: string;
    temp?: number;
    strain?: number;
    rhr?: number;
    sleep?: number;
    recovery?: number;
    weight?: number;
    workoutCount?: number;
    workoutCalories?: number;
    workoutMinutes?: number;
    trainingNotes?: string;
    plannedWorkout?: string;
    workoutCompleted?: boolean;
    morningChecklist?: string;
    totalCalories?: number;
    totalProtein?: number;
    totalCarbs?: number;
    totalFats?: number;
    nutritionTrackingFailed?: boolean;
    actionOrder?: string;
    dailyInsights?: string;
    insightsGeneratedAt?: string;
  }) {
    // Check if entry already exists for this date
    const existingEntry = await this.getEntryByDate(entry.date);
    
    if (existingEntry?.id) {
      // Entry exists, update it instead
      return this.updateEntry({ id: existingEntry.id, ...entry });
    }
    
    // No existing entry, create new one
    const { data, errors } = await this.client.models.HealthEntry.create(entry as any);

    if (errors) {
      throw new Error(errors.map(e => e.message).join(', '));
    }

    return data;
  }

  async updateEntry(entry: {
    id: string;
    date: string;
    bp?: string;
    temp?: number;
    strain?: number;
    rhr?: number;
    sleep?: number;
    recovery?: number;
    weight?: number;
    workoutCount?: number;
    workoutCalories?: number;
    workoutMinutes?: number;
    trainingNotes?: string;
    plannedWorkout?: string;
    workoutCompleted?: boolean;
    morningChecklist?: string;
    totalCalories?: number;
    totalProtein?: number;
    totalCarbs?: number;
    totalFats?: number;
    nutritionTrackingFailed?: boolean;
    actionOrder?: string;
    dailyInsights?: string;
    insightsGeneratedAt?: string;
  }) {
    const { data, errors } = await this.client.models.HealthEntry.update(entry as any);

    if (errors) {
      throw new Error(errors.map(e => e.message).join(', '));
    }

    return data;
  }

  async getAllEntries() {
    const { data, errors } = await this.client.models.HealthEntry.list();

    if (errors) {
      throw new Error(errors.map(e => e.message).join(', '));
    }

    return data;
  }

  async getEntryByDate(date: string) {
    const { data } = await this.client.models.HealthEntry.list({
      filter: { date: { eq: date } }
    });

    return data?.[0];
  }

  async deleteEntry(id: string) {
    const { errors } = await this.client.models.HealthEntry.delete({ id });

    if (errors) {
      throw new Error(errors.map(e => e.message).join(', '));
    }
  }

  // Clean up duplicate entries - keep only the most recent one per date
  async removeDuplicateEntries() {
    const allEntries = await this.getAllEntries();
    if (!allEntries) return { removed: 0, kept: 0 };
    
    // Group by date
    const entriesByDate = new Map<string, typeof allEntries>();
    allEntries.forEach(entry => {
      if (!entriesByDate.has(entry.date)) {
        entriesByDate.set(entry.date, []);
      }
      entriesByDate.get(entry.date)!.push(entry);
    });
    
    let removed = 0;
    let kept = 0;
    
    // For each date, keep only the most recent entry
    for (const [date, entries] of entriesByDate.entries()) {
      if (entries.length > 1) {
        // Sort by createdAt or updatedAt (most recent first)
        const sorted = entries.sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        
        // Keep the first (most recent), delete the rest
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].id) {
            await this.deleteEntry(sorted[i].id);
            removed++;
          }
        }
        kept++;
      } else {
        kept++;
      }
    }
    
    return { removed, kept };
  }
}

