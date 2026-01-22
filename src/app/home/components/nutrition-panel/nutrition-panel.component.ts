import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MealService, Meal } from '../../../services/meal.service';
import { MealEntryService, MealEntry } from '../../../services/meal-entry.service';
import { NutritionGoalMetadata } from '../../../models/goal.models';

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
  @Input() allEntries: any[] = []; // All entries for finding yesterday's meals
  @Input() nutritionTargets: NutritionGoalMetadata | null = null;
  
  @Output() close = new EventEmitter<void>();
  @Output() mealEntriesChanged = new EventEmitter<MealEntry[]>();
  @Output() planSaved = new EventEmitter<void>();
  @Output() trackingFailed = new EventEmitter<void>();
  
  savedMeals: Meal[] = [];
  filteredMeals: Meal[] = [];
  searchQuery = '';
  selectedMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'breakfast';
  isLoadingMeals = false;
  isCopyingYesterday = false;
  
  // Portion editing when adding a meal
  selectedMealForAdd: Meal | null = null;
  portionAmount: number = 1;
  portionUnit: string = 'serving';

  constructor(
    private mealService: MealService,
    private mealEntryService: MealEntryService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.searchQuery = '';
      this.loadSavedMeals();
    }
  }

  async loadSavedMeals(): Promise<void> {
    this.isLoadingMeals = true;
    try {
      this.savedMeals = await this.mealService.getAllMeals();
      this.filteredMeals = [...this.savedMeals];
    } catch (error) {
      console.error('Error loading saved meals:', error);
      this.savedMeals = [];
      this.filteredMeals = [];
    } finally {
      this.isLoadingMeals = false;
    }
  }

  filterMeals(): void {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredMeals = [...this.savedMeals];
    } else {
      this.filteredMeals = this.savedMeals.filter(meal =>
        meal.name.toLowerCase().includes(query)
      );
    }
  }

  selectMealType(type: 'breakfast' | 'lunch' | 'dinner' | 'snack'): void {
    this.selectedMealType = type;
  }

  selectMealForAdd(meal: Meal): void {
    this.selectedMealForAdd = meal;
    // Pre-populate with meal's default portion, or fallback to 1 serving
    this.portionAmount = meal.defaultPortion || 1;
    this.portionUnit = meal.defaultPortionUnit || 'serving';
  }

  cancelMealSelection(): void {
    this.selectedMealForAdd = null;
    this.portionAmount = 1;
    this.portionUnit = 'serving';
  }

  async confirmAddMeal(): Promise<void> {
    if (!this.selectedMealForAdd) return;
    
    const savedMeal = this.selectedMealForAdd;
    
    try {
      const created = await this.mealEntryService.createMealEntry({
        date: this.selectedDate,
        mealType: this.selectedMealType,
        name: savedMeal.name,
        calories: savedMeal.calories,
        protein: savedMeal.protein,
        carbs: savedMeal.carbs,
        fats: savedMeal.fats,
        completed: false,
        mealId: savedMeal.id,
        portion: this.portionAmount
      });
      
      if (created) {
        const newEntries = [...this.mealEntries, created];
        this.mealEntriesChanged.emit(newEntries);
        this.searchQuery = '';
        this.filteredMeals = [...this.savedMeals];
        this.cancelMealSelection();
      }
    } catch (error) {
      console.error('Error adding meal:', error);
    }
  }

  async addMealToType(mealId: string): Promise<void> {
    if (!mealId) return;
    
    const savedMeal = this.savedMeals.find(m => m.id === mealId);
    if (!savedMeal) {
      console.error('Saved meal not found:', mealId);
      return;
    }
    
    // Select the meal for adding with portion input
    this.selectMealForAdd(savedMeal);
  }

  async onMealDropdownChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const mealId = select.value;
    
    console.log('Meal dropdown changed:', { mealId, selectedMealType: this.selectedMealType, date: this.selectedDate });
    
    if (!mealId) {
      console.log('No meal ID selected');
      return;
    }
    
    const savedMeal = this.savedMeals.find(m => m.id === mealId);
    if (!savedMeal) {
      console.error('Saved meal not found:', mealId);
      return;
    }
    
    console.log('Creating meal entry:', {
      meal: savedMeal.name,
      type: this.selectedMealType,
      date: this.selectedDate
    });
    
    try {
      const created = await this.mealEntryService.createMealEntry({
        date: this.selectedDate,
        mealType: this.selectedMealType,
        name: savedMeal.name,
        calories: savedMeal.calories,
        protein: savedMeal.protein,
        carbs: savedMeal.carbs,
        fats: savedMeal.fats,
        completed: false,
        mealId: savedMeal.id,
        portion: 1
      });
      
      console.log('Meal entry created:', created);
      
      if (created) {
        const newEntries = [...this.mealEntries, created];
        console.log('Emitting new entries:', newEntries.length);
        this.mealEntriesChanged.emit(newEntries);
      } else {
        console.error('Failed to create meal entry - no data returned');
      }
    } catch (error) {
      console.error('Error in onMealDropdownChange:', error);
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
    const totals = this.mealEntries.reduce((totals, meal) => ({
      calories: totals.calories + (meal.calories || 0) * (meal.portion || 1),
      protein: totals.protein + (meal.protein || 0) * (meal.portion || 1),
      fats: totals.fats + (meal.fats || 0) * (meal.portion || 1),
      carbs: totals.carbs + (meal.carbs || 0) * (meal.portion || 1)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
    
    return {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      fats: Math.round(totals.fats),
      carbs: Math.round(totals.carbs)
    };
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

  getMealsByType(type: 'breakfast' | 'lunch' | 'dinner' | 'snack'): MealEntry[] {
    return this.mealEntries.filter(m => m.mealType === type);
  }

  hasMealsForType(type: 'breakfast' | 'lunch' | 'dinner' | 'snack'): boolean {
    return this.getMealsByType(type).length > 0;
  }

  getMealTypeTotals(type: 'breakfast' | 'lunch' | 'dinner' | 'snack'): { calories: number; protein: number; carbs: number; fats: number } {
    const meals = this.getMealsByType(type);
    return meals.reduce((totals, meal) => ({
      calories: totals.calories + (meal.calories || 0) * (meal.portion || 1),
      protein: totals.protein + (meal.protein || 0) * (meal.portion || 1),
      carbs: totals.carbs + (meal.carbs || 0) * (meal.portion || 1),
      fats: totals.fats + (meal.fats || 0) * (meal.portion || 1)
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 });
  }

  roundToTwo(value: number): number {
    return Math.round(value * 100) / 100;
  }

  // Target progress methods
  hasTargets(): boolean {
    return this.nutritionTargets !== null;
  }

  getCaloriesProgress(): number {
    if (!this.nutritionTargets?.targetCalories) return 0;
    const totals = this.getNutritionTotals();
    return Math.min(100, Math.round((totals.calories / this.nutritionTargets.targetCalories) * 100));
  }

  getProteinProgress(): number {
    if (!this.nutritionTargets?.targetProtein) return 0;
    const totals = this.getNutritionTotals();
    return Math.min(100, Math.round((totals.protein / this.nutritionTargets.targetProtein) * 100));
  }

  getCaloriesRemaining(): number {
    if (!this.nutritionTargets?.targetCalories) return 0;
    const totals = this.getNutritionTotals();
    return Math.max(0, this.nutritionTargets.targetCalories - totals.calories);
  }

  getProteinRemaining(): number {
    if (!this.nutritionTargets?.targetProtein) return 0;
    const totals = this.getNutritionTotals();
    return Math.max(0, this.nutritionTargets.targetProtein - totals.protein);
  }

  isOverTarget(type: 'calories' | 'protein'): boolean {
    if (!this.nutritionTargets) return false;
    const totals = this.getNutritionTotals();
    if (type === 'calories') {
      return totals.calories > (this.nutritionTargets.targetCalories || 0);
    }
    return totals.protein > (this.nutritionTargets.targetProtein || 0);
  }

  onSavePlan(): void {
    this.planSaved.emit();
  }

  onMarkTrackingFailed(): void {
    if (confirm('Mark this day as failed to track nutrition? This will help you stay accountable.')) {
      this.trackingFailed.emit();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  async copyYesterdaysMeals(): Promise<void> {
    this.isCopyingYesterday = true;
    try {
      // Get yesterday's date
      const yesterday = this.getYesterdayDate();
      
      // Get yesterday's meal entries
      const yesterdayMeals = await this.mealEntryService.getMealEntriesForDate(yesterday);
      
      if (yesterdayMeals.length === 0) {
        alert('No meals found for yesterday');
        return;
      }
      
      // Create new meal entries for today based on yesterday's
      const newEntries: MealEntry[] = [];
      for (const meal of yesterdayMeals) {
        const created = await this.mealEntryService.createMealEntry({
          date: this.selectedDate,
          mealType: meal.mealType,
          name: meal.name,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
          completed: false,
          mealId: meal.mealId || null,
          portion: meal.portion || 1
        });
        
        if (created) {
          newEntries.push(created);
        }
      }
      
      // Emit the combined list
      const allEntries = [...this.mealEntries, ...newEntries];
      this.mealEntriesChanged.emit(allEntries);
      
    } catch (error) {
      console.error('Error copying yesterday\'s meals:', error);
      alert('Failed to copy yesterday\'s meals');
    } finally {
      this.isCopyingYesterday = false;
    }
  }

  hasYesterdaysMeals(): boolean {
    // Check if we have allEntries to look at
    if (!this.allEntries || this.allEntries.length === 0) {
      return false;
    }
    
    const yesterday = this.getYesterdayDate();
    // Check if there are any entries for yesterday
    return this.allEntries.some((entry: any) => entry.date === yesterday);
  }

  private getYesterdayDate(): string {
    const today = new Date(this.selectedDate);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
}
