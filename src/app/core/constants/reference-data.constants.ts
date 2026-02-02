/**
 * Reference Data Constants
 * GPT Best Practices Implementation
 * Based on database tables: MED_Board, MED_RoomCategory, Med_Source
 */

/**
 * Board Types (Meal Plans)
 * From MED_Board table
 */
export const BOARD_TYPES = {
  RO: { id: 1, code: 'RO', name: 'Room Only', description: 'No meals included' },
  BB: { id: 2, code: 'BB', name: 'Bed & Breakfast', description: 'Breakfast included' },
  HB: { id: 3, code: 'HB', name: 'Half Board', description: 'Breakfast + Dinner' },
  FB: { id: 4, code: 'FB', name: 'Full Board', description: 'Breakfast + Lunch + Dinner' },
  AI: { id: 5, code: 'AI', name: 'All Inclusive', description: 'All meals and drinks' }
} as const;

export const BOARD_OPTIONS = [
  { value: 1, label: 'RO - Room Only', code: 'RO' },
  { value: 2, label: 'BB - Bed & Breakfast', code: 'BB' },
  { value: 3, label: 'HB - Half Board', code: 'HB' },
  { value: 4, label: 'FB - Full Board', code: 'FB' },
  { value: 5, label: 'AI - All Inclusive', code: 'AI' }
];

/**
 * Room Categories
 * From MED_RoomCategory table
 */
export const ROOM_CATEGORIES = {
  STANDARD: { id: 1, name: 'Standard', pmsCode: 'STD' },
  SUPERIOR: { id: 2, name: 'Superior', pmsCode: 'SUP' },
  DELUXE: { id: 3, name: 'Deluxe', pmsCode: 'DLX' },
  SUITE: { id: 4, name: 'Suite', pmsCode: 'STE' }
} as const;

export const CATEGORY_OPTIONS = [
  { value: 1, label: 'Standard', code: 'STD' },
  { value: 2, label: 'Superior', code: 'SUP' },
  { value: 3, label: 'Deluxe', code: 'DLX' },
  { value: 4, label: 'Suite', code: 'STE' }
];

/**
 * Provider/Source IDs
 * From Med_Source table
 */
export const PROVIDERS = {
  INNSTANT: { id: 1, name: 'Innstant', isActive: true },
  GOGLOBAL: { id: 2, name: 'GoGlobal', isActive: true },
  MANUAL: { id: 99, name: 'Manual', isActive: true }
} as const;

export const PROVIDER_OPTIONS = [
  { value: 1, label: 'Innstant' },
  { value: 2, label: 'GoGlobal' },
  { value: 99, label: 'Manual Entry' }
];

/**
 * GPT Pricing Rules
 * BuyPrice = sourcePrice + MARGIN
 * PushPrice = sourcePrice + MARKUP
 */
export const PRICING_RULES = {
  BUY_MARGIN: 10,    // Add $10 to source price for buy price
  PUSH_MARKUP: 50    // Add $50 to source price for push price
} as const;

/**
 * Helper Functions
 */
export function getBoardNameById(boardId: number): string {
  const board = Object.values(BOARD_TYPES).find(b => b.id === boardId);
  return board ? board.name : 'Unknown';
}

export function getBoardCodeById(boardId: number): string {
  const board = Object.values(BOARD_TYPES).find(b => b.id === boardId);
  return board ? board.code : '';
}

export function getCategoryNameById(categoryId: number): string {
  const category = Object.values(ROOM_CATEGORIES).find(c => c.id === categoryId);
  return category ? category.name : 'Unknown';
}

export function getProviderNameById(providerId: number): string {
  const provider = Object.values(PROVIDERS).find(p => p.id === providerId);
  return provider ? provider.name : 'Unknown';
}

/**
 * Calculate prices based on GPT rules
 */
export function calculatePrices(sourcePrice: number) {
  return {
    sourcePrice: sourcePrice,
    buyPrice: sourcePrice + PRICING_RULES.BUY_MARGIN,
    pushPrice: sourcePrice + PRICING_RULES.PUSH_MARKUP,
    profit: PRICING_RULES.PUSH_MARKUP - PRICING_RULES.BUY_MARGIN,
    margin: ((PRICING_RULES.PUSH_MARKUP - PRICING_RULES.BUY_MARGIN) / (sourcePrice + PRICING_RULES.PUSH_MARKUP)) * 100
  };
}

/**
 * Date validation helpers
 */
export function validateDateRange(dateFrom: string, dateTo: string, searchDateFrom?: string, searchDateTo?: string): { valid: boolean; error?: string } {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  
  if (from >= to) {
    return { valid: false, error: 'Check-out date must be after check-in date' };
  }
  
  if (searchDateFrom && searchDateTo) {
    const searchFrom = new Date(searchDateFrom);
    const searchTo = new Date(searchDateTo);
    
    if (from < searchFrom || to > searchTo) {
      return { 
        valid: false, 
        error: `Dates must be within search range (${searchDateFrom} to ${searchDateTo})` 
      };
    }
  }
  
  return { valid: true };
}

/**
 * Format children array for API calls
 * GPT Default: empty array (not null)
 */
export function formatChildrenArray(children: number[] | null | undefined): number[] {
  if (!children || !Array.isArray(children)) {
    return [];
  }
  return children.filter(age => age >= 0 && age <= 17);
}
