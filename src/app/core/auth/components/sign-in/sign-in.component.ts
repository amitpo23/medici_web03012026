import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, NgForm, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../auth.service';
// import { fuseAnimations } from '@fuse/animations';
// import { FuseAlertType } from '@fuse/components/alert';

@Component({
    selector: 'auth-sign-in',
    templateUrl: './sign-in.component.html',
    encapsulation: ViewEncapsulation.None,
    // animations   : fuseAnimations
    styleUrls: ['./sign-in.component.scss']
})
export class AuthSignInComponent implements OnInit {
    @ViewChild('signInNgForm') signInNgForm!: NgForm;

    // alert: { type: FuseAlertType; message: string } = {
    //     type   : 'success',
    //     message: ''
    // };
    signInForm: FormGroup;
    showAlert: boolean = false;

    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _authService: AuthService,
        private _formBuilder: FormBuilder,
        private _router: Router
    ) {
        this.signInForm = this._formBuilder.group({
            email: ['', [Validators.required]],
            password: ['admin', Validators.required],
            rememberMe: ['']
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Auto-redirect to dashboard - authentication temporarily disabled
        // Set mock user data for the session
        const mockUser = { id: 1, name: 'Admin User', email: 'admin@medici.com' };
        localStorage.setItem('signedUser', JSON.stringify(mockUser));
        localStorage.setItem('accessToken', 'mock-token-auth-disabled');
        localStorage.setItem('auth', 'Bearer mock-token-auth-disabled');

        this._router.navigate(['/dashboard']);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Sign in
     */
    signIn(): void {
        // Return if the form is invalid
        if (this.signInForm!.invalid) {
            return;
        }

        // Disable the form
        this.signInForm!.disable();

        // Hide the alert
        this.showAlert = false;

        // Sign in
        this._authService.signIn(this.signInForm!.value)
            .subscribe(
                () => {

                    // Set the redirect url.
                    // The '/signed-in-redirect' is a dummy url to catch the request and redirect the user
                    // to the correct page after a successful sign in. This way, that url can be set via
                    // routing file and we don't have to touch here.
                    const redirectURL = this._activatedRoute.snapshot.queryParamMap.get('redirectURL') || '/signed-in-redirect';

                    // Navigate to the redirect url
                    this._router.navigateByUrl(redirectURL);

                },
                (response: any) => {

                    // Re-enable the form
                    this.signInForm!.enable();

                    // Reset the form
                    this.signInNgForm.resetForm();

                    // Set the alert
                    // this.alert = {
                    //     type   : 'error',
                    //     message: 'Wrong email or password'
                    // };

                    // Show the alert
                    this.showAlert = true;
                }
            );
    }
}
