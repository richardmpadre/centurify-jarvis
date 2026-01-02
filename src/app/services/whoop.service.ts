import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WhoopService {
  private clientId = 'db961e9c-bf37-41bf-b90c-6d6ea8090eec';
  private redirectUri = 'http://localhost:4200/whoop/callback';
  private authUrl = 'https://api.prod.whoop.com/oauth/oauth2/auth';
  private apiBaseUrl = 'https://api.prod.whoop.com/developer/v1';
  
  // Lambda function URL - will be set from amplify_outputs.json
  private lambdaTokenUrl: string | null = null;

  private readonly TOKEN_KEY = 'whoop_token';
  private readonly TOKEN_EXPIRY_KEY = 'whoop_token_expiry';

  constructor() {
    this.loadLambdaUrl();
  }

  private async loadLambdaUrl() {
    try {
      const outputs: any = await import('../../../amplify_outputs.json');
      const customOutputs = outputs.default?.custom || outputs.custom;
      this.lambdaTokenUrl = customOutputs?.whoopAuthApiUrl 
        ? `${customOutputs.whoopAuthApiUrl}token`
        : null;
      console.log('Lambda URL:', this.lambdaTokenUrl);
    } catch (e) {
      console.log('amplify_outputs.json not found - run npx ampx sandbox first');
    }
  }

  // Initiate OAuth flow - redirects user to Whoop
  initiateAuth(): void {
    const scope = 'read:profile read:recovery read:sleep read:workout read:cycles read:body_measurement';
    const state = this.generateState();
    
    sessionStorage.setItem('whoop_oauth_state', state);
    
    const authParams = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scope,
      state: state
    });

    window.location.href = `${this.authUrl}?${authParams.toString()}`;
  }

  // Handle OAuth callback
  async handleCallback(code: string, state: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const savedState = sessionStorage.getItem('whoop_oauth_state');
    
    if (state !== savedState) {
      return { success: false, error: 'State mismatch - possible CSRF attack' };
    }

    sessionStorage.removeItem('whoop_oauth_state');

    try {
      const tokenResponse = await this.exchangeCodeForToken(code);
      
      if (tokenResponse.access_token) {
        this.saveToken(tokenResponse);
        return { success: true, data: tokenResponse };
      } else {
        return { success: false, error: 'No access token received' };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Token exchange failed' };
    }
  }

  // Exchange authorization code for access token via Lambda
  private async exchangeCodeForToken(code: string): Promise<any> {
    // Wait for Lambda URL to load
    if (!this.lambdaTokenUrl) {
      await this.loadLambdaUrl();
    }

    if (!this.lambdaTokenUrl) {
      throw new Error('Lambda URL not configured. Run "npx ampx sandbox" to deploy the backend.');
    }

    console.log('Exchanging code for token via Lambda...');
    console.log('Lambda URL:', this.lambdaTokenUrl);
    console.log('Redirect URI:', this.redirectUri);

    try {
      const response = await fetch(this.lambdaTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: this.redirectUri
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token exchange error:', errorData);
        throw new Error(`Token exchange failed: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('Token received successfully');
      return data;
    } catch (error: any) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  // Save token to localStorage
  private saveToken(tokenData: any): void {
    localStorage.setItem(this.TOKEN_KEY, tokenData.access_token);
    
    const expiryTime = Date.now() + (tokenData.expires_in * 1000);
    localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
    
    if (tokenData.refresh_token) {
      localStorage.setItem('whoop_refresh_token', tokenData.refresh_token);
    }
  }

  // Get stored access token
  getAccessToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    
    if (!token || !expiry) return null;
    
    if (Date.now() > parseInt(expiry)) {
      this.clearToken();
      return null;
    }
    
    return token;
  }

  // Check if connected
  isConnected(): boolean {
    return this.getAccessToken() !== null;
  }

  // Clear token (disconnect)
  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    localStorage.removeItem('whoop_refresh_token');
  }

  // Get user profile
  async getProfile(): Promise<any> {
    return this.apiRequest('/user/profile/basic');
  }

  // Get recovery data
  async getRecovery(startDate?: string, endDate?: string): Promise<any> {
    let url = '/recovery';
    if (startDate && endDate) {
      url += `?start=${startDate}&end=${endDate}`;
    }
    return this.apiRequest(url);
  }

  // Get sleep data
  async getSleep(startDate?: string, endDate?: string): Promise<any> {
    let url = '/activity/sleep';
    if (startDate && endDate) {
      url += `?start=${startDate}&end=${endDate}`;
    }
    return this.apiRequest(url);
  }

  // Get workout data
  async getWorkouts(startDate?: string, endDate?: string): Promise<any> {
    let url = '/activity/workout';
    if (startDate && endDate) {
      url += `?start=${startDate}&end=${endDate}`;
    }
    return this.apiRequest(url);
  }

  // Get cycle (strain) data
  async getCycles(startDate?: string, endDate?: string): Promise<any> {
    let url = '/cycle';
    if (startDate && endDate) {
      url += `?start=${startDate}&end=${endDate}`;
    }
    return this.apiRequest(url);
  }

  // Generic API request via Lambda proxy
  private async apiRequest(endpoint: string): Promise<any> {
    const token = this.getAccessToken();
    
    if (!token) {
      throw new Error('Not authenticated with Whoop');
    }

    if (!this.lambdaTokenUrl) {
      await this.loadLambdaUrl();
    }

    if (!this.lambdaTokenUrl) {
      throw new Error('Lambda URL not configured');
    }

    // Use Lambda proxy to avoid CORS
    const response = await fetch(this.lambdaTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'api',
        endpoint: endpoint,
        accessToken: token
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        throw new Error('Authentication expired. Please reconnect.');
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    return data;
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

