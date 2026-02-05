import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData } from 'lightweight-charts';
import { TradingExchangeService } from '../../services/trading-exchange.service';
import { Candle } from '../../models/trading-exchange.models';

@Component({
  selector: 'app-price-chart',
  templateUrl: './price-chart.component.html',
  styleUrls: ['./price-chart.component.scss']
})
export class PriceChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() hotelId: number = 0;
  @Input() height: number = 400;

  @ViewChild('chartContainer') chartContainer!: ElementRef<HTMLDivElement>;

  private destroy$ = new Subject<void>();
  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;

  selectedTimeframe = '1D';
  timeframes = ['1H', '4H', '1D', '1W'];
  loading = false;
  error: string | null = null;
  symbol = '';
  hotelName = '';

  constructor(private tradingService: TradingExchangeService) {}

  ngOnInit(): void {
    this.tradingService.refresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.hotelId > 0) {
          this.loadPriceData();
        }
      });
  }

  ngAfterViewInit(): void {
    this.initChart();
    if (this.hotelId > 0) {
      this.loadPriceData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.chart) {
      this.chart.remove();
    }
  }

  private initChart(): void {
    if (!this.chartContainer?.nativeElement) return;

    this.chart = createChart(this.chartContainer.nativeElement, {
      width: this.chartContainer.nativeElement.clientWidth,
      height: this.height,
      layout: {
        background: { color: '#1a1a2e' },
        textColor: '#d1d4dc'
      },
      grid: {
        vertLines: { color: '#2d2d44' },
        horzLines: { color: '#2d2d44' }
      },
      crosshair: {
        mode: 1
      },
      rightPriceScale: {
        borderColor: '#2d2d44'
      },
      timeScale: {
        borderColor: '#2d2d44',
        timeVisible: true,
        secondsVisible: false
      }
    });

    // Candlestick series
    this.candlestickSeries = this.chart.addCandlestickSeries({
      upColor: '#4caf50',
      downColor: '#f44336',
      borderDownColor: '#f44336',
      borderUpColor: '#4caf50',
      wickDownColor: '#f44336',
      wickUpColor: '#4caf50'
    });

    // Volume histogram
    this.volumeSeries = this.chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
    });

    // Resize handler
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || !this.chart) return;
      const { width } = entries[0].contentRect;
      this.chart.applyOptions({ width });
    });
    resizeObserver.observe(this.chartContainer.nativeElement);
  }

  loadPriceData(): void {
    if (!this.hotelId || this.hotelId <= 0) return;

    this.loading = true;
    this.error = null;

    this.tradingService.getPriceHistory(this.hotelId, this.selectedTimeframe, 90)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.candles.length > 0) {
            this.symbol = response.symbol;
            this.hotelName = response.name;
            this.updateChart(response.candles);
          } else {
            this.error = 'No price data available for this hotel';
          }
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to load price data';
          this.loading = false;
          console.error('Price chart error:', err);
        }
      });
  }

  private updateChart(candles: Candle[]): void {
    if (!this.candlestickSeries || !this.volumeSeries) return;

    // Format candlestick data
    const candleData: CandlestickData[] = candles.map(c => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));

    // Format volume data
    const volumeData: HistogramData[] = candles.map(c => ({
      time: c.time as any,
      value: c.volume || 0,
      color: c.close >= c.open ? '#4caf5080' : '#f4433680'
    }));

    this.candlestickSeries.setData(candleData);
    this.volumeSeries.setData(volumeData);

    // Fit content
    this.chart?.timeScale().fitContent();
  }

  onTimeframeChange(timeframe: string): void {
    this.selectedTimeframe = timeframe;
    this.loadPriceData();
  }

  setHotelId(hotelId: number): void {
    this.hotelId = hotelId;
    if (this.chart) {
      this.loadPriceData();
    }
  }
}
