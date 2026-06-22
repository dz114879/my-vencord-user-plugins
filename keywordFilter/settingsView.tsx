/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { React, TextInput, useState } from "@webpack/common";
import type { ReactNode } from "react";

import { cloneKeywordRules, type KeywordRule,makeEmptyRule, serializeKeywordRules } from "./model";
import { analyzeRegexPattern, type RegexDiagnostic, type RegexDiagnosticSeverity } from "./regexDiagnostics";

const cl = classNameFactory("vc-keywordfilter-");

const severityLabels: Record<RegexDiagnosticSeverity, string> = {
    error: "Error",
    warning: "Warning",
    info: "Tip"
};

function RegexDiagnostics({ pattern }: { pattern: string; }) {
    const diagnostics = React.useMemo(() => analyzeRegexPattern(pattern), [pattern]);
    if (diagnostics.length === 0) return null;

    return (
        <div className={cl("regex-diagnostics")}>
            {diagnostics.map((diagnostic, index) => (
                <RegexDiagnosticRow
                    key={`${diagnostic.severity}-${diagnostic.message}-${index}`}
                    diagnostic={diagnostic}
                />
            ))}
        </div>
    );
}

function RegexDiagnosticRow({ diagnostic }: { diagnostic: RegexDiagnostic; }) {
    return (
        <div className={`${cl("regex-diagnostic")} ${cl(`regex-diagnostic-${diagnostic.severity}`)}`}>
            <span className={cl("regex-diagnostic-label")}>{severityLabels[diagnostic.severity]}:</span>
            <span>{diagnostic.message}</span>
        </div>
    );
}

function KeywordInput({ rule, onChange, onDelete }: {
    rule: KeywordRule;
    onChange: (updates: Partial<KeywordRule>) => void;
    onDelete: () => void;
}) {
    return (
        <div>
            <div className={cl("rule")}>
                <TextInput
                    placeholder={rule.isRegex ? "正则表达式..." : "关键词..."}
                    value={rule.keyword}
                    onChange={keyword => onChange({ keyword })}
                    spellCheck={false}
                />
                <Button
                    size="small"
                    className={cl("regex-toggle")}
                    variant={rule.isRegex ? "primary" : "secondary"}
                    onClick={() => onChange({ isRegex: !rule.isRegex })}
                >
                    .*
                </Button>
                <Button
                    size="small"
                    variant="dangerPrimary"
                    onClick={onDelete}
                >
                    X
                </Button>
            </div>
            {rule.isRegex && <RegexDiagnostics pattern={rule.keyword} />}
        </div>
    );
}

interface KeywordListProps {
    rules: KeywordRule[];
    setRules: (rules: KeywordRule[]) => void;
    title?: string;
    description?: ReactNode;
}

export function KeywordList({
    rules,
    setRules,
    title = "Keyword Filter Rules",
    description = (
        <>
            Add keywords or regex patterns to filter. Matching messages will be completely hidden.
            Click <code style={{ fontFamily: "monospace" }}>.*</code> to toggle regex mode.
            Regex rules are also analyzed for invalid syntax and patterns that may be expensive.
        </>
    )
}: KeywordListProps) {
    const [draftRules, setDraftRules] = useState(() => cloneKeywordRules(rules));
    const pendingRulesSignatureRef = React.useRef<string | null>(null);
    const rulesSignature = React.useMemo(() => serializeKeywordRules(rules), [rules]);

    React.useEffect(() => {
        const nextRules = cloneKeywordRules(rules);

        setDraftRules(currentRules => {
            const currentSignature = serializeKeywordRules(currentRules);

            if (pendingRulesSignatureRef.current != null) {
                if (pendingRulesSignatureRef.current === rulesSignature) {
                    pendingRulesSignatureRef.current = null;
                    return currentSignature === rulesSignature ? currentRules : nextRules;
                }

                return currentRules;
            }

            return currentSignature === rulesSignature ? currentRules : nextRules;
        });
    }, [rules, rulesSignature]);

    function commitRules(nextRules: KeywordRule[]) {
        const committedRules = nextRules.length > 0 ? nextRules : [makeEmptyRule()];
        const clonedRules = cloneKeywordRules(committedRules);
        pendingRulesSignatureRef.current = serializeKeywordRules(clonedRules);
        setDraftRules(clonedRules);
        setRules(clonedRules);
    }

    function onChange(index: number, updates: Partial<KeywordRule>) {
        if (index < 0 || index >= draftRules.length) return;

        const nextRules = cloneKeywordRules(draftRules);
        nextRules[index] = {
            ...nextRules[index],
            ...updates
        };

        if (!nextRules[index].keyword && index !== nextRules.length - 1) {
            nextRules.splice(index, 1);
        }

        commitRules(nextRules);
    }

    function onDelete(index: number) {
        if (index < 0 || index >= draftRules.length) return;
        commitRules(draftRules.filter((_, i) => i !== index));
    }

    return (
        <div>
            <HeadingSecondary>{title}</HeadingSecondary>
            <Paragraph>
                {description}
            </Paragraph>
            <Flex flexDirection="column" style={{ gap: "0.5em", marginTop: "0.5em" }}>
                {draftRules.map((rule, i) => (
                    <KeywordInput
                        key={rule.id}
                        rule={rule}
                        onChange={updates => onChange(i, updates)}
                        onDelete={() => onDelete(i)}
                    />
                ))}
                <Button
                    onClick={() => commitRules([...draftRules, makeEmptyRule()])}
                    disabled={draftRules.length > 0 && !draftRules[draftRules.length - 1].keyword}
                >
                    Add Rule
                </Button>
            </Flex>
        </div>
    );
}
