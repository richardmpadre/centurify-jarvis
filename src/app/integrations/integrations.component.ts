import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { WhoopService } from '../services/whoop.service';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './integrations.component.html',
  styleUrl: './integrations.component.css'
})
export class IntegrationsComponent implements OnInit {
  // Whoop
  whoopConnected = false;
  whoopLoading = false;
  whoopProfile: any = null;
  whoopRecoveryData: any = null;
  whoopError = '';

  constructor(
    private whoopService: WhoopService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.whoopConnected = this.whoopService.isConnected();
    
    if (this.whoopConnected) {
      this.loadWhoopProfile();
    }
  }

  // Whoop methods
  connectWhoop() {
    this.whoopService.initiateAuth();
  }

  disconnectWhoop() {
    this.whoopService.clearToken();
    this.whoopConnected = false;
    this.whoopProfile = null;
    this.whoopRecoveryData = null;
  }

  async loadWhoopProfile() {
    this.whoopLoading = true;
    this.whoopError = '';
    
    try {
      this.whoopProfile = await this.whoopService.getProfile();
    } catch (err: any) {
      this.whoopError = err.message;
    } finally {
      this.whoopLoading = false;
    }
  }

  async loadWhoopRecovery() {
    this.whoopLoading = true;
    this.whoopError = '';
    
    try {
      // Get last 7 days of recovery data
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      this.whoopRecoveryData = await this.whoopService.getRecovery(weekAgo, today);
    } catch (err: any) {
      this.whoopError = err.message;
    } finally {
      this.whoopLoading = false;
    }
  }
}

