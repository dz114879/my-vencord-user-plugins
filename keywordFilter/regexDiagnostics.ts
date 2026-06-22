/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type RegexDiagnosticSeverity = "error" | "warning" | "info";

export interface RegexDiagnostic {
    severity: RegexDiagnosticSeverity;
    message: string;
}

const severityOrder: Record<RegexDiagnosticSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2
};

const nearMatchAllPatterns = new Set([
    ".*",
    ".+",
    "[\\s\\S]*",
    "[\\s\\S]+",
    "[\\d\\D]*",
    "[\\d\\D]+",
    "(?:.*)",
    "(?:.+)",
    "(?:[\\s\\S]*)",
    "(?:[\\s\\S]+)"
]);

function pushDiagnostic(diagnostics: RegexDiagnostic[], severity: RegexDiagnosticSeverity, message: string) {
    if (diagnostics.some(d => d.severity === severity && d.message === message)) return;
    diagnostics.push({ severity, message });
}

function stripOuterAnchors(pattern: string) {
    let stripped = pattern.trim();
    if (stripped.startsWith("^")) stripped = stripped.slice(1);
    if (stripped.endsWith("$")) stripped = stripped.slice(0, -1);
    return stripped;
}

function hasRedundantContainsWildcards(pattern: string) {
    const stripped = stripOuterAnchors(pattern);
    return (
        (stripped.startsWith(".*") || stripped.startsWith("[\\s\\S]*") || stripped.startsWith("[\\d\\D]*"))
        && (stripped.endsWith(".*") || stripped.endsWith("[\\s\\S]*") || stripped.endsWith("[\\d\\D]*"))
        && stripped.length > 4
    );
}

function hasNestedQuantifier(pattern: string) {
    return /\((?:\?:)?[^()]*[*+][^()]*\)(?:[*+?]|\{\d+(?:,\d*)?\})/.test(pattern);
}

function countGreedyWildcardTokens(pattern: string) {
    const matches = pattern.match(/\.\*|\.\+/g);
    return matches?.length ?? 0;
}

function hasLookaround(pattern: string) {
    return /\(\?(?:=|!|<=|<!)/.test(pattern);
}

function hasBackreference(pattern: string) {
    return /(^|[^\\])\\[1-9]/.test(pattern);
}

function countAlternations(pattern: string) {
    let count = 0;
    let escaped = false;
    let inCharacterClass = false;

    for (const char of pattern) {
        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (char === "[") {
            inCharacterClass = true;
            continue;
        }

        if (char === "]") {
            inCharacterClass = false;
            continue;
        }

        if (!inCharacterClass && char === "|") {
            count++;
        }
    }

    return count;
}

export function analyzeRegexPattern(pattern: string): RegexDiagnostic[] {
    if (!pattern) return [];

    try {
        new RegExp(pattern, "i");
    } catch (error) {
        return [{
            severity: "error",
            message: String(error)
        }];
    }

    const diagnostics: RegexDiagnostic[] = [];
    const stripped = stripOuterAnchors(pattern);

    if (nearMatchAllPatterns.has(stripped)) {
        pushDiagnostic(diagnostics, "warning", "这个正则会匹配几乎所有消息。请确认这是您有意为之。");
    }

    if (hasNestedQuantifier(pattern)) {
        pushDiagnostic(diagnostics, "warning", "这个正则包含嵌套量词，可能会在较长消息上引发灾难性回溯，导致性能严重下降。");
    }

    if (countGreedyWildcardTokens(pattern) >= 2) {
        pushDiagnostic(diagnostics, "warning", "这个正则使用了多个贪婪通配符，这会让匹配速度下降。");
    }

    if (hasBackreference(pattern)) {
        pushDiagnostic(diagnostics, "warning", "这个正则使用了反向引用。它们是合法的，但计算开销更高。");
    }

    if (hasRedundantContainsWildcards(pattern)) {
        pushDiagnostic(diagnostics, "info", "前后的 .* 通常是多余的，因为插件本来就会在整条消息中进行搜索。");
    }

    if (hasLookaround(pattern)) {
        pushDiagnostic(diagnostics, "info", "正则支持环视语法，但它更难理解，而且在复杂输入下可能带来更高开销。");
    }

    if (countAlternations(pattern) >= 6) {
        pushDiagnostic(diagnostics, "info", "这个正则包含很多分支（|）。可以考虑拆分成更简单的规则。");
    }

    if (pattern.length >= 120) {
        pushDiagnostic(diagnostics, "info", "这个正则相当长。更长的表达式更难维护和调试，请确认这是您有意为之。");
    }

    return diagnostics.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
