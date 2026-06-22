/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../keywordFilter/style.css";
import "./style.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, React, SelectedChannelStore } from "@webpack/common";

import { makeEmptyRule, normalizeKeywordRules } from "../keywordFilter/model";
import { createKeywordRuleMatcher } from "../keywordFilter/ruleMatcher";
import { KeywordList } from "../keywordFilter/settingsView";

const HIDDEN_CLASS = "vc-posttitlefilter-hidden";
const SNOWFLAKE_REGEX = /\d{17,20}/g;
const POST_CONTAINER_SELECTOR = [
    "[role='listitem']",
    "[role='gridcell']",
    "li",
    "article",
    "[class*='forumPost__']",
    "[class*='postPreviewContainer__']"
].join(",");
const TITLE_SELECTOR = [
    "[role='heading']",
    "h1",
    "h2",
    "h3",
    "[class*='title__']",
    "[class*='titleText__']",
    "[class*='name__']"
].join(",");

const titleMatcher = createKeywordRuleMatcher(1000);

let observer: MutationObserver | null = null;
let scanAnimationFrame = 0;

function getSelectedForumChannel() {
    const channelId = SelectedChannelStore.getChannelId();
    if (typeof channelId !== "string") return null;

    const channel = ChannelStore.getChannel(channelId);
    return channel?.isForumLikeChannel?.() ? channel : null;
}

function getScanRoot() {
    return document.querySelector<HTMLElement>("main")
        ?? document.querySelector<HTMLElement>("[class*='chatContent_']")
        ?? document.querySelector<HTMLElement>("[class*='page_']")
        ?? document.body;
}

function getHiddenThreadIds(parentChannelId: string) {
    const hiddenThreadIds = new Set<string>();
    const threads = ChannelStore.getAllThreadsForParent?.(parentChannelId) ?? [];

    for (const thread of threads) {
        if (typeof thread?.id !== "string" || typeof thread?.name !== "string") continue;
        if (titleMatcher.shouldHide(thread.id, thread.name)) {
            hiddenThreadIds.add(thread.id);
        }
    }

    return hiddenThreadIds;
}

function getReferencedHiddenThreadId(element: Element, hiddenThreadIds: Set<string>) {
    const values = [
        element.getAttribute("href"),
        element.getAttribute("data-list-item-id"),
        element.id,
        element.getAttribute("aria-controls"),
        element.getAttribute("aria-labelledby")
    ];

    for (const value of values) {
        if (!value) continue;

        SNOWFLAKE_REGEX.lastIndex = 0;
        for (const match of value.matchAll(SNOWFLAKE_REGEX)) {
            if (hiddenThreadIds.has(match[0])) return match[0];
        }
    }

    return null;
}

function getTitleText(element: HTMLElement) {
    const titleElement = element.querySelector<HTMLElement>(TITLE_SELECTOR);
    return titleElement?.textContent?.trim() ?? "";
}

function findPostContainer(element: Element, root: HTMLElement) {
    const container = element.closest<HTMLElement>(POST_CONTAINER_SELECTOR);
    if (container != null && root.contains(container)) return container;

    return element instanceof HTMLElement && root.contains(element)
        ? element
        : null;
}

function applyHiddenClass(element: HTMLElement, hiddenElements: Set<HTMLElement>) {
    element.classList.add(HIDDEN_CLASS);
    hiddenElements.add(element);
}

function clearStaleHiddenElements(root: ParentNode, hiddenElements: Set<HTMLElement>) {
    for (const element of root.querySelectorAll<HTMLElement>(`.${HIDDEN_CLASS}`)) {
        if (!hiddenElements.has(element)) {
            element.classList.remove(HIDDEN_CLASS);
        }
    }
}

function scanPostList() {
    scanAnimationFrame = 0;

    const selectedForumChannel = getSelectedForumChannel();
    if (selectedForumChannel == null || !titleMatcher.hasRules()) {
        clearStaleHiddenElements(document, new Set());
        return;
    }

    const root = getScanRoot();
    const hiddenThreadIds = getHiddenThreadIds(selectedForumChannel.id);
    if (hiddenThreadIds.size === 0) {
        clearStaleHiddenElements(root, new Set());
        return;
    }

    const hiddenElements = new Set<HTMLElement>();

    for (const element of root.querySelectorAll<HTMLElement>("a[href], [data-list-item-id], [id], [aria-controls], [aria-labelledby]")) {
        if (getReferencedHiddenThreadId(element, hiddenThreadIds) == null) continue;

        const container = findPostContainer(element, root);
        if (container != null) applyHiddenClass(container, hiddenElements);
    }

    for (const element of root.querySelectorAll<HTMLElement>(POST_CONTAINER_SELECTOR)) {
        if (element.classList.contains(HIDDEN_CLASS)) continue;

        const titleText = getTitleText(element);
        if (titleText.length > 0 && titleMatcher.matchesContent(titleText)) {
            applyHiddenClass(element, hiddenElements);
        }
    }

    clearStaleHiddenElements(root, hiddenElements);
}

function schedulePostListScan() {
    if (scanAnimationFrame !== 0) return;

    scanAnimationFrame = requestAnimationFrame(scanPostList);
}

function rebuildTitleMatcher(keywordsValue: unknown) {
    const normalized = normalizeKeywordRules(keywordsValue);
    titleMatcher.rebuildRuleCaches(normalized.rules);
    schedulePostListScan();

    return normalized;
}

const settings = definePluginSettings({
    rules: {
        type: OptionType.COMPONENT,
        component: () => {
            const { keywords } = settings.use(["keywords"]);
            const normalized = React.useMemo(() => normalizeKeywordRules(keywords), [keywords]);

            React.useEffect(() => {
                if (normalized.changed) {
                    settings.store.keywords = normalized.rules;
                }
            }, [normalized]);

            return (
                <KeywordList
                    title="Post Title Filter Rules"
                    description={(
                        <>
                            Add keywords or regex patterns to hide forum/media posts by title.
                            Click <code style={{ fontFamily: "monospace" }}>.*</code> to toggle regex mode.
                            Matching posts are hidden only from the post browsing list.
                        </>
                    )}
                    rules={normalized.rules}
                    setRules={rules => { settings.store.keywords = normalizeKeywordRules(rules).rules; }}
                />
            );
        }
    },
    keywords: {
        type: OptionType.CUSTOM,
        default: [makeEmptyRule()],
        onChange: keywords => {
            rebuildTitleMatcher(keywords);
        }
    }
});

export default definePlugin({
    name: "PostTitleFilter",
    description: "Hide forum and media channel posts whose titles match configured keywords or regex patterns",
    tags: ["Chat", "Utility"],
    authors: [{ name: "KKTsN", id: 0n }],
    settings,

    start() {
        const normalized = rebuildTitleMatcher(settings.store.keywords);
        if (normalized.changed) {
            settings.store.keywords = normalized.rules;
        }

        observer = new MutationObserver(schedulePostListScan);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        schedulePostListScan();
    },

    stop() {
        observer?.disconnect();
        observer = null;

        if (scanAnimationFrame !== 0) {
            cancelAnimationFrame(scanAnimationFrame);
            scanAnimationFrame = 0;
        }

        titleMatcher.reset();
        clearStaleHiddenElements(document, new Set());
    },

    flux: {
        CHANNEL_SELECT: schedulePostListScan,
        CHANNEL_UPDATES: schedulePostListScan,
        LOAD_FORUM_POSTS: schedulePostListScan,
        RESORT_THREADS: schedulePostListScan,
        THREAD_CREATE: schedulePostListScan,
        THREAD_LIST_SYNC: schedulePostListScan,
        THREAD_UPDATE: schedulePostListScan
    }
});
