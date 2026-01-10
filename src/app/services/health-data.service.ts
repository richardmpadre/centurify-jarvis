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
    dailyScore?: number;
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
    actionOrder?: string;
  }) {
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
    dailyScore?: number;
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
    actionOrder?: string;
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
}

