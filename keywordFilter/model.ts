/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface KeywordRule {
    keyword: string;
    isRegex: boolean;
    id: string;
}

export interface NormalizedKeywordRules {
    rules: KeywordRule[];
    changed: boolean;
}

export const makeEmptyRule = (): KeywordRule => ({
    keyword: "",
    isRegex: false,
    id: crypto.randomUUID()
});

export function serializeKeywordRules(rules: KeywordRule[]): string {
    return rules.map(rule => `${rule.id}\u0000${rule.isRegex ? 1 : 0}\u0000${rule.keyword}`).join("\u0001");
}

export function cloneKeywordRules(rules: KeywordRule[]): KeywordRule[] {
    return rules.map(rule => ({ ...rule }));
}

export function normalizeKeywordRules(value: unknown): NormalizedKeywordRules {
    if (!Array.isArray(value) || value.length === 0) {
        return {
            rules: [makeEmptyRule()],
            changed: true
        };
    }

    let changed = false;
    const rules: KeywordRule[] = [];

    for (const entry of value) {
        if (entry == null || typeof entry !== "object") {
            changed = true;
            continue;
        }

        const candidate = entry as Partial<KeywordRule>;
        const keyword = typeof candidate.keyword === "string" ? candidate.keyword : "";
        const isRegex = typeof candidate.isRegex === "boolean" ? candidate.isRegex : Boolean(candidate.isRegex);
        const id = typeof candidate.id === "string" && candidate.id.length > 0
            ? candidate.id
            : crypto.randomUUID();

        if (candidate.keyword !== keyword || candidate.isRegex !== isRegex || candidate.id !== id) {
            changed = true;
        }

        rules.push({ keyword, isRegex, id });
    }

    if (rules.length === 0) {
        return {
            rules: [makeEmptyRule()],
            changed: true
        };
    }

    if (rules.length !== value.length) {
        changed = true;
    }

    return {
        rules,
        changed
    };
}
