import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: 'pending' | 'in_progress' | 'completed';
  type: 'biometrics' | 'workout' | 'nutrition' | 'life_events' | 'jarvis' | 'custom' | 'meal' | 'insights';
  priority?: number;
  dependsOn?: string[]; // IDs of actions that must complete first
  createsEntry?: string; // Type of entry this creates when completed
  externalLink?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'; // For meal actions
  // If set, clicking on completed action reopens the panel/form instead of toggling status
  // This is used for actions whose status is auto-derived from data (e.g., biometrics, meals)
  reopenOnComplete?: boolean;
}

@Component({
  selector: 'app-action-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './action-list.component.html',
  styleUrl: './action-list.component.css'
})
export class ActionListComponent {
  @Input() actions: ActionItem[] = [];
  @Input() isLoading = false;
  @Input() collapsed = false;
  @Input() editMode = false;
  
  @Output() actionClick = new EventEmitter<ActionItem>();
  @Output() actionUncomplete = new EventEmitter<ActionItem>(); // For toggling completed actions back
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() reorder = new EventEmitter<string[]>(); // Emits new order of IDs
  @Output() toggleEditMode = new EventEmitter<void>();

  completedCollapsed = true; // Completed section collapsed by default
  draggedIndex: number | null = null;

  get completedCount(): number {
    return this.actions.filter(a => a.status === 'completed').length;
  }

  get totalCount(): number {
    return this.actions.length;
  }

  get progressPercent(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.completedCount / this.totalCount) * 100);
  }

  get isAllComplete(): boolean {
    return this.completedCount === this.totalCount && this.totalCount > 0;
  }

  get pendingActions(): ActionItem[] {
    const pending = this.actions.filter(a => a.status !== 'completed');
    if (this.editMode) {
      return pending;
    }
    // Filter out actions whose dependencies aren't met
    return pending.filter(action => {
      if (!action.dependsOn || action.dependsOn.length === 0) return true;
      return action.dependsOn.every(depId => 
        this.actions.find(a => a.id === depId)?.status === 'completed'
      );
    });
  }

  get completedActions(): ActionItem[] {
    return this.actions.filter(a => a.status === 'completed');
  }

  get visibleActions(): ActionItem[] {
    if (this.editMode) {
      // In edit mode, show all actions (including meal actions for reordering)
      return this.actions;
    }
    // Filter out actions whose dependencies aren't met
    return this.actions.filter(action => {
      if (!action.dependsOn || action.dependsOn.length === 0) return true;
      return action.dependsOn.every(depId => 
        this.actions.find(a => a.id === depId)?.status === 'completed'
      );
    });
  }

  toggleCompletedSection(): void {
    this.completedCollapsed = !this.completedCollapsed;
  }

  onActionClick(action: ActionItem): void {
    if (this.editMode) return;
    
    if (action.status === 'completed') {
      // Allow uncompleting
      this.actionUncomplete.emit(action);
    } else {
      this.actionClick.emit(action);
    }
  }

  onHeaderClick(): void {
    if (!this.editMode) {
      this.toggleCollapse.emit();
    }
  }

  onEditClick(event: Event): void {
    event.stopPropagation();
    this.toggleEditMode.emit();
  }

  onDragStart(index: number, event: DragEvent): void {
    console.log('Drag start:', index);
    this.draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(dropIndex: number, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Drop at:', dropIndex, 'Dragged from:', this.draggedIndex);
    
    if (this.draggedIndex === null || this.draggedIndex === dropIndex) {
      console.log('Invalid drop - same position or no drag');
      this.draggedIndex = null;
      return;
    }

    // Use visibleActions for reordering since that's what we're displaying in edit mode
    const visibleActionIds = this.visibleActions.map(a => a.id);
    const draggedId = visibleActionIds[this.draggedIndex];
    
    console.log('Reordering:', { visibleActionIds, draggedId, from: this.draggedIndex, to: dropIndex });
    
    // Remove from old position
    visibleActionIds.splice(this.draggedIndex, 1);
    
    // Insert at new position
    visibleActionIds.splice(dropIndex, 0, draggedId);
    
    console.log('New order:', visibleActionIds);
    
    this.draggedIndex = null;
    this.reorder.emit(visibleActionIds);
  }

  onDragEnd(): void {
    console.log('Drag end');
    this.draggedIndex = null;
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✓';
      case 'in_progress': return '⏳';
      default: return '';
    }
  }
}
