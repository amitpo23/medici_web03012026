import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataExplorerService, TableInfo } from 'src/app/services/data-explorer.service';

interface TableCatalogEntry extends TableInfo {
  description: string;
  category: string;
  categoryIcon: string;
  categoryColor: string;
}

const TABLE_DESCRIPTIONS: Record<string, string> = {
  // Core Booking
  'MED_Book': 'הזמנות מאושרות - מחירים, תאריכים, סטטוס, ספקים',
  'MED_PreBook': 'הזמנות בהמתנה (Pre-Book) - טוקנים, מחירים, ספקים',
  'MED_CancelBook': 'ביטולי הזמנות - סיבות ביטול, תאריכי ביטול',
  'MED_\u05F9O\u05F9\u05F9pportunities': 'הזדמנויות קנייה/מכירה - מחירים, תאריכים, Push',
  'Queue': 'תור עיבוד - הזמנות בתהליך, סטטוסים',

  // Hotels
  'Med_Hotels': 'מאגר מלונות ראשי - שמות, מזהי ספקים, קטגוריות',
  'Med_Hotels_instant': 'מלונות Innstant - כוכבים, מדינה, קואורדינטות',
  'Med_Hotels_ratebycat': 'תעריפי מלונות לפי קטגוריה וחדר',
  'MED_HotelRate': 'שיוך תעריפים - Board + Category = Rate',
  'MED_HotelsToSearch': 'מלונות לחיפוש אוטומטי',
  'Med_HotelsToPush': 'מלונות להעלאה ל-Zenith - סטטוס Push',

  // Geography
  'Destinations': 'יעדים - ערים, אזורים, מדינות עם קואורדינטות',
  'DestinationsHotels': 'שיוך מלונות ליעדים (Many-to-Many)',

  // Search & AI
  'AI_Search_HotelData': 'נתוני AI לחיפוש - מחירי מלונות, תאריכים, חדרים',
  'MED_SearchHotels': 'תוצאות חיפוש מלונות - מחירים, ספקים, ביטולים',
  'SearchResultsSessionPollLog': 'לוג סשנים של חיפוש - מחירים, חדרים, ספקים',
  'ManualSearchResultsSessionPollLog': 'חיפושים ידניים - תוצאות עם פרטים מלאים',
  'PreSearchResultsSessionPollLog': 'לוג Pre-Search - בקשות ותגובות JSON',
  'ConversationMemory': 'זיכרון שיחות AI - מפתחות, ערכים, תוקף',

  // Reservations
  'Med_Reservation': 'הזמנות נכנסות (Reservations) - סכומים, תאריכים, סטטוס',
  'Med_ReservationCancel': 'ביטולי הזמנות נכנסות',
  'Med_ReservationModify': 'שינויי הזמנות נכנסות',
  'Med_ReservationCustomerName': 'שמות לקוחות של הזמנות נכנסות',
  'Med_ReservationCustomerMoreInfo': 'פרטי לקוח מורחבים - אימייל, כתובת, כרטיס',
  'Med_ReservationModifyCustomerName': 'שמות לקוחות בשינויי הזמנות',
  'Med_ReservationModifyCustomerMoreInfo': 'פרטי לקוח מורחבים בשינויי הזמנות',
  'Med_ReservationNotificationLog': 'לוג התראות הזמנות נכנסות',
  'Med_CustomersReservation': 'לקוחות של הזמנות - שם, אימייל, טלפון, כתובת',

  // Customer Data
  'Med_BookCustomerName': 'שמות לקוחות של הזמנות - שם פרטי, משפחה',
  'Med_BookCustomerMoreInfo': 'פרטי לקוח מורחבים - אימייל, טלפון, כרטיס אשראי',
  'MED_CustomerFNames': 'רשימת שמות פרטיים (1,000 שמות)',
  'MED_CustomerLNames': 'רשימת שמות משפחה (1,000 שמות)',

  // BackOffice
  'BackOfficeOPT': 'אופציות BackOffice - מחירי קנייה/מכירה, חדרים, יעדים',
  'BackOfficeOptLog': 'לוג פעולות BackOffice - שגיאות ותאריכים',

  // SalesOffice
  'SalesOffice.Log': 'לוג פעולות SalesOffice - הזמנות, פעולות, תוצאות',
  'SalesOffice.Details': 'פרטי הזמנות SalesOffice - חדרים, מחירים, סטטוסים',
  'SalesOffice.Bookings': 'הזמנות SalesOffice',
  'SalesOffice.Orders': 'הזמנות (Orders) של SalesOffice',
  'SalesOffice.LogActionsDictionary': 'מילון פעולות SalesOffice (6 סוגים)',
  'SalesOffice.LogActionsResultDictionary': 'מילון תוצאות פעולות SalesOffice',

  // Auth & Users
  'Med_Users': 'משתמשי המערכת - שם משתמש, סיסמה, סטטוס',
  'Users': 'טבלת משתמשים חדשה - אימייל, שם, תפקיד',
  'Roles': 'תפקידים במערכת (3 תפקידים)',
  'Permissions': 'הרשאות במערכת (32 הרשאות)',
  'RolePermissions': 'שיוך הרשאות לתפקידים',
  'UsersRoles': 'שיוך משתמשים לתפקידים',
  'UserSettings': 'הגדרות משתמש - סכום כסף, תאריך עדכון',
  'UsersCreditCard': 'כרטיסי אשראי של משתמשים',

  // API & Tokens
  'ApiClients': 'לקוחות API - שם, סוד',
  'ApiClientsPermissions': 'הרשאות לקוחות API',
  'ApiPermissions': 'הרשאות API זמינות',
  'AetherTokenStorage': 'טוקנים של Aether - גישה למערכות חיצוניות',

  // Logs
  'MED_Log': 'לוג מערכת כללי - הודעות, תאריכים',
  'MED_OpportunitiesLog': 'לוג הזדמנויות - פעולות, בקשות, תגובות JSON',
  'MED_OpportunityLogs': 'לוג הזדמנויות (טבלה חדשה - ריקה)',
  'MED_PushLog': 'לוג Push ל-Zenith - הצלחות, שגיאות, זמני עיבוד',
  'MED_ReservationLogs': 'לוג הזמנות נכנסות (ריקה)',
  'MED_BookError': 'שגיאות הזמנה - שגיאות, טוקנים, JSON',
  'MED_CancelBookError': 'שגיאות ביטול הזמנה',
  'RoomPriceUpdateLog': 'לוג עדכוני מחירי חדרים',
  'BuyRoomLog': 'לוג קניית חדרים - הזדמנויות, הודעות',

  // Lookups
  'MED_Board': 'סוגי ארוחות - BB, HB, FB וכו\'',
  'MED_RoomCategory': 'קטגוריות חדרים - Standard, Deluxe, Suite...',
  'MED_RoomBedding': 'סוגי מיטות - Single, Double...',
  'MED_RoomConfirmation': 'סוגי אישור חדר',
  'MED_Currency': 'מטבעות (EUR)',
  'Med_Source': 'מקורות נתונים - Innstant, GoGlobal...',

  // Other
  'tprice': 'מחירי יעד לפי חודש ומלון',
  'sysdiagrams': 'דיאגרמות מערכת SQL Server',
  'MSchange_tracking_history': 'היסטוריית שינויים - SQL Change Tracking',
};

interface CategoryInfo {
  name: string;
  icon: string;
  color: string;
  tables: string[];
}

const TABLE_CATEGORIES: CategoryInfo[] = [
  {
    name: 'Core Booking',
    icon: 'book_online',
    color: '#3b82f6',
    tables: ['MED_Book', 'MED_PreBook', 'MED_CancelBook', 'MED_\u05F9O\u05F9\u05F9pportunities', 'Queue']
  },
  {
    name: 'Hotels',
    icon: 'hotel',
    color: '#8b5cf6',
    tables: ['Med_Hotels', 'Med_Hotels_instant', 'Med_Hotels_ratebycat', 'MED_HotelRate', 'MED_HotelsToSearch', 'Med_HotelsToPush']
  },
  {
    name: 'Geography',
    icon: 'place',
    color: '#ec4899',
    tables: ['Destinations', 'DestinationsHotels']
  },
  {
    name: 'Search & AI',
    icon: 'psychology',
    color: '#f59e0b',
    tables: ['AI_Search_HotelData', 'MED_SearchHotels', 'SearchResultsSessionPollLog', 'ManualSearchResultsSessionPollLog', 'PreSearchResultsSessionPollLog', 'ConversationMemory']
  },
  {
    name: 'Reservations',
    icon: 'event_available',
    color: '#14b8a6',
    tables: ['Med_Reservation', 'Med_ReservationCancel', 'Med_ReservationModify', 'Med_ReservationCustomerName', 'Med_ReservationCustomerMoreInfo', 'Med_ReservationModifyCustomerName', 'Med_ReservationModifyCustomerMoreInfo', 'Med_ReservationNotificationLog', 'Med_CustomersReservation']
  },
  {
    name: 'Customer Data',
    icon: 'person',
    color: '#06b6d4',
    tables: ['Med_BookCustomerName', 'Med_BookCustomerMoreInfo', 'MED_CustomerFNames', 'MED_CustomerLNames']
  },
  {
    name: 'BackOffice',
    icon: 'business_center',
    color: '#a855f7',
    tables: ['BackOfficeOPT', 'BackOfficeOptLog']
  },
  {
    name: 'SalesOffice',
    icon: 'store',
    color: '#2563eb',
    tables: ['SalesOffice.Log', 'SalesOffice.Details', 'SalesOffice.Bookings', 'SalesOffice.Orders', 'SalesOffice.LogActionsDictionary', 'SalesOffice.LogActionsResultDictionary']
  },
  {
    name: 'Auth & Users',
    icon: 'admin_panel_settings',
    color: '#059669',
    tables: ['Med_Users', 'Users', 'Roles', 'Permissions', 'RolePermissions', 'UsersRoles', 'UserSettings', 'UsersCreditCard']
  },
  {
    name: 'API & Tokens',
    icon: 'vpn_key',
    color: '#d97706',
    tables: ['ApiClients', 'ApiClientsPermissions', 'ApiPermissions', 'AetherTokenStorage']
  },
  {
    name: 'Logs',
    icon: 'description',
    color: '#64748b',
    tables: ['MED_Log', 'MED_OpportunitiesLog', 'MED_OpportunityLogs', 'MED_PushLog', 'MED_ReservationLogs', 'MED_BookError', 'MED_CancelBookError', 'RoomPriceUpdateLog', 'BuyRoomLog']
  },
  {
    name: 'Lookups',
    icon: 'bookmark',
    color: '#e11d48',
    tables: ['MED_Board', 'MED_RoomCategory', 'MED_RoomBedding', 'MED_RoomConfirmation', 'MED_Currency', 'Med_Source']
  },
  {
    name: 'Other',
    icon: 'more_horiz',
    color: '#78716c',
    tables: ['tprice', 'sysdiagrams', 'MSchange_tracking_history']
  }
];

@Component({
  selector: 'app-database-catalog',
  templateUrl: './database-catalog.component.html',
  styleUrls: ['./database-catalog.component.scss']
})
export class DatabaseCatalogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  allTables: TableCatalogEntry[] = [];
  filteredTables: TableCatalogEntry[] = [];
  isLoading = false;
  searchText = '';
  selectedCategory = '';
  categories = TABLE_CATEGORIES;

  selectedTable: TableCatalogEntry | null = null;
  sampleData: Record<string, unknown>[] = [];
  sampleColumns: string[] = [];
  isLoadingSample = false;

  constructor(
    private dataExplorerService: DataExplorerService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTables();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTables(): void {
    this.isLoading = true;
    this.dataExplorerService.getAllTables()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const tables = response.tables || [];
          this.allTables = tables.map((t: TableInfo) => {
            const catInfo = this.getCategoryForTable(t.TableName);
            return {
              ...t,
              description: TABLE_DESCRIPTIONS[t.TableName] || 'טבלת מערכת',
              category: catInfo.name,
              categoryIcon: catInfo.icon,
              categoryColor: catInfo.color
            };
          });
          this.filterTables();
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.snackBar.open('Failed to load tables', 'Close', { duration: 4000 });
        }
      });
  }

  private getCategoryForTable(tableName: string): CategoryInfo {
    for (const cat of TABLE_CATEGORIES) {
      if (cat.tables.includes(tableName)) {
        return cat;
      }
    }
    return { name: 'Other', icon: 'more_horiz', color: '#78716c', tables: [] };
  }

  filterTables(): void {
    let result = [...this.allTables];

    if (this.selectedCategory) {
      result = result.filter(t => t.category === this.selectedCategory);
    }

    if (this.searchText.trim()) {
      const search = this.searchText.toLowerCase();
      result = result.filter(t =>
        t.TableName.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      );
    }

    this.filteredTables = result;
  }

  onCategoryClick(categoryName: string): void {
    this.selectedCategory = this.selectedCategory === categoryName ? '' : categoryName;
    this.filterTables();
  }

  selectTable(table: TableCatalogEntry): void {
    if (this.selectedTable?.TableName === table.TableName) {
      this.selectedTable = null;
      this.sampleData = [];
      this.sampleColumns = [];
      return;
    }

    this.selectedTable = table;
    this.sampleData = [];
    this.sampleColumns = [];
    this.isLoadingSample = true;

    this.dataExplorerService.queryTable(table.TableName, { limit: 10, offset: 0 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.sampleData = response.data || [];
          if (this.sampleData.length > 0) {
            this.sampleColumns = Object.keys(this.sampleData[0]);
          }
          this.isLoadingSample = false;
        },
        error: (err) => {
          this.isLoadingSample = false;
          this.snackBar.open(
            'Cannot load sample: ' + (err.error?.error || err.message || 'Unknown error'),
            'Close',
            { duration: 4000 }
          );
        }
      });
  }

  getCellValue(row: Record<string, unknown>, column: string): string {
    const value = row[column];
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      const json = JSON.stringify(value);
      return json.length > 100 ? json.substring(0, 100) + '...' : json;
    }
    const str = String(value);
    return str.length > 80 ? str.substring(0, 80) + '...' : str;
  }

  formatNumber(value: number): string {
    if (value === null || value === undefined) return '0';
    return value.toLocaleString();
  }

  formatSize(sizeMB: number): string {
    if (!sizeMB) return '< 1 MB';
    if (sizeMB >= 1024) {
      return (sizeMB / 1024).toFixed(1) + ' GB';
    }
    return sizeMB + ' MB';
  }

  getTotalRows(): number {
    return this.allTables.reduce((sum, t) => sum + (t.RowCount || 0), 0);
  }

  getTotalSize(): number {
    return this.allTables.reduce((sum, t) => sum + (t.SizeMB || 0), 0);
  }

  getCategoryCount(categoryName: string): number {
    return this.allTables.filter(t => t.category === categoryName).length;
  }
}
