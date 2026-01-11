/**
 * Storage utilities for tracking followed users and settings.
 */

import { browser } from 'wxt/browser';

export interface Settings {
    minDelay: number;
    maxDelay: number;
    skipFollowed: boolean;
    rateLimitThreshold: number;
    rateLimitDuration: number;
    dailyFollowLimit: number;
}

const DEFAULT_SETTINGS: Settings = {
    minDelay: 1500,
    maxDelay: 4000,
    skipFollowed: true,
    rateLimitThreshold: 10,
    rateLimitDuration: 600000,
    dailyFollowLimit: 100,
};

const STORAGE_KEYS = {
    FOLLOWED_USERS: 'followedUsers',
    SETTINGS: 'settings',
    RATE_LIMIT_STATE: 'rateLimitState',
    DAILY_STATS: 'dailyStats',
    DAILY_LIMIT_STATE: 'dailyLimitState',
};

export interface DailyFollowStats {
    date: string;
    count: number;
}

export interface DailyStatsHistory {
    today: DailyFollowStats;
    history: DailyFollowStats[];
}

export interface DailyLimitState {
    isLimited: boolean;
    limitReachedAt: number | null;
}

export interface RateLimitState {
    pauseUntil: number;
    successSinceLastPause: number;
}

/**
 * Add a user to the followed list
 */
export async function markAsFollowed(handle: string): Promise<void> {
    const result = await browser.storage.local.get(STORAGE_KEYS.FOLLOWED_USERS);
    const followedArray = result[STORAGE_KEYS.FOLLOWED_USERS] as string[] || [];
    const followed = new Set<string>(followedArray);
    followed.add(handle);
    await browser.storage.local.set({
        [STORAGE_KEYS.FOLLOWED_USERS]: Array.from(followed)
    });
}

/**
 * Check if a user has been followed
 */
export async function isFollowed(handle: string): Promise<boolean> {
    const result = await browser.storage.local.get(STORAGE_KEYS.FOLLOWED_USERS);
    const followedArray = result[STORAGE_KEYS.FOLLOWED_USERS] as string[] || [];
    const followed = new Set<string>(followedArray);
    return followed.has(handle);
}

/**
 * Reset the followed users history
 */
export async function resetFollowedHistory(): Promise<void> {
    await browser.storage.local.set({
        [STORAGE_KEYS.FOLLOWED_USERS]: []
    });
}

/**
 * Get current settings
 */
export async function getSettings(): Promise<Settings> {
    const result = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
}

/**
 * Update settings
 */
export async function updateSettings(newSettings: Partial<Settings>): Promise<void> {
    const current = await getSettings();
    await browser.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: { ...current, ...newSettings }
    });
}

export async function getRateLimitState(): Promise<RateLimitState | null> {
    const result = await browser.storage.local.get(STORAGE_KEYS.RATE_LIMIT_STATE);
    const state = result[STORAGE_KEYS.RATE_LIMIT_STATE] as RateLimitState | undefined;
    return state || null;
}

export async function setRateLimitState(state: RateLimitState): Promise<void> {
    await browser.storage.local.set({
        [STORAGE_KEYS.RATE_LIMIT_STATE]: state
    });
}

export async function clearRateLimitState(): Promise<void> {
    await browser.storage.local.remove(STORAGE_KEYS.RATE_LIMIT_STATE);
}

export async function isRateLimited(): Promise<boolean> {
    const state = await getRateLimitState();
    if (!state) return false;
    return Date.now() < state.pauseUntil;
}

function getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function getDailyStats(): Promise<DailyStatsHistory> {
    const result = await browser.storage.local.get(STORAGE_KEYS.DAILY_STATS);
    const savedStats = result[STORAGE_KEYS.DAILY_STATS] as DailyStatsHistory | undefined;
    const today = getTodayDateString();
    
    if (!savedStats) {
        return {
            today: { date: today, count: 0 },
            history: []
        };
    }
    
    // Check if saved today matches current today
    if (savedStats.today.date === today) {
        return savedStats;
    }
    
    // It's a new day, move today to history
    const newHistory = [...savedStats.history, savedStats.today].slice(-30); // Keep last 30 days
    return {
        today: { date: today, count: 0 },
        history: newHistory
    };
}

export async function incrementDailyFollowCount(): Promise<void> {
    const stats = await getDailyStats();
    const today = getTodayDateString();
    
    // If it's a new day, move today to history
    if (stats.today.date !== today) {
        const newHistory = [...stats.history, stats.today].slice(-30);
        stats.history = newHistory;
        stats.today = { date: today, count: 0 };
    }
    
    stats.today.count++;
    
    await browser.storage.local.set({
        [STORAGE_KEYS.DAILY_STATS]: stats
    });
}

export async function isDailyLimitReached(limit: number): Promise<boolean> {
    const stats = await getDailyStats();
    const today = getTodayDateString();
    
    // Check if saved today matches current today
    const currentCount = stats.today.date === today ? stats.today.count : 0;
    return currentCount >= limit;
}

export async function getDailyLimitState(): Promise<DailyLimitState | null> {
    const result = await browser.storage.local.get(STORAGE_KEYS.DAILY_LIMIT_STATE);
    const state = result[STORAGE_KEYS.DAILY_LIMIT_STATE] as DailyLimitState | undefined;
    return state || null;
}

export async function setDailyLimitState(state: DailyLimitState): Promise<void> {
    await browser.storage.local.set({
        [STORAGE_KEYS.DAILY_LIMIT_STATE]: state
    });
}

export async function clearDailyLimitState(): Promise<void> {
    await browser.storage.local.remove(STORAGE_KEYS.DAILY_LIMIT_STATE);
}

export async function checkAndResetDailyStats(): Promise<void> {
    const stats = await getDailyStats();
    const today = getTodayDateString();
    
    // If saved today doesn't match current today, we need to reset
    if (stats.today.date !== today) {
        const newHistory = [...stats.history, stats.today].slice(-30);
        const newStats = {
            today: { date: today, count: 0 },
            history: newHistory
        };
        await browser.storage.local.set({
            [STORAGE_KEYS.DAILY_STATS]: newStats
        });
        await clearDailyLimitState();
    }
}

export async function getTimeUntilMidnight(): Promise<number> {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime() - now.getTime();
}

export async function resetDailyStats(): Promise<void> {
    const today = getTodayDateString();
    await browser.storage.local.set({
        [STORAGE_KEYS.DAILY_STATS]: {
            today: { date: today, count: 0 },
            history: []
        }
    });
    await clearDailyLimitState();
}
