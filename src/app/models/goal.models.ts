// Goal type hierarchy
export type GoalType = 'life_purpose' | 'life_goal' | 'yearly' | 'quarterly' | 'monthly' | 'ad_hoc';

// Goal status
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'paused' | 'abandoned';

// Recurrence type for recurring goals
export type RecurrenceType = 'daily';

// Goal category - determines which panel to use
export type GoalCategory = 'nutrition' | 'training' | 'general';

// Nutrition goal metadata
export interface NutritionGoalMetadata {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
}

// Generic metadata type (can be extended for other categories)
export type GoalMetadata = NutritionGoalMetadata | Record<string, unknown>;

// Milestone within a goal
export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  completedDate?: string;
}

// Goal interface
export interface Goal {
  id: string;
  title: string;
  description?: string;
  goalType: GoalType;
  parentGoalId?: string | null;
  status: GoalStatus;
  progress: number;
  startDate?: string;
  targetDate?: string;
  completedDate?: string;
  sortOrder: number;
  milestones?: Milestone[];
  notes?: string;
  requiresDailyAction?: boolean; // For yearly goals - generates daily action prompt
  // Recurring goal fields
  isRecurring?: boolean;
  recurrenceType?: RecurrenceType;
  goalCategory?: GoalCategory;
  metadata?: GoalMetadata;
  children?: Goal[]; // Populated by service for tree view
  createdAt?: string;
  updatedAt?: string;
}

// Recurring goal completion tracking
export interface RecurringGoalCompletion {
  id: string;
  goalId: string;
  date: string;
  completed: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Goal type display configuration
export const GOAL_TYPE_CONFIG: Record<GoalType, { 
  label: string; 
  icon: string; 
  color: string;
  allowedChildren: GoalType[];
}> = {
  life_purpose: {
    label: 'Life Purpose',
    icon: '⭐',
    color: '#FFD700',
    allowedChildren: ['life_goal']
  },
  life_goal: {
    label: 'Life Goal',
    icon: '🎯',
    color: '#8b5cf6',
    allowedChildren: ['yearly', 'quarterly', 'monthly', 'ad_hoc']
  },
  yearly: {
    label: 'Yearly Goal',
    icon: '📅',
    color: '#3b82f6',
    allowedChildren: ['quarterly', 'monthly', 'ad_hoc']
  },
  quarterly: {
    label: 'Quarterly Goal',
    icon: '📊',
    color: '#22c55e',
    allowedChildren: ['monthly', 'ad_hoc']
  },
  monthly: {
    label: 'Monthly Goal',
    icon: '📆',
    color: '#f97316',
    allowedChildren: ['ad_hoc']
  },
  ad_hoc: {
    label: 'Ad-hoc Goal',
    icon: '📌',
    color: '#6b7280',
    allowedChildren: []
  }
};

// Goal status display configuration
export const GOAL_STATUS_CONFIG: Record<GoalStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  not_started: {
    label: 'Not Started',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.2)'
  },
  in_progress: {
    label: 'In Progress',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.2)'
  },
  completed: {
    label: 'Completed',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.2)'
  },
  paused: {
    label: 'Paused',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.2)'
  },
  abandoned: {
    label: 'Abandoned',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.2)'
  }
};

// Goal category display configuration
export const GOAL_CATEGORY_CONFIG: Record<GoalCategory, {
  label: string;
  icon: string;
  color: string;
}> = {
  nutrition: {
    label: 'Nutrition',
    icon: '🥗',
    color: '#22c55e'
  },
  training: {
    label: 'Training',
    icon: '🏋️',
    color: '#3b82f6'
  },
  general: {
    label: 'General',
    icon: '📌',
    color: '#6b7280'
  }
};
