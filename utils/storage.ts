/**
 * Storage utilities for tracking followed users and settings.
 */

import { browser } from 'wxt/browser';

export interface Settings {
    minDelay: number;
    maxDelay: number;
    skipFollowed: boolean;
}

const DEFAULT_SETTINGS: Settings = {
    minDelay: 1500,
    maxDelay: 4000,
    skipFollowed: true,
};

const STORAGE_KEYS = {
    FOLLOWED_USERS: 'followedUsers',
    SETTINGS: 'settings',
};

/**
 * Add a user to the followed list
 */
export async function markAsFollowed(handle: string): Promise<void> {
    const result = await browser.storage.local.get(STORAGE_KEYS.FOLLOWED_USERS);
    const followed = new Set<string>(result[STORAGE_KEYS.FOLLOWED_USERS] || []);
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
    const followed = new Set<string>(result[STORAGE_KEYS.FOLLOWED_USERS] || []);
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
