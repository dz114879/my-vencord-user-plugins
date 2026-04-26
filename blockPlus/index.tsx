/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import * as DataStore from "@api/DataStore";
import ErrorBoundary from "@components/ErrorBoundary";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { MessageStore, UserStore } from "@webpack/common";

import { BlockPlusModal } from "./BlockPlusModal";

const HIDDEN_MESSAGE_CLASS = "vc-blockplus-hidden";
const STRIP_REPLY_CLASS = "vc-blockplus-strip-reply";

function scheduleDomRefresh() {
    setTimeout(() => {
        updateRenderedMessages();
    }, 0);
}

function getReferencedMessage(message: any) {
    const ref = message?.messageReference;
    if (!ref?.channel_id || !ref?.message_id) return;

    return MessageStore.getMessage(ref.channel_id, ref.message_id);
}

function getReferencedAuthorId(message: any) {
    return getReferencedMessage(message)?.author?.id;
}

function shouldStripReplyPreview(message: any) {
    const referencedAuthorId = getReferencedAuthorId(message);
    return referencedAuthorId != null && blockMap.get(referencedAuthorId) === 2;
}

function getMentionIds(message: any) {
    if (!Array.isArray(message?.mentions)) return [];
    return message.mentions
        .map((mention: any) => typeof mention === "string" ? mention : mention?.id)
        .filter((mentionId: string | undefined): mentionId is string => !!mentionId);
}

function shouldHideFromData(authorId?: string, replyAuthorId?: string, mentionIds: string[] = []) {
    const authorMode = authorId ? blockMap.get(authorId) : void 0;
    if (authorMode === 1 || authorMode === 2) {
        return true;
    }

    if (replyAuthorId != null && blockMap.get(replyAuthorId) === 1) {
        return true;
    }

    if (mentionIds.length) {
        for (const [userId, mode] of blockMap) {
            if (mode === 1 && mentionIds.includes(userId)) {
                return true;
            }
        }
    }

    return false;
}

function updateRenderedMessages() {
    const messages = document.querySelectorAll<HTMLElement>("[data-blockplus-author-id]");

    let hiddenCount = 0;
    let strippedReplyCount = 0;

    messages.forEach(message => {
        const authorId = message.dataset.blockplusAuthorId;
        const replyAuthorId = message.dataset.blockplusReplyAuthorId;
        const mentionIds = message.dataset.blockplusMentionIds?.split(",").filter(Boolean) ?? [];

        const shouldHideMessage = shouldHideFromData(authorId, replyAuthorId, mentionIds);
        const shouldStripReply = replyAuthorId != null && blockMap.get(replyAuthorId) === 2;

        message.classList.toggle(HIDDEN_MESSAGE_CLASS, shouldHideMessage);
        message.classList.toggle(STRIP_REPLY_CLASS, shouldStripReply);

        if (shouldHideMessage) hiddenCount++;
        if (shouldStripReply) strippedReplyCount++;
    });
}

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_BOTTOM,", 'position:"bottom"');

export type BlockMode = 1 | 2 | 3;

export interface BlockedUser {
    userId: string;
    mode: BlockMode;
}

// In-memory cache
let blockMap: Map<string, BlockMode> = new Map();
let blockList: BlockedUser[] = [];

function getDataKey() {
    return `BlockPlus_${UserStore.getCurrentUser()?.id}`;
}

async function loadData() {
    const data = await DataStore.get<BlockedUser[]>(getDataKey());
    blockList = data ?? [];
    blockMap = new Map(blockList.map(u => [u.userId, u.mode]));
}

async function saveData() {
    blockMap = new Map(blockList.map(u => [u.userId, u.mode]));
    await DataStore.set(getDataKey(), blockList);
    scheduleDomRefresh();
}

export function getBlockList(): BlockedUser[] {
    return blockList;
}

export async function addUser(userId: string, mode: BlockMode) {
    if (blockList.some(u => u.userId === userId)) return;
    blockList.push({ userId, mode });
    await saveData();
}

export async function removeUser(userId: string) {
    blockList = blockList.filter(u => u.userId !== userId);
    await saveData();
}

function BanIcon() {
    return (
        <svg viewBox="0 0 24 24" width={20} height={20} className="vc-blockplus-icon">
            <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31A7.902 7.902 0 0112 20zm6.31-3.1L7.1 5.69A7.902 7.902 0 0112 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"
            />
        </svg>
    );
}

function BlockPlusButton() {
    return (
        <ErrorBoundary noop>
            <HeaderBarIcon
                className="vc-blockplus-btn"
                onClick={() => {
                    openModal((props: any) => <BlockPlusModal rootProps={props} />);
                }}
                tooltip="BlockPlus"
                icon={() => <BanIcon />}
            />
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "BlockPlus",
    description: "Enhanced blocking with 3 modes: full block+, full block, and stealth block",
    tags: ["Privacy", "Utility"],
    authors: [{ name: "KKTsN", id: 0n }],

    patches: [
        // Patch 1: Header bar button
        {
            find: '?"BACK_FORWARD_NAVIGATION":',
            replacement: {
                match: /(?<=trailing:.{0,300}children:\[)/,
                replace: "$self.renderButton(),"
            }
        },
        // Patch 2: Filter blocked messages and strip mode-2 reply previews before rendering
        {
            find: "Message must not be a thread starter message",
            replacement: [
                {
                    match: /"aria-setsize":-1,(?=.{0,150}?#{intl::MESSAGE_A11Y_ROLE_DESCRIPTION})/,
                    replace: "...$self.getMessageProps(arguments[0].message),$&"
                },
                {
                    match: /\)\("li",\{(.+?),className:/,
                    replace: ")(\"li\",{$1,className:$self.getMessageClasses(arguments[0].message)+"
                }
            ]
        },
        // Patch 3: Prevent Mode 3 messages from being grouped as blocked
        {
            find: "NON_COLLAPSIBLE.has(",
            replacement: {
                match: /if\((\i)\.blocked\)return (\i\.\i\.MESSAGE_GROUP_BLOCKED);/,
                replace: "if($1.blocked&&!$self.isMode3($1.author?.id))return $2;"
            }
        }
    ],

    renderButton: () => <BlockPlusButton />,

    async start() {
        await loadData();
        scheduleDomRefresh();
    },

    stop() { },

    getMessageProps(message: any) {
        const mentionIds = getMentionIds(message);
        const replyAuthorId = getReferencedAuthorId(message);

        return {
            "data-blockplus-author-id": message?.author?.id,
            "data-blockplus-reply-author-id": replyAuthorId,
            "data-blockplus-mention-ids": mentionIds.length ? mentionIds.join(",") : void 0
        };
    },

    getMessageClasses(message: any) {
        const classes: string[] = [];

        if (this.shouldHide(message)) {
            classes.push(HIDDEN_MESSAGE_CLASS);
        }

        if (shouldStripReplyPreview(message)) {
            classes.push(STRIP_REPLY_CLASS);
        }

        return classes.length ? `${classes.join(" ")} ` : "";
    },

    shouldHide(message: any) {
        if (!message) return false;

        if (shouldHideFromData(message.author?.id, getReferencedAuthorId(message), getMentionIds(message))) {
            return true;
        }

        return false;
    },

    isMode3(authorId: string | undefined) {
        if (!authorId) return false;
        return blockMap.get(authorId) === 3;
    }
});
