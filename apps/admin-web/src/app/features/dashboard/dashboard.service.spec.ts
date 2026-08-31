import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DashboardService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DashboardService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps the summary and fixed trend resources', () => {
    service.summary().subscribe();
    expect(http.expectOne('admin/dashboard/summary').request.method).toBe('GET');

    service.trends().subscribe();
    expect(http.expectOne('admin/dashboard/trends').request.method).toBe('GET');
  });
});
