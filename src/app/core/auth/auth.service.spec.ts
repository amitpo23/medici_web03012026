import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { UserService } from 'src/app/services/user.service';
import { environment } from 'src/app/environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, UserService]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store and retrieve access token from localStorage', () => {
    service.accessToken = 'test-token-123';
    expect(service.accessToken).toBe('test-token-123');
  });

  it('should return empty string for undefined accessToken', () => {
    localStorage.setItem('accessToken', 'undefined');
    expect(service.accessToken).toBe('');
  });

  it('should signIn and store server-issued token', () => {
    const credentials = { email: 'test@test.com', password: 'pass123' };
    const mockResponse = {
      authorization: 'Bearer server-jwt-token',
      user: { id: 1, name: 'Test', email: 'test@test.com' }
    };

    service.signIn(credentials).subscribe(response => {
      expect(response).toBeTruthy();
      expect(service.accessToken).toBe('server-jwt-token');
    });

    const req = httpMock.expectOne(environment.baseUrl + 'sign-in');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(credentials);
    req.flush(mockResponse);
  });

  it('should return error if already authenticated', () => {
    // Simulate being already logged in
    (service as any)._authenticated = true;

    service.signIn({ email: 'test@test.com', password: 'pass' }).subscribe({
      error: (err) => {
        expect(err.message).toBe('User is already logged in.');
      }
    });
  });

  it('should signOut and clear tokens', () => {
    localStorage.setItem('accessToken', 'some-token');
    localStorage.setItem('auth', 'some-auth');

    service.signOut().subscribe(result => {
      expect(result).toBe(true);
      expect(localStorage.getItem('accessToken')).toBeNull();
    });
  });
});
