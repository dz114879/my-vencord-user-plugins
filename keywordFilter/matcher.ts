/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { KeywordRule } from "./model";

interface MessageMatchCacheEntry {
    content: string;
    rulesVersion: number;
    shouldHide: boolean;
}

const MAX_MESSAGE_CACHE_SIZE = 2000;

let plainKeywords: string[] = [];
let regexPatterns: RegExp[] = [];
let rulesVersion = 0;
const messageMatchCache = new Map<string, MessageMatchCacheEntry>();

function clearMessageMatchCache() {
    messageMatchCache.clear();
}

function getMessageCacheKey(message: any): string | null {
    return typeof message?.id === "string" && message.id.length > 0
        ? message.id
        : null;
}

function setCachedMessageMatch(messageId: string, content: string, shouldHide: boolean) {
    if (messageMatchCache.size >= MAX_MESSAGE_CACHE_SIZE) {
        const oldestMessageId = messageMatchCache.keys().next().value;
        if (oldestMessageId != null) {
            messageMatchCache.delete(oldestMessageId);
        }
    }

    messageMatchCache.set(messageId, {
        content,
        rulesVersion,
        shouldHide
    });
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

export function rebuildRuleCaches(rules: KeywordRule[]) {
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
    clearMessageMatchCache();
}

export function resetRuleMatcher() {
    plainKeywords = [];
    regexPatterns = [];
    rulesVersion = 0;
    clearMessageMatchCache();
}

export function shouldHideMessage(message: any) {
    const content = message?.content;
    if (typeof content !== "string" || content.length === 0) return false;
    if (plainKeywords.length === 0 && regexPatterns.length === 0) return false;

    const messageId = getMessageCacheKey(message);
    if (messageId != null) {
        const cached = messageMatchCache.get(messageId);
        if (cached != null && cached.content === content && cached.rulesVersion === rulesVersion) {
            return cached.shouldHide;
        }
    }

    const shouldHide = matchesContent(content);

    if (messageId != null) {
        setCachedMessageMatch(messageId, content, shouldHide);
    }

    return shouldHide;
}
