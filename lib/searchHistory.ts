/**
 * Search history management for market intelligence
 */

export interface SearchHistoryEntry {
  id: string;
  query: string;
  filters: {
    countries: string[];
    services: string[];
    companySize: string[];
  };
  totalResults: number;
  timestamp: number;
  searchId?: string;
}

const STORAGE_KEY = 'fymail_intelligence_search_history';
const MAX_ENTRIES = 10;

export function getSearchHistory(): SearchHistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load search history:', error);
    return [];
  }
}

export function addSearchHistory(entry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  
  const history = getSearchHistory();
  const newEntry: SearchHistoryEntry = {
    ...entry,
    id: `hist-${Date.now()}`,
    timestamp: Date.now(),
  };
  
  // Insert at beginning
  history.unshift(newEntry);
  
  // Keep only latest MAX_ENTRIES
  const trimmed = history.slice(0, MAX_ENTRIES);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save search history:', error);
  }
}

export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function removeSearchHistoryEntry(id: string): void {
  if (typeof window === 'undefined') return;
  
  const history = getSearchHistory();
  const filtered = history.filter(entry => entry.id !== id);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove search history entry:', error);
  }
}