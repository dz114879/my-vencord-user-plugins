/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { React, TextInput, useState } from "@webpack/common";

const cl = classNameFactory("vc-reactionfilter-");
const REACTION_BAR_SELECTOR = '[id*="message-reactions"]';
const REACTION_COUNT_SELECTOR = '[class*="reactionCount"]';

let observer: MutationObserver | null = null;
let isRunning = false;

interface EmojiEntry {
    raw: string;
    emojiName: string;
    emojiId: string | null;
    id: string;
}

const CUSTOM_EMOJI_RE = /^<a?:(\w+):(\d+)>$/;

function parseEmojiInput(raw: string): Pick<EmojiEntry, "emojiName" | "emojiId"> | null {
    if (!raw.trim()) return null;

    const customMatch = raw.match(CUSTOM_EMOJI_RE);
    if (customMatch) {
        return { emojiName: customMatch[1], emojiId: customMatch[2] };
    }

    const colonMatch = raw.match(/^:(.+):$/);
    if (colonMatch) {
        return { emojiName: colonMatch[1], emojiId: null };
    }

    return { emojiName: raw, emojiId: null };
}

function makeEmptyEntry(): EmojiEntry {
    return { raw: "", emojiName: "", emojiId: null, id: crypto.randomUUID() };
}

function EmojiInput({ entry, onChange, onDelete }: {
    entry: EmojiEntry;
    onChange: (raw: string) => void;
    onDelete: () => void;
}) {
    const [value, setValue] = useState(entry.raw);

    return (
        <div className={cl("entry")}>
            <TextInput
                placeholder="<:name:id> or emoji character"
                value={value}
                onChange={setValue}
                spellCheck={false}
                onBlur={() => value !== entry.raw && onChange(value)}
            />
            <Button
                size="small"
                variant="dangerPrimary"
                onClick={onDelete}
            >
                X
            </Button>
        </div>
    );
}

function EmojiList({ entries }: { entries: EmojiEntry[]; }) {
    const [, forceUpdate] = useState(0);
    const rerender = () => forceUpdate(n => n + 1);

    function onChange(index: number, raw: string) {
        const parsed = parseEmojiInput(raw);
        if (parsed) {
            entries[index] = { ...parsed, raw, id: entries[index].id };
        } else {
            entries[index].raw = raw;
        }
        if (!raw && index !== entries.length - 1) {
            entries.splice(index, 1);
        }
        rerender();
    }

    function onDelete(index: number) {
        entries.splice(index, 1);
        if (entries.length === 0) entries.push(makeEmptyEntry());
        rerender();
    }

    return (
        <div>
            <HeadingSecondary>Emoji Blocklist</HeadingSecondary>
            <Paragraph>
                Reactions using these emojis will be hidden.
            </Paragraph>
            <Paragraph className={cl("hint")}>
                Custom emoji: <code>&lt;:name:id&gt;</code> | Unicode: paste the emoji character directly
            </Paragraph>
            <Flex flexDirection="column" style={{ gap: "0.5em", marginTop: "0.5em" }}>
                {entries.map((entry, i) => (
                    <EmojiInput
                        key={entry.id}
                        entry={entry}
                        onChange={raw => onChange(i, raw)}
                        onDelete={() => onDelete(i)}
                    />
                ))}
                <Button
                    onClick={() => { entries.push(makeEmptyEntry()); rerender(); }}
                    disabled={entries.length > 0 && !entries[entries.length - 1].raw}
                >
                    Add Emoji
                </Button>
            </Flex>
        </div>
    );
}

const settings = definePluginSettings({
    filterMode: {
        type: OptionType.SELECT,
        description: "Which reactions to hide",
        options: [
            { label: "Hide on all messages", value: "all", default: true },
            { label: "Only hide my own reactions", value: "own" },
        ]
    },
    emojiListComponent: {
        type: OptionType.COMPONENT,
        component: () => {
            const { emojiList } = settings.use(["emojiList"]);
            return <EmojiList entries={emojiList} />;
        }
    },
    emojiList: {
        type: OptionType.CUSTOM,
        default: [makeEmptyEntry()],
    }
});

function updateReactionBar(bar: Element) {
    if (!(bar instanceof HTMLElement)) return;

    const hasVisibleReaction = bar.querySelector(REACTION_COUNT_SELECTOR) != null;
    bar.classList.toggle(cl("empty-bar"), !hasVisibleReaction);
}

function refreshReactionBars(root: ParentNode = document) {
    if (root instanceof Element && root.matches(REACTION_BAR_SELECTOR)) {
        updateReactionBar(root);
    }

    if (!root.querySelectorAll) return;

    for (const bar of root.querySelectorAll(REACTION_BAR_SELECTOR)) {
        updateReactionBar(bar);
    }
}

let refreshQueued = false;

function queueReactionBarRefresh() {
    if (refreshQueued) return;

    refreshQueued = true;
    requestAnimationFrame(() => {
        if (!isRunning) {
            refreshQueued = false;
            return;
        }

        refreshQueued = false;
        refreshReactionBars();
    });
}

export default definePlugin({
    name: "ReactionFilter",
    description: "Hide reactions from specific emojis",
    tags: ["Reactions", "Utility"],
    authors: [{ name: "KKTsN", id: 0n }],
    settings,

    patches: [{
        find: ",reactionRef:",
        replacement: {
            match: /render\(\)\{(?=.{0,500}reactionRef)/,
            replace: "$&if($self.shouldHide(this.props))return null;"
        }
    }],

    start() {
        settings.store.emojiList.forEach((entry: EmojiEntry) => entry.id ??= crypto.randomUUID());

        isRunning = true;
        observer?.disconnect();
        observer = new MutationObserver(() => queueReactionBarRefresh());

        if (!document.body) return;

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        queueReactionBarRefresh();
    },

    stop() {
        isRunning = false;
        observer?.disconnect();
        observer = null;
        refreshQueued = false;

        for (const bar of document.querySelectorAll(`.${cl("empty-bar")}`)) {
            bar.classList.remove(cl("empty-bar"));
        }
    },

    shouldHide(props: { emoji: { id: string | null; name: string; }; me: boolean; }) {
        const { emoji, me } = props;
        const mode = settings.store.filterMode;

        if (mode === "own" && !me) return false;

        const list: EmojiEntry[] = settings.store.emojiList;
        for (const entry of list) {
            if (!entry.raw) continue;
            if (entry.emojiId && emoji.id === entry.emojiId) return true;
            if (!entry.emojiId && emoji.name === entry.emojiName) return true;
        }
        return false;
    }
});
