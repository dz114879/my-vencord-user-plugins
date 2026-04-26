/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";

import { rebuildRuleCaches, resetRuleMatcher, shouldHideMessage } from "./matcher";
import { type KeywordRule,makeEmptyRule, normalizeKeywordRules } from "./model";
import { KeywordList } from "./settingsView";

function hasConfiguredKeywordRules(rules: KeywordRule[]) {
    return rules.some(rule => rule.keyword.trim().length > 0);
}

function resolveKeywordRules(keywordsValue: unknown, legacyRulesValue: unknown) {
    const normalizedKeywords = normalizeKeywordRules(keywordsValue);

    if (!Array.isArray(legacyRulesValue)) {
        return {
            rules: normalizedKeywords.rules,
            shouldPersistKeywords: normalizedKeywords.changed,
            shouldClearLegacyRules: false
        };
    }

    const normalizedLegacyRules = normalizeKeywordRules(legacyRulesValue);
    const shouldMigrateLegacyRules = hasConfiguredKeywordRules(normalizedLegacyRules.rules)
        && !hasConfiguredKeywordRules(normalizedKeywords.rules);

    return {
        rules: shouldMigrateLegacyRules ? normalizedLegacyRules.rules : normalizedKeywords.rules,
        shouldPersistKeywords: normalizedKeywords.changed || shouldMigrateLegacyRules,
        shouldClearLegacyRules: true
    };
}

const settings = definePluginSettings({
    rules: {
        type: OptionType.COMPONENT,
        component: () => {
            const { keywords, rules } = settings.use(["keywords", "rules"]);
            const resolved = React.useMemo(() => resolveKeywordRules(keywords, rules), [keywords, rules]);

            React.useEffect(() => {
                if (resolved.shouldPersistKeywords) {
                    settings.store.keywords = resolved.rules;
                }

                if (resolved.shouldClearLegacyRules) {
                    delete (settings.store as typeof settings.store & { rules?: unknown; }).rules;
                }
            }, [resolved]);

            return (
                <KeywordList
                    rules={resolved.rules}
                    setRules={rules => { settings.store.keywords = normalizeKeywordRules(rules).rules; }}
                />
            );
        }
    },
    keywords: {
        type: OptionType.CUSTOM,
        default: [makeEmptyRule()],
        onChange: (keywords: KeywordRule[]) => rebuildRuleCaches(normalizeKeywordRules(keywords).rules)
    }
});

export default definePlugin({
    name: "KeywordFilter",
    description: "Hide messages containing specified keywords or regex patterns",
    tags: ["Chat", "Utility"],
    authors: [{ name: "KKTsN", id: 0n }],
    settings,

    patches: [{
        find: "Message must not be a thread starter message",
        replacement: {
            match: /"aria-setsize":-1,(?=.{0,150}?#{intl::MESSAGE_A11Y_ROLE_DESCRIPTION})/,
            replace: "hidden:$self.shouldHide(arguments[0].message),$&"
        }
    }],

    start() {
        const resolved = resolveKeywordRules(
            settings.store.keywords,
            (settings.plain as typeof settings.plain & { rules?: unknown; }).rules
        );

        if (resolved.shouldPersistKeywords) {
            settings.store.keywords = resolved.rules;
        }

        if (resolved.shouldClearLegacyRules) {
            delete (settings.store as typeof settings.store & { rules?: unknown; }).rules;
        }

        rebuildRuleCaches(resolved.rules);
    },

    stop() {
        resetRuleMatcher();
    },

    shouldHide(message: any) {
        return shouldHideMessage(message);
    }
});
