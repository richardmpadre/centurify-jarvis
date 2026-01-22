import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { RecurringGoalCompletion } from '../models/goal.models';

const client = generateClient<Schema>();

@Injectable({
  providedIn: 'root'
})
export class RecurringGoalService {
  constructor() {}

  /**
   * Get completion status for a goal on a specific date
   */
  async getCompletionForDate(goalId: string, date: string): Promise<RecurringGoalCompletion | null> {
    try {
      const { data: records } = await client.models.RecurringGoalCompletion.list({
        filter: {
          goalId: { eq: goalId },
          date: { eq: date }
        }
      });
      
      if (records.length === 0) return null;
      return this.mapRecordToCompletion(records[0]);
    } catch (error) {
      console.error('Error fetching completion:', error);
      return null;
    }
  }

  /**
   * Get all completions for a specific date (across all goals)
   */
  async getCompletionsForDate(date: string): Promise<RecurringGoalCompletion[]> {
    try {
      const { data: records } = await client.models.RecurringGoalCompletion.list({
        filter: {
          date: { eq: date }
        }
      });
      
      return records.map(record => this.mapRecordToCompletion(record));
    } catch (error) {
      console.error('Error fetching completions for date:', error);
      return [];
    }
  }

  /**
   * Get all completions for a goal (history)
   */
  async getCompletionsForGoal(goalId: string): Promise<RecurringGoalCompletion[]> {
    try {
      const { data: records } = await client.models.RecurringGoalCompletion.list({
        filter: {
          goalId: { eq: goalId }
        }
      });
      
      return records
        .map(record => this.mapRecordToCompletion(record))
        .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
    } catch (error) {
      console.error('Error fetching completions for goal:', error);
      return [];
    }
  }

  /**
   * Mark a recurring goal as complete for a date
   */
  async markComplete(goalId: string, date: string, notes?: string): Promise<RecurringGoalCompletion | null> {
    try {
      // Check if completion already exists
      const existing = await this.getCompletionForDate(goalId, date);
      
      if (existing) {
        // Update existing completion
        return this.updateCompletion(existing.id, { completed: true, notes });
      }
      
      // Create new completion
      const { data: record, errors } = await client.models.RecurringGoalCompletion.create({
        goalId,
        date,
        completed: true,
        notes: notes || undefined
      });
      
      if (errors) {
        console.error('Error creating completion:', errors);
        return null;
      }
      
      return this.mapRecordToCompletion(record);
    } catch (error) {
      console.error('Error marking complete:', error);
      return null;
    }
  }

  /**
   * Mark a recurring goal as incomplete for a date
   */
  async markIncomplete(goalId: string, date: string): Promise<RecurringGoalCompletion | null> {
    try {
      const existing = await this.getCompletionForDate(goalId, date);
      
      if (existing) {
        return this.updateCompletion(existing.id, { completed: false });
      }
      
      // Create as incomplete (tracking that day was explicitly not completed)
      const { data: record, errors } = await client.models.RecurringGoalCompletion.create({
        goalId,
        date,
        completed: false
      });
      
      if (errors) {
        console.error('Error creating completion:', errors);
        return null;
      }
      
      return this.mapRecordToCompletion(record);
    } catch (error) {
      console.error('Error marking incomplete:', error);
      return null;
    }
  }

  /**
   * Update an existing completion record
   */
  async updateCompletion(
    id: string, 
    updates: Partial<Pick<RecurringGoalCompletion, 'completed' | 'notes'>>
  ): Promise<RecurringGoalCompletion | null> {
    try {
      const updateData: any = { id };
      
      if (updates.completed !== undefined) updateData.completed = updates.completed;
      if (updates.notes !== undefined) updateData.notes = updates.notes || null;
      
      const { data: record, errors } = await client.models.RecurringGoalCompletion.update(updateData);
      
      if (errors) {
        console.error('Error updating completion:', errors);
        return null;
      }
      
      return this.mapRecordToCompletion(record);
    } catch (error) {
      console.error('Error updating completion:', error);
      return null;
    }
  }

  /**
   * Delete a completion record
   */
  async deleteCompletion(id: string): Promise<boolean> {
    try {
      const { errors } = await client.models.RecurringGoalCompletion.delete({ id });
      
      if (errors) {
        console.error('Error deleting completion:', errors);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting completion:', error);
      return false;
    }
  }

  /**
   * Check if a goal is complete for a specific date
   */
  async isCompleteForDate(goalId: string, date: string): Promise<boolean> {
    const completion = await this.getCompletionForDate(goalId, date);
    return completion?.completed === true;
  }

  private mapRecordToCompletion(record: any): RecurringGoalCompletion {
    return {
      id: record.id,
      goalId: record.goalId,
      date: record.date,
      completed: record.completed ?? false,
      notes: record.notes ?? undefined,
      createdAt: record.createdAt ?? undefined,
      updatedAt: record.updatedAt ?? undefined
    };
  }
}
