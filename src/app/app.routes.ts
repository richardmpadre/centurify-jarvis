import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { IntegrationsComponent } from './integrations/integrations.component';
import { WhoopCallbackComponent } from './whoop-callback/whoop-callback.component';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'integrations', component: IntegrationsComponent },
  { path: 'whoop/callback', component: WhoopCallbackComponent },
  { path: 'privacy', component: PrivacyPolicyComponent }
];

