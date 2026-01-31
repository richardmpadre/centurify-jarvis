import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { IntegrationsComponent } from './integrations/integrations.component';
import { WhoopCallbackComponent } from './whoop-callback/whoop-callback.component';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { NutritionComponent } from './nutrition/nutrition.component';
import { TrainingComponent } from './training/training.component';
import { TrainingHistoryComponent } from './training-history/training-history.component';
import { InsightsComponent } from './insights/insights.component';
import { GoalsComponent } from './goals/goals.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'goals', component: GoalsComponent },
  { path: 'insights', component: InsightsComponent },
  { path: 'nutrition', component: NutritionComponent },
  { path: 'training', component: TrainingComponent },
  { path: 'training-history', component: TrainingHistoryComponent },
  { path: 'integrations', component: IntegrationsComponent },
  { path: 'whoop/callback', component: WhoopCallbackComponent },
  { path: 'privacy', component: PrivacyPolicyComponent }
];

