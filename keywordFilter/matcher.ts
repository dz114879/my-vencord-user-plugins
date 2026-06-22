/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { KeywordRule } from "./model";
import { createKeywordRuleMatcher } from "./ruleMatcher";

const ruleMatcher = createKeywordRuleMatcher(2000);

function getMessageCacheKey(message: any): string | null {
    return typeof message?.id === "string" && message.id.length > 0
        ? message.id
        : null;
}

export function rebuildRuleCaches(rules: KeywordRule[]) {
    ruleMatcher.rebuildRuleCaches(rules);
}

export function resetRuleMatcher() {
    ruleMatcher.reset();
}

export function shouldHideMessage(message: any) {
    const content = message?.content;
    if (typeof content !== "string" || content.length === 0) return false;

    return ruleMatcher.shouldHide(getMessageCacheKey(message), content);
}
