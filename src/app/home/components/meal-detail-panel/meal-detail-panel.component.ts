import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MealService, Meal } from '../../../services/meal.service';
import { MealEntryService, MealEntry } from '../../../services/meal-entry.service';

@Component({
  selector: 'app-meal-detail-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meal-detail-panel.component.html',
  styleUrl: './meal-detail-panel.component.css'
})
export class MealDetailPanelComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'breakfast';
  @Input() selectedDate = '';
  @Input() mealEntries: MealEntry[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() mealEntriesChanged = new EventEmitter<MealEntry[]>();
  @Output() mealTypeCompleted = new EventEmitter<string>();
  
  savedMeals: Meal[] = [];
  isLoadingMeals = false;

  constructor(
    private mealService: MealService,
    private mealEntryService: MealEntryService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.loadSavedMeals();
    }
  }

  async loadSavedMeals(): Promise<void> {
    this.isLoadingMeals = true;
    try {
      this.savedMeals = await this.mealService.getAllMeals();
    } catch (error) {
      console.error('Error loading saved meals:', error);
      this.savedMeals = [];
    } finally {
      this.isLoadingMeals = false;
    }
  }

  getMealsForType(): MealEntry[] {
    return this.mealEntries.filter(m => m.mealType === this.mealType);
  }

  getTotals(): { calories: number; protein: number; fats: number; carbs: number } {
    const meals = this.getMealsForType();
    return meals.reduce((totals, meal) => ({
      calories: totals.calories + (meal.calories || 0),
      protein: totals.protein + (meal.protein || 0),
      fats: totals.fats + (meal.fats || 0),
      carbs: totals.carbs + (meal.carbs || 0)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
  }

  isMealTypeCompleted(): boolean {
    const meals = this.getMealsForType();
    return meals.length > 0 && meals.every(m => m.completed);
  }

  async addMealToType(mealId: string): Promise<void> {
    if (!mealId) return;
    
    const savedMeal = this.savedMeals.find(m => m.id === mealId);
    if (!savedMeal) return;
    
    const created = await this.mealEntryService.createMealEntry({
      date: this.selectedDate,
      mealType: this.mealType,
      name: savedMeal.name,
      calories: savedMeal.calories,
      protein: savedMeal.protein,
      carbs: savedMeal.carbs,
      fats: savedMeal.fats,
      completed: false,
      mealId: savedMeal.id
    });
    
    if (created) {
      const newEntries = [...this.mealEntries, created];
      this.mealEntriesChanged.emit(newEntries);
    }
  }

  async removeMeal(mealId: string): Promise<void> {
    const success = await this.mealEntryService.deleteMealEntry(mealId);
    if (success) {
      const newEntries = this.mealEntries.filter(m => m.id !== mealId);
      this.mealEntriesChanged.emit(newEntries);
    }
  }

  onMarkComplete(): void {
    this.mealTypeCompleted.emit(this.mealType);
    this.close.emit();
  }

  getMealTypeIcon(): string {
    switch (this.mealType) {
      case 'breakfast': return '🌅';
      case 'lunch': return '☀️';
      case 'dinner': return '🌙';
      case 'snack': return '🍎';
      default: return '🍽️';
    }
  }

  getMealTypeLabel(): string {
    return this.mealType.charAt(0).toUpperCase() + this.mealType.slice(1);
  }

  onClose(): void {
    this.close.emit();
  }
}
