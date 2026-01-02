import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AmplifyAuthenticatorModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Jarvis';
  isPublicRoute = false;
  
  private publicRoutes = ['/privacy'];

  constructor(
    public authenticator: AuthenticatorService,
    private router: Router
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.isPublicRoute = this.publicRoutes.some(route => event.url.startsWith(route));
    });
    
    // Check initial route
    this.isPublicRoute = this.publicRoutes.some(route => this.router.url.startsWith(route));
  }
}

