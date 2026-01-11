import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MealService, Meal } from '../../../services/meal.service';
import { MealEntryService, MealEntry } from '../../../services/meal-entry.service';

@Component({
  selector: 'app-nutrition-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nutrition-panel.component.html',
  styleUrl: './nutrition-panel.component.css'
})
export class NutritionPanelComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() selectedDate = '';
  @Input() mealEntries: MealEntry[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() mealEntriesChanged = new EventEmitter<MealEntry[]>();
  @Output() planSaved = new EventEmitter<void>();
  
  savedMeals: Meal[] = [];
  selectedMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'breakfast';
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

  selectMealType(type: 'breakfast' | 'lunch' | 'dinner' | 'snack'): void {
    this.selectedMealType = type;
  }

  async onMealDropdownChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const mealId = select.value;
    
    if (!mealId) return;
    
    const savedMeal = this.savedMeals.find(m => m.id === mealId);
    if (!savedMeal) return;
    
    const created = await this.mealEntryService.createMealEntry({
      date: this.selectedDate,
      mealType: this.selectedMealType,
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
    
    select.value = '';
  }

  async removeMeal(mealId: string): Promise<void> {
    const success = await this.mealEntryService.deleteMealEntry(mealId);
    if (success) {
      const newEntries = this.mealEntries.filter(m => m.id !== mealId);
      this.mealEntriesChanged.emit(newEntries);
    }
  }

  getNutritionTotals(): { calories: number; protein: number; fats: number; carbs: number } {
    return this.mealEntries.reduce((totals, meal) => ({
      calories: totals.calories + (meal.calories || 0),
      protein: totals.protein + (meal.protein || 0),
      fats: totals.fats + (meal.fats || 0),
      carbs: totals.carbs + (meal.carbs || 0)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
  }

  getMealTypeIcon(type: string): string {
    switch (type) {
      case 'breakfast': return '🌅';
      case 'lunch': return '☀️';
      case 'dinner': return '🌙';
      case 'snack': return '🍎';
      default: return '🍽️';
    }
  }

  getMealTypeLabel(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  onSavePlan(): void {
    this.planSaved.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
