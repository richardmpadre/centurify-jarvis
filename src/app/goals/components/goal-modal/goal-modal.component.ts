import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Goal, GoalType, GoalStatus, GOAL_TYPE_CONFIG, GOAL_STATUS_CONFIG, Milestone } from '../../../models/goal.models';

@Component({
  selector: 'app-goal-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './goal-modal.component.html',
  styleUrl: './goal-modal.component.css'
})
export class GoalModalComponent implements OnInit {
  @Input() editingGoal: Goal | null = null;
  @Input() parentGoal: Goal | null = null;
  
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Partial<Goal>>();

  goalForm: FormGroup;
  availableTypes: GoalType[] = [];

  constructor(private fb: FormBuilder) {
    this.goalForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      goalType: ['', Validators.required],
      status: ['not_started'],
      progress: [0],
      targetDate: ['']
    });
  }

  ngOnInit(): void {
    this.initializeForm();
    this.setAvailableTypes();
  }

  private initializeForm(): void {
    if (this.editingGoal) {
      // Edit mode - populate form
      this.goalForm.patchValue({
        title: this.editingGoal.title,
        description: this.editingGoal.description || '',
        goalType: this.editingGoal.goalType,
        status: this.editingGoal.status,
        progress: this.editingGoal.progress,
        targetDate: this.editingGoal.targetDate || ''
      });
      this.milestones = this.editingGoal.milestones ? [...this.editingGoal.milestones] : [];
    } else if (this.parentGoal) {
      // New child goal - default to ad_hoc for sub-goals
      this.goalForm.patchValue({
        goalType: 'ad_hoc'
      });
    } else {
      // New life purpose
      this.goalForm.patchValue({
        goalType: 'life_purpose'
      });
    }
  }

  private setAvailableTypes(): void {
    if (this.editingGoal) {
      // When editing, only allow same type or valid child types
      this.availableTypes = [this.editingGoal.goalType];
    } else if (this.parentGoal) {
      // New child - show allowed types
      this.availableTypes = GOAL_TYPE_CONFIG[this.parentGoal.goalType].allowedChildren;
    } else {
      // New root - only life purpose
      this.availableTypes = ['life_purpose'];
    }
  }

  // Milestones
  milestones: Milestone[] = [];

  addMilestone(): void {
    const title = this.goalForm.value.newMilestone?.trim();
    if (!title) return;

    this.milestones.push({
      id: crypto.randomUUID(),
      title,
      completed: false
    });

    this.goalForm.patchValue({ newMilestone: '' });
  }

  removeMilestone(index: number): void {
    this.milestones.splice(index, 1);
  }

  getTypeConfig(type: GoalType) {
    return GOAL_TYPE_CONFIG[type];
  }

  getStatusConfig(status: GoalStatus) {
    return GOAL_STATUS_CONFIG[status];
  }

  get statusOptions(): GoalStatus[] {
    return ['not_started', 'in_progress', 'completed', 'paused', 'abandoned'];
  }

  isSubGoal(): boolean {
    return this.parentGoal !== null;
  }

  getModalTitle(): string {
    if (this.editingGoal) {
      return `Edit ${GOAL_TYPE_CONFIG[this.editingGoal.goalType].label}`;
    }
    if (this.parentGoal) {
      return `Add Sub-goal to "${this.parentGoal.title}"`;
    }
    return 'Set Life Purpose';
  }

  onClose(): void {
    this.close.emit();
  }

  onSubmit(): void {
    if (this.goalForm.invalid) return;

    const formValue = this.goalForm.value;
    
    const goalData: Partial<Goal> = {
      title: formValue.title,
      description: formValue.description || undefined,
      goalType: formValue.goalType,
      status: formValue.status,
      progress: formValue.progress,
      targetDate: formValue.targetDate || undefined,
      milestones: this.milestones
    };

    this.save.emit(goalData);
  }
}
