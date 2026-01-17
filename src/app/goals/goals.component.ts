import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalService } from '../services/goal.service';
import { Goal, GoalType, GOAL_TYPE_CONFIG } from '../models/goal.models';
import { GoalTreeNodeComponent } from './components/goal-tree-node/goal-tree-node.component';
import { GoalModalComponent } from './components/goal-modal/goal-modal.component';

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [CommonModule, GoalTreeNodeComponent, GoalModalComponent],
  templateUrl: './goals.component.html',
  styleUrl: './goals.component.css'
})
export class GoalsComponent implements OnInit {
  goals: Goal[] = [];
  goalTree: Goal | null = null;
  isLoading = true;
  error: string | null = null;
  
  // Modal state
  showModal = false;
  editingGoal: Goal | null = null;
  parentGoalForNew: Goal | null = null;
  
  // Expanded state
  expandedGoals = new Set<string>();
  
  // Life goal selection
  selectedLifeGoalId: string | null = null;
  lifeGoals: Goal[] = [];

  constructor(private goalService: GoalService) {}

  async ngOnInit(): Promise<void> {
    await this.loadGoals();
  }

  async loadGoals(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    
    try {
      this.goals = await this.goalService.getGoalsWithChildren();
      this.goalTree = await this.goalService.getGoalTree();
      
      // Extract life goals
      this.lifeGoals = this.goals.filter(g => g.goalType === 'life_goal');
      
      // Auto-select first life goal if none selected
      if (this.lifeGoals.length > 0 && !this.selectedLifeGoalId) {
        this.selectedLifeGoalId = this.lifeGoals[0].id;
      }
      
      // Auto-expand life purpose, selected life goal, and all yearly goals
      if (this.goalTree) {
        this.expandedGoals.add(this.goalTree.id);
        if (this.selectedLifeGoalId) {
          this.expandedGoals.add(this.selectedLifeGoalId);
        }
      }
      
      // Always expand all yearly goals
      this.goals.filter(g => g.goalType === 'yearly').forEach(g => {
        this.expandedGoals.add(g.id);
      });
    } catch (err: any) {
      console.error('Error loading goals:', err);
      this.error = err.message || 'Failed to load goals';
    } finally {
      this.isLoading = false;
    }
  }

  hasLifePurpose(): boolean {
    return this.goals.some(g => g.goalType === 'life_purpose');
  }

  getRootGoals(): Goal[] {
    return this.goals.filter(g => g.goalType === 'life_purpose');
  }

  // Modal actions
  openAddLifePurpose(): void {
    this.editingGoal = null;
    this.parentGoalForNew = null;
    this.showModal = true;
  }

  onAddLifeGoal(): void {
    this.editingGoal = null;
    this.parentGoalForNew = this.goalTree;
    this.showModal = true;
  }

  onAddChild(parent: Goal): void {
    this.editingGoal = null;
    this.parentGoalForNew = parent;
    this.showModal = true;
  }

  onEditGoal(goal: Goal): void {
    this.editingGoal = goal;
    this.parentGoalForNew = null;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingGoal = null;
    this.parentGoalForNew = null;
  }

  async onSaveGoal(goalData: Partial<Goal>): Promise<void> {
    try {
      if (this.editingGoal) {
        // Update existing
        await this.goalService.updateGoal(this.editingGoal.id, goalData);
      } else {
        // Create new
        const newGoal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'children'> = {
          title: goalData.title || '',
          description: goalData.description,
          goalType: goalData.goalType || (this.parentGoalForNew ? this.getDefaultChildType(this.parentGoalForNew.goalType) : 'life_purpose'),
          parentGoalId: this.parentGoalForNew?.id || null,
          status: goalData.status || 'not_started',
          progress: goalData.progress || 0,
          startDate: goalData.startDate,
          targetDate: goalData.targetDate,
          sortOrder: 0,
          milestones: goalData.milestones,
          notes: goalData.notes,
          requiresDailyAction: goalData.requiresDailyAction
        };
        await this.goalService.createGoal(newGoal);
      }
      
      this.closeModal();
      await this.loadGoals();
    } catch (err: any) {
      console.error('Error saving goal:', err);
      this.error = err.message || 'Failed to save goal';
    }
  }

  getDefaultChildType(parentType: GoalType): GoalType {
    const config = GOAL_TYPE_CONFIG[parentType];
    return config.allowedChildren[0] || 'ad_hoc';
  }

  async onDeleteGoal(goal: Goal): Promise<void> {
    const hasChildren = this.goals.some(g => g.parentGoalId === goal.id);
    
    let confirmMessage = `Delete "${goal.title}"?`;
    if (hasChildren) {
      confirmMessage += '\n\nThis will also delete all child goals.';
    }
    
    if (confirm(confirmMessage)) {
      try {
        await this.goalService.deleteGoal(goal.id, true);
        await this.loadGoals();
      } catch (err: any) {
        console.error('Error deleting goal:', err);
        this.error = err.message || 'Failed to delete goal';
      }
    }
  }

  async onProgressUpdate(event: { goal: Goal; progress: number }): Promise<void> {
    try {
      await this.goalService.updateProgress(event.goal.id, event.progress);
      await this.loadGoals();
    } catch (err: any) {
      console.error('Error updating progress:', err);
    }
  }

  async onToggleMilestone(event: { goalId: string; milestoneId: string }): Promise<void> {
    try {
      await this.goalService.toggleMilestone(event.goalId, event.milestoneId);
      await this.loadGoals();
    } catch (err: any) {
      console.error('Error toggling milestone:', err);
    }
  }

  toggleExpand(goalId: string): void {
    if (this.expandedGoals.has(goalId)) {
      this.expandedGoals.delete(goalId);
    } else {
      this.expandedGoals.add(goalId);
    }
  }

  isExpanded(goalId: string): boolean {
    return this.expandedGoals.has(goalId);
  }

  expandAll(): void {
    this.goals.forEach(g => this.expandedGoals.add(g.id));
  }

  collapseAll(): void {
    this.expandedGoals.clear();
    // Keep life purpose expanded
    if (this.goalTree) {
      this.expandedGoals.add(this.goalTree.id);
    }
  }
  
  selectLifeGoal(goalId: string): void {
    this.selectedLifeGoalId = goalId;
    // Auto-expand selected life goal
    this.expandedGoals.add(goalId);
  }
  
  getSelectedLifeGoal(): Goal | null {
    if (!this.selectedLifeGoalId) return null;
    return this.lifeGoals.find(g => g.id === this.selectedLifeGoalId) || null;
  }
  
  getFilteredGoalTree(): Goal[] {
    if (!this.goalTree || this.lifeGoals.length === 0) return [];
    
    const selectedGoal = this.getSelectedLifeGoal();
    if (!selectedGoal) return [];
    
    // Return just the children of the selected life goal (not the life goal itself)
    return selectedGoal.children || [];
  }
}
