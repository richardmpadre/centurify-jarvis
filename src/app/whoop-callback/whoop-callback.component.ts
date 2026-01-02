import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { WhoopService } from '../services/whoop.service';

@Component({
  selector: 'app-whoop-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      <div *ngIf="isLoading" class="loading">
        <div class="spinner"></div>
        <p>Connecting to Whoop...</p>
      </div>
      <div *ngIf="error" class="error">
        <h3>Connection Failed</h3>
        <p>{{ error }}</p>
        <p class="hint" *ngIf="error.includes('CORS')">
          <strong>Solution:</strong> The token exchange must happen server-side. 
          You'll need an AWS Lambda function to handle the OAuth callback.
        </p>
        <p class="debug">Check browser console (F12) for details.</p>
        <button (click)="goBack()">Go Back</button>
      </div>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
    }
    .loading, .error {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #ff6b35;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error h3 {
      color: #c62828;
    }
    .hint {
      background: #fff3e0;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1rem;
      font-size: 0.9rem;
    }
    .debug {
      color: #666;
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }
    .error button {
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  `]
})
export class WhoopCallbackComponent implements OnInit {
  isLoading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private whoopService: WhoopService
  ) {}

  async ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');
    const errorParam = this.route.snapshot.queryParamMap.get('error');

    if (errorParam) {
      this.isLoading = false;
      this.error = `Authorization denied: ${errorParam}`;
      return;
    }

    if (!code || !state) {
      this.isLoading = false;
      this.error = 'Missing authorization code or state';
      return;
    }

    const result = await this.whoopService.handleCallback(code, state);
    
    if (result.success) {
      this.router.navigate(['/integrations']);
    } else {
      this.isLoading = false;
      this.error = result.error || 'Unknown error occurred';
    }
  }

  goBack() {
    this.router.navigate(['/integrations']);
  }
}

