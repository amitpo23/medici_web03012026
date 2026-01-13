import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PredictionService } from '../../services/prediction.service';

@Component({
  selector: 'app-roi-calculator',
  templateUrl: './roi-calculator.component.html',
  styleUrls: ['./roi-calculator.component.scss']
})
export class RoiCalculatorComponent {
  calculatorForm: FormGroup;
  result: any = null;

  // Make parseFloat available in template
  parseFloat = parseFloat;

  constructor(
    private fb: FormBuilder,
    private predictionService: PredictionService
  ) {
    this.calculatorForm = this.fb.group({
      investment: ['', [Validators.required, Validators.min(0)]],
      expectedRevenue: ['', [Validators.required, Validators.min(0)]],
      days: ['', [Validators.required, Validators.min(1)]]
    });
  }

  calculate(): void {
    if (this.calculatorForm.invalid) return;

    const { investment, expectedRevenue, days } = this.calculatorForm.value;
    this.result = this.predictionService.calculateROI(
      parseFloat(investment),
      parseFloat(expectedRevenue),
      parseInt(days)
    );
  }

  getROIColor(roi: number): string {
    if (roi >= 20) return 'excellent-roi';
    if (roi >= 10) return 'good-roi';
    if (roi >= 5) return 'moderate-roi';
    return 'low-roi';
  }

  reset(): void {
    this.calculatorForm.reset();
    this.result = null;
  }
}
