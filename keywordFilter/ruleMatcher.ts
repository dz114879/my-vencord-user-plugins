/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { KeywordRule } from "./model";

interface MatchCacheEntry {
    content: string;
    rulesVersion: number;
    shouldHide: boolean;
}

export interface KeywordRuleMatcher {
    rebuildRuleCaches(rules: KeywordRule[]): void;
    reset(): void;
    hasRules(): boolean;
    matchesContent(content: string): boolean;
    shouldHide(cacheKey: string | null, content: string): boolean;
}

export function createKeywordRuleMatcher(maxCacheSize = 2000): KeywordRuleMatcher {
    let plainKeywords: string[] = [];
    let regexPatterns: RegExp[] = [];
    let rulesVersion = 0;
    const matchCache = new Map<string, MatchCacheEntry>();

    function clearMatchCache() {
        matchCache.clear();
    }

    function setCachedMatch(cacheKey: string, content: string, shouldHide: boolean) {
        if (matchCache.size >= maxCacheSize) {
            const oldestCacheKey = matchCache.keys().next().value;
            if (oldestCacheKey != null) {
                matchCache.delete(oldestCacheKey);
            }
        }

        matchCache.set(cacheKey, {
            content,
            rulesVersion,
            shouldHide
        });
    }

    function hasRules() {
        return plainKeywords.length > 0 || regexPatterns.length > 0;
    }

    function matchesContent(content: string) {
        if (plainKeywords.length > 0) {
            const normalizedContent = content.toLowerCase();
            for (const keyword of plainKeywords) {
                if (normalizedContent.includes(keyword)) return true;
            }
        }

        for (const pattern of regexPatterns) {
            if (pattern.test(content)) return true;
        }

        return false;
    }

    function rebuildRuleCaches(rules: KeywordRule[]) {
        const nextPlainKeywords: string[] = [];
        const nextRegexPatterns: RegExp[] = [];
        const seenPlainKeywords = new Set<string>();

        for (const rule of rules) {
            if (!rule.keyword) continue;

            if (!rule.isRegex) {
                const normalizedKeyword = rule.keyword.toLowerCase();
                if (!seenPlainKeywords.has(normalizedKeyword)) {
                    seenPlainKeywords.add(normalizedKeyword);
                    nextPlainKeywords.push(normalizedKeyword);
                }
                continue;
            }

            try {
                nextRegexPatterns.push(new RegExp(rule.keyword, "i"));
            } catch {
                // Invalid regex, skip
            }
        }

        plainKeywords = nextPlainKeywords;
        regexPatterns = nextRegexPatterns;
        rulesVersion++;
        clearMatchCache();
    }

    function reset() {
        plainKeywords = [];
        regexPatterns = [];
        rulesVersion = 0;
        clearMatchCache();
    }

    function shouldHide(cacheKey: string | null, content: string) {
        if (content.length === 0 || !hasRules()) return false;

        if (cacheKey != null) {
            const cached = matchCache.get(cacheKey);
            if (cached != null && cached.content === content && cached.rulesVersion === rulesVersion) {
                return cached.shouldHide;
            }
        }

        const shouldHide = matchesContent(content);

        if (cacheKey != null) {
            setCachedMatch(cacheKey, content, shouldHide);
        }

        return shouldHide;
    }

    return {
        rebuildRuleCaches,
        reset,
        hasRules,
        matchesContent,
        shouldHide
    };
}
