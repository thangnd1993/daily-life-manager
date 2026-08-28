import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="login-card" [formGroup]="form" (ngSubmit)="submit()">
      <p class="eyebrow">Administrator access</p>
      <h1>Sign in</h1>
      <label>Email <input type="email" formControlName="email" autocomplete="username" /></label>
      <label>Password <input type="password" formControlName="password" autocomplete="current-password" /></label>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <button type="submit" [disabled]="form.invalid || submitting()">Sign in</button>
    </form>
  `,
  styles: [
    `
      .login-card {
        background: #fff;
        border: 1px solid #d9e2ec;
        border-radius: 12px;
        display: grid;
        gap: 1rem;
        margin: 3rem auto;
        max-width: 420px;
        padding: 2rem;
      }
      label {
        color: #243b53;
        display: grid;
        gap: 0.4rem;
      }
      input {
        border: 1px solid #bcccdc;
        border-radius: 6px;
        padding: 0.75rem;
      }
      button {
        background: #102a43;
        border: 0;
        border-radius: 6px;
        color: #fff;
        padding: 0.8rem;
      }
      .eyebrow {
        color: #486581;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .error {
        color: #b91c1c;
      }
    `,
  ],
})
export class LoginComponent {
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth
      .login(email, password)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (account) => {
          if (account.role === 'ADMIN') void this.router.navigate(['/']);
          else {
            this.auth.clear();
            this.error.set('Administrator access is required.');
          }
        },
        error: () => this.error.set('Invalid email or password.'),
      });
  }
}
