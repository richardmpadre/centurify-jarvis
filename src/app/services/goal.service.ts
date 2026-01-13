import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { Goal, GoalType, GoalStatus, Milestone } from '../models/goal.models';

const client = generateClient<Schema>();

@Injectable({
  providedIn: 'root'
})
export class GoalService {
  constructor() {}

  /**
   * Get all goals
   */
  async getAllGoals(): Promise<Goal[]> {
    try {
      const { data: records } = await client.models.Goal.list();
      
      return records.map(record => this.mapRecordToGoal(record))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    } catch (error) {
      console.error('Error fetching goals:', error);
      return [];
    }
  }

  /**
   * Get goals by parent ID
   */
  async getGoalsByParent(parentId: string | null): Promise<Goal[]> {
    try {
      const { data: records } = await client.models.Goal.list({
        filter: parentId 
          ? { parentGoalId: { eq: parentId } }
          : { parentGoalId: { attributeExists: false } }
      });
      
      return records.map(record => this.mapRecordToGoal(record))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    } catch (error) {
      console.error('Error fetching goals by parent:', error);
      return [];
    }
  }

  /**
   * Get a single goal by ID
   */
  async getGoal(id: string): Promise<Goal | null> {
    try {
      const { data: record } = await client.models.Goal.get({ id });
      if (!record) return null;
      return this.mapRecordToGoal(record);
    } catch (error) {
      console.error('Error fetching goal:', error);
      return null;
    }
  }

  /**
   * Build complete goal tree
   */
  async getGoalTree(): Promise<Goal | null> {
    try {
      const allGoals = await this.getAllGoals();
      
      // Find life purpose (root)
      const lifePurpose = allGoals.find(g => g.goalType === 'life_purpose');
      if (!lifePurpose) return null;
      
      // Build tree recursively
      return this.buildTree(lifePurpose, allGoals);
    } catch (error) {
      console.error('Error building goal tree:', error);
      return null;
    }
  }

  /**
   * Get goals as flat list with children populated
   */
  async getGoalsWithChildren(): Promise<Goal[]> {
    const allGoals = await this.getAllGoals();
    const goalMap = new Map<string, Goal>();
    
    // First pass: add all goals to map
    allGoals.forEach(goal => {
      goal.children = [];
      goalMap.set(goal.id, goal);
    });
    
    // Second pass: populate children arrays
    allGoals.forEach(goal => {
      if (goal.parentGoalId) {
        const parent = goalMap.get(goal.parentGoalId);
        if (parent && parent.children) {
          parent.children.push(goal);
        }
      }
    });
    
    // Sort children by sortOrder
    goalMap.forEach(goal => {
      if (goal.children) {
        goal.children.sort((a, b) => a.sortOrder - b.sortOrder);
      }
    });
    
    return allGoals;
  }

  private buildTree(goal: Goal, allGoals: Goal[]): Goal {
    const children = allGoals
      .filter(g => g.parentGoalId === goal.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(child => this.buildTree(child, allGoals));
    
    return { ...goal, children };
  }

  /**
   * Create a new goal
   */
  async createGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'children'>): Promise<Goal | null> {
    try {
      // Get the highest sortOrder for siblings
      const siblings = await this.getGoalsByParent(goal.parentGoalId || null);
      const maxOrder = siblings.length > 0 
        ? Math.max(...siblings.map(s => s.sortOrder)) 
        : -1;
      
      const { data: record, errors } = await client.models.Goal.create({
        title: goal.title,
        description: goal.description || undefined,
        goalType: goal.goalType,
        parentGoalId: goal.parentGoalId || undefined,
        status: goal.status || 'not_started',
        progress: goal.progress || 0,
        startDate: goal.startDate || undefined,
        targetDate: goal.targetDate || undefined,
        completedDate: goal.completedDate || undefined,
        sortOrder: goal.sortOrder ?? (maxOrder + 1),
        milestones: goal.milestones ? JSON.stringify(goal.milestones) : undefined,
        notes: goal.notes || undefined
      });
      
      if (errors) {
        console.error('Error creating goal:', errors);
        return null;
      }
      
      return this.mapRecordToGoal(record);
    } catch (error) {
      console.error('Error creating goal:', error);
      return null;
    }
  }

  /**
   * Update an existing goal
   */
  async updateGoal(id: string, updates: Partial<Omit<Goal, 'id' | 'children'>>): Promise<Goal | null> {
    try {
      const updateData: any = { id };
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description || null;
      if (updates.goalType !== undefined) updateData.goalType = updates.goalType;
      if (updates.parentGoalId !== undefined) updateData.parentGoalId = updates.parentGoalId || null;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.progress !== undefined) updateData.progress = updates.progress;
      if (updates.startDate !== undefined) updateData.startDate = updates.startDate || null;
      if (updates.targetDate !== undefined) updateData.targetDate = updates.targetDate || null;
      if (updates.completedDate !== undefined) updateData.completedDate = updates.completedDate || null;
      if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
      if (updates.milestones !== undefined) updateData.milestones = updates.milestones ? JSON.stringify(updates.milestones) : null;
      if (updates.notes !== undefined) updateData.notes = updates.notes || null;
      
      const { data: record, errors } = await client.models.Goal.update(updateData);
      
      if (errors) {
        console.error('Error updating goal:', errors);
        return null;
      }
      
      return this.mapRecordToGoal(record);
    } catch (error) {
      console.error('Error updating goal:', error);
      return null;
    }
  }

  /**
   * Delete a goal (optionally cascade to children)
   */
  async deleteGoal(id: string, cascade: boolean = false): Promise<boolean> {
    try {
      if (cascade) {
        // Delete all children first
        const children = await this.getGoalsByParent(id);
        for (const child of children) {
          await this.deleteGoal(child.id, true);
        }
      }
      
      const { errors } = await client.models.Goal.delete({ id });
      
      if (errors) {
        console.error('Error deleting goal:', errors);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting goal:', error);
      return false;
    }
  }

  /**
   * Reorder goals within a parent
   */
  async reorderGoals(parentId: string | null, goalIds: string[]): Promise<boolean> {
    try {
      for (let i = 0; i < goalIds.length; i++) {
        await this.updateGoal(goalIds[i], { sortOrder: i });
      }
      return true;
    } catch (error) {
      console.error('Error reordering goals:', error);
      return false;
    }
  }

  /**
   * Update goal progress
   */
  async updateProgress(id: string, progress: number): Promise<Goal | null> {
    const updates: Partial<Goal> = { progress };
    
    // Auto-update status based on progress
    if (progress === 0) {
      updates.status = 'not_started';
    } else if (progress === 100) {
      updates.status = 'completed';
      updates.completedDate = new Date().toISOString().split('T')[0];
    } else if (progress > 0) {
      updates.status = 'in_progress';
    }
    
    return this.updateGoal(id, updates);
  }

  /**
   * Toggle milestone completion
   */
  async toggleMilestone(goalId: string, milestoneId: string): Promise<Goal | null> {
    const goal = await this.getGoal(goalId);
    if (!goal || !goal.milestones) return null;
    
    const milestones = goal.milestones.map(m => {
      if (m.id === milestoneId) {
        return {
          ...m,
          completed: !m.completed,
          completedDate: !m.completed ? new Date().toISOString().split('T')[0] : undefined
        };
      }
      return m;
    });
    
    // Calculate progress based on milestones
    const completedCount = milestones.filter(m => m.completed).length;
    const progress = Math.round((completedCount / milestones.length) * 100);
    
    return this.updateGoal(goalId, { milestones, progress });
  }

  /**
   * Check if life purpose exists
   */
  async hasLifePurpose(): Promise<boolean> {
    const goals = await this.getAllGoals();
    return goals.some(g => g.goalType === 'life_purpose');
  }

  /**
   * Get active goals for dashboard (monthly and ad-hoc in progress)
   */
  async getActiveGoals(): Promise<Goal[]> {
    const allGoals = await this.getAllGoals();
    return allGoals.filter(g => 
      (g.goalType === 'monthly' || g.goalType === 'ad_hoc' || g.goalType === 'quarterly') &&
      (g.status === 'in_progress' || g.status === 'not_started')
    );
  }

  private mapRecordToGoal(record: any): Goal {
    let milestones: Milestone[] | undefined;
    if (record.milestones) {
      try {
        milestones = JSON.parse(record.milestones);
      } catch {
        milestones = undefined;
      }
    }
    
    return {
      id: record.id,
      title: record.title,
      description: record.description ?? undefined,
      goalType: record.goalType as GoalType,
      parentGoalId: record.parentGoalId ?? undefined,
      status: (record.status as GoalStatus) || 'not_started',
      progress: record.progress ?? 0,
      startDate: record.startDate ?? undefined,
      targetDate: record.targetDate ?? undefined,
      completedDate: record.completedDate ?? undefined,
      sortOrder: record.sortOrder ?? 0,
      milestones,
      notes: record.notes ?? undefined,
      createdAt: record.createdAt ?? undefined,
      updatedAt: record.updatedAt ?? undefined
    };
  }
}
