import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <section class="hero">
      <p class="eyebrow">Milestone 1</p>
      <h1>Administration foundation</h1>
      <p>The portal shell, routing, environment configuration, and HTTP client are ready for future features.</p>
    </section>
  `,
  styles: [
    `
      .hero {
        background: #fff;
        border: 1px solid #d9e2ec;
        border-radius: 12px;
        padding: 2rem;
      }
      .eyebrow {
        color: #486581;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        color: #102a43;
        margin: 0.5rem 0;
      }
      p {
        color: #486581;
        max-width: 720px;
      }
    `,
  ],
})
export class DashboardComponent {}
