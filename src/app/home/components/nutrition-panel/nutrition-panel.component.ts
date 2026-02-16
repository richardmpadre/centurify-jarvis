import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FoodService, Food } from '../../../services/food.service';
import { FoodEntryService, FoodEntry } from '../../../services/food-entry.service';
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
  @Input() foodEntries: FoodEntry[] = [];
  @Input() allEntries: any[] = []; // All entries for finding yesterday's foods
  @Input() nutritionTargets: NutritionGoalMetadata | null = null;
  
  @Output() close = new EventEmitter<void>();
  @Output() foodEntriesChanged = new EventEmitter<FoodEntry[]>();
  @Output() planSaved = new EventEmitter<void>();
  @Output() trackingFailed = new EventEmitter<void>();
  
  savedFoods: Food[] = [];
  filteredFoods: Food[] = [];
  searchQuery = '';
  selectedMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'breakfast';
  isLoadingFoods = false;
  isCopyingLatest = false;
  
  // Portion editing when adding a food
  selectedFoodForAdd: Food | null = null;
  portionAmount: number = 1;
  portionUnit: string = 'serving';

  constructor(
    private foodService: FoodService,
    private foodEntryService: FoodEntryService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.searchQuery = '';
      this.loadSavedFoods();
    }
  }

  async loadSavedFoods(): Promise<void> {
    this.isLoadingFoods = true;
    try {
      this.savedFoods = await this.foodService.getAllFoods();
      this.filteredFoods = [...this.savedFoods];
    } catch (error) {
      console.error('Error loading saved foods:', error);
      this.savedFoods = [];
      this.filteredFoods = [];
    } finally {
      this.isLoadingFoods = false;
    }
  }

  filterFoods(): void {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredFoods = [...this.savedFoods];
    } else {
      this.filteredFoods = this.savedFoods.filter(food =>
        food.name.toLowerCase().includes(query)
      );
    }
  }

  selectMealType(type: 'breakfast' | 'lunch' | 'dinner' | 'snack'): void {
    this.selectedMealType = type;
  }

  selectFoodForAdd(food: Food): void {
    this.selectedFoodForAdd = food;
    // Pre-populate with food's default portion, or fallback to 1 serving
    this.portionAmount = food.defaultPortion || 1;
    this.portionUnit = food.defaultPortionUnit || 'serving';
  }

  cancelFoodSelection(): void {
    this.selectedFoodForAdd = null;
    this.portionAmount = 1;
    this.portionUnit = 'serving';
  }

  async confirmAddFood(): Promise<void> {
    if (!this.selectedFoodForAdd) return;
    
    const savedFood = this.selectedFoodForAdd;
    
    try {
      const created = await this.foodEntryService.createFoodEntry({
        date: this.selectedDate,
        mealType: this.selectedMealType,
        name: savedFood.name,
        calories: savedFood.calories,
        protein: savedFood.protein,
        carbs: savedFood.carbs,
        fats: savedFood.fats,
        completed: false,
        foodId: savedFood.id,
        portion: this.portionAmount
      });
      
      if (created) {
        const newEntries = [...this.foodEntries, created];
        this.foodEntriesChanged.emit(newEntries);
        this.searchQuery = '';
        this.filteredFoods = [...this.savedFoods];
        this.cancelFoodSelection();
      }
    } catch (error) {
      console.error('Error adding food:', error);
    }
  }

  async addFoodToType(foodId: string): Promise<void> {
    if (!foodId) return;
    
    const savedFood = this.savedFoods.find(f => f.id === foodId);
    if (!savedFood) {
      console.error('Saved food not found:', foodId);
      return;
    }
    
    // Select the food for adding with portion input
    this.selectFoodForAdd(savedFood);
  }

  async onFoodDropdownChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const foodId = select.value;
    
    console.log('Food dropdown changed:', { foodId, selectedMealType: this.selectedMealType, date: this.selectedDate });
    
    if (!foodId) {
      console.log('No food ID selected');
      return;
    }
    
    const savedFood = this.savedFoods.find(f => f.id === foodId);
    if (!savedFood) {
      console.error('Saved food not found:', foodId);
      return;
    }
    
    console.log('Creating food entry:', {
      food: savedFood.name,
      type: this.selectedMealType,
      date: this.selectedDate
    });
    
    try {
      const created = await this.foodEntryService.createFoodEntry({
        date: this.selectedDate,
        mealType: this.selectedMealType,
        name: savedFood.name,
        calories: savedFood.calories,
        protein: savedFood.protein,
        carbs: savedFood.carbs,
        fats: savedFood.fats,
        completed: false,
        foodId: savedFood.id,
        portion: 1
      });
      
      console.log('Food entry created:', created);
      
      if (created) {
        const newEntries = [...this.foodEntries, created];
        console.log('Emitting new entries:', newEntries.length);
        this.foodEntriesChanged.emit(newEntries);
      } else {
        console.error('Failed to create food entry - no data returned');
      }
    } catch (error) {
      console.error('Error in onFoodDropdownChange:', error);
    }
    
    select.value = '';
  }

  async removeFood(foodId: string): Promise<void> {
    const success = await this.foodEntryService.deleteFoodEntry(foodId);
    if (success) {
      const newEntries = this.foodEntries.filter(f => f.id !== foodId);
      this.foodEntriesChanged.emit(newEntries);
    }
  }

  getNutritionTotals(): { calories: number; protein: number; fats: number; carbs: number } {
    const totals = this.foodEntries.reduce((totals, food) => ({
      calories: totals.calories + (food.calories || 0) * (food.portion || 1),
      protein: totals.protein + (food.protein || 0) * (food.portion || 1),
      fats: totals.fats + (food.fats || 0) * (food.portion || 1),
      carbs: totals.carbs + (food.carbs || 0) * (food.portion || 1)
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

  getFoodsByType(type: 'breakfast' | 'lunch' | 'dinner' | 'snack'): FoodEntry[] {
    return this.foodEntries.filter(f => f.mealType === type);
  }

  hasFoodsForType(type: 'breakfast' | 'lunch' | 'dinner' | 'snack'): boolean {
    return this.getFoodsByType(type).length > 0;
  }

  getFoodTypeTotals(type: 'breakfast' | 'lunch' | 'dinner' | 'snack'): { calories: number; protein: number; carbs: number; fats: number } {
    const foods = this.getFoodsByType(type);
    return foods.reduce((totals, food) => ({
      calories: totals.calories + (food.calories || 0) * (food.portion || 1),
      protein: totals.protein + (food.protein || 0) * (food.portion || 1),
      carbs: totals.carbs + (food.carbs || 0) * (food.portion || 1),
      fats: totals.fats + (food.fats || 0) * (food.portion || 1)
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

  /**
   * Copy meals from the most recent day that has food entries (looking back up to 14 days).
   * This is more flexible than copying only yesterday — helpful when the user missed a day.
   */
  async copyLatestFoods(): Promise<void> {
    this.isCopyingLatest = true;
    try {
      // Find the most recent day and its food entries in one pass (avoids double-fetch)
      const sourceFoods = await this.getLatestFoodEntries();

      if (!sourceFoods || sourceFoods.length === 0) {
        alert('No previous meals found in the last 14 days');
        return;
      }

      // Create new food entries for the selected date based on the source day
      const newEntries: FoodEntry[] = [];
      for (const food of sourceFoods) {
        const created = await this.foodEntryService.createFoodEntry({
          date: this.selectedDate,
          mealType: food.mealType,
          name: food.name,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fats: food.fats,
          completed: false,
          foodId: food.foodId || null,
          portion: food.portion || 1
        });

        if (created) {
          newEntries.push(created);
        }
      }

      // Emit the combined list
      const allEntries = [...this.foodEntries, ...newEntries];
      this.foodEntriesChanged.emit(allEntries);

    } catch (error) {
      console.error('Error copying latest foods:', error);
      alert('Failed to copy latest meals');
    } finally {
      this.isCopyingLatest = false;
    }
  }

  /**
   * Walk backward from the day before selectedDate, up to 14 days,
   * and return the food entries from the first date that has any.
   * Returns null if no day with food entries is found.
   */
  private async getLatestFoodEntries(): Promise<FoodEntry[] | null> {
    const MAX_DAYS_BACK = 14;
    const base = new Date(this.selectedDate);

    for (let i = 1; i <= MAX_DAYS_BACK; i++) {
      const candidate = new Date(base);
      candidate.setDate(candidate.getDate() - i);
      const dateStr = candidate.toISOString().split('T')[0];

      const entries = await this.foodEntryService.getFoodEntriesForDate(dateStr);
      if (entries.length > 0) {
        return entries;
      }
    }

    return null;
  }
}
