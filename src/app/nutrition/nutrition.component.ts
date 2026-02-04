import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FoodService, Food } from '../services/food.service';

@Component({
  selector: 'app-nutrition',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './nutrition.component.html',
  styleUrl: './nutrition.component.css'
})
export class NutritionComponent implements OnInit {
  foods: Food[] = [];
  foodForm: FormGroup;
  showForm = false;
  editingFoodId: string | null = null;
  searchQuery = '';
  isLoading = false;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private foodService: FoodService
  ) {
    this.foodForm = this.fb.group({
      name: ['', Validators.required],
      calories: [0, [Validators.required, Validators.min(0)]],
      protein: [0, [Validators.min(0)]],
      fats: [0, [Validators.min(0)]],
      carbs: [0, [Validators.min(0)]],
      defaultPortion: [1, [Validators.min(0.1)]],
      defaultPortionUnit: ['serving']
    });
  }

  ngOnInit(): void {
    this.loadFoods();
  }

  async loadFoods(): Promise<void> {
    this.isLoading = true;
    try {
      this.foods = await this.foodService.getAllFoods();
      // Sort by most recently updated
      this.foods.sort((a, b) => {
        const dateA = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const dateB = new Date(a.updatedAt || a.createdAt || 0).getTime();
        return dateA - dateB;
      });
    } catch (error) {
      console.error('Failed to load foods:', error);
    } finally {
      this.isLoading = false;
    }
  }

  openAddForm(): void {
    this.editingFoodId = null;
    this.foodForm.reset({
      name: '',
      calories: 0,
      protein: 0,
      fats: 0,
      carbs: 0,
      defaultPortion: 1,
      defaultPortionUnit: 'serving'
    });
    this.showForm = true;
  }

  openEditForm(food: Food): void {
    this.editingFoodId = food.id;
    this.foodForm.patchValue({
      name: food.name,
      calories: food.calories,
      protein: food.protein || 0,
      fats: food.fats || 0,
      carbs: food.carbs || 0,
      defaultPortion: food.defaultPortion || 1,
      defaultPortionUnit: food.defaultPortionUnit || 'serving'
    });
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingFoodId = null;
  }

  async submitForm(): Promise<void> {
    console.log('submitForm called');
    console.log('Form valid:', this.foodForm.valid);
    console.log('Form value:', this.foodForm.value);
    console.log('Is saving:', this.isSaving);
    
    if (!this.foodForm.valid || this.isSaving) {
      console.log('Form validation failed or already saving');
      return;
    }

    this.isSaving = true;
    const formValue = this.foodForm.value;
    console.log('Starting save with values:', formValue);

    try {
      if (this.editingFoodId) {
        console.log('Updating existing food:', this.editingFoodId);
        // Update existing
        const updated = await this.foodService.updateFood(this.editingFoodId, {
          name: formValue.name,
          calories: formValue.calories || 0,
          protein: formValue.protein || 0,
          fats: formValue.fats || 0,
          carbs: formValue.carbs || 0,
          defaultPortion: formValue.defaultPortion || 1,
          defaultPortionUnit: formValue.defaultPortionUnit || 'serving'
        });
        
        console.log('Update result:', updated);
        
        if (updated) {
          const index = this.foods.findIndex(f => f.id === this.editingFoodId);
          if (index !== -1) {
            this.foods[index] = updated;
          }
        }
      } else {
        console.log('Creating new food');
        // Create new
        const created = await this.foodService.createFood({
          name: formValue.name,
          calories: formValue.calories || 0,
          protein: formValue.protein || 0,
          fats: formValue.fats || 0,
          carbs: formValue.carbs || 0,
          defaultPortion: formValue.defaultPortion || 1,
          defaultPortionUnit: formValue.defaultPortionUnit || 'serving'
        });
        
        console.log('Create result:', created);
        
        if (created) {
          this.foods.unshift(created);
          console.log('Food added to list. Total foods:', this.foods.length);
        }
      }
      
      console.log('Closing form');
      this.closeForm();
    } catch (error) {
      console.error('Error saving food:', error);
    } finally {
      this.isSaving = false;
    }
  }

  async deleteFood(food: Food): Promise<void> {
    if (!confirm(`Delete "${food.name}"?`)) return;
    
    const success = await this.foodService.deleteFood(food.id);
    if (success) {
      this.foods = this.foods.filter(f => f.id !== food.id);
    }
  }

  async duplicateFood(food: Food): Promise<void> {
    const created = await this.foodService.createFood({
      name: `${food.name} (copy)`,
      calories: food.calories,
      protein: food.protein,
      fats: food.fats,
      carbs: food.carbs,
      defaultPortion: food.defaultPortion,
      defaultPortionUnit: food.defaultPortionUnit
    });
    
    if (created) {
      this.foods.unshift(created);
    }
  }

  get filteredFoods(): Food[] {
    let result = this.foods;

    // Filter by search
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(query));
    }

    return result;
  }

  onSearchChange(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }
}
