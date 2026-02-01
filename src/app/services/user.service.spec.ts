import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService]
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set and emit user via user$ observable', (done) => {
    const testUser = { id: 1, name: 'Test User', email: 'test@test.com' } as any;

    service.user$ .subscribe(user => {
      expect(user).toEqual(testUser);
      done();
    });

    service.user = testUser;
  });

  it('should store signedUser', () => {
    const user = { id: 1, name: 'Signed User' };
    service.signedUser = user;
    expect(service.signedUser).toEqual(user);
  });
});
