/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { MessageStore, RelationshipStore } from "@webpack/common";

const HIDDEN_MESSAGE_CLASS = "vc-blockplus-hidden";
const DATA_ATTR = "data-blockplus-filter-data";
const logger = new Logger("BlockPlus");

interface MessageLike {
    author?: { id?: string; };
    mentions?: Array<string | { id?: string; }>;
    messageReference?: { channel_id?: string; message_id?: string; };
    message_reference?: { channel_id?: string; message_id?: string; };
    referenced_message?: { author?: { id?: string; }; };
    referencedMessage?: { author?: { id?: string; }; };
    messageSnapshots?: Array<{ message?: { author?: { id?: string; }; }; }>;
}

interface FilterData {
    authorId?: string;
    replyAuthorId?: string;
    mentionIds: string[];
}

function scheduleDomRefresh() {
    setTimeout(() => updateRenderedMessages(), 0);
}

const settings = definePluginSettings({
    applyToIgnoredUsers: {
        description: "Also hide messages that reply to or mention ignored users",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: false,
        onChange: scheduleDomRefresh
    }
});

function isFilteredUser(userId?: string | null) {
    if (!userId) return false;

    try {
        return RelationshipStore.isBlocked(userId)
            || (settings.store.applyToIgnoredUsers && RelationshipStore.isIgnored(userId));
    } catch (e) {
        logger.error("Failed to check relationship state:", e);
        return false;
    }
}

function getReferencedMessage(message: MessageLike) {
    const ref = message?.messageReference ?? message?.message_reference;
    const channelId = ref?.channel_id;
    const messageId = ref?.message_id;

    if (!channelId || !messageId) return;

    return MessageStore.getMessage(channelId, messageId);
}

function getReferencedAuthorId(message: MessageLike): string | undefined {
    return message?.referenced_message?.author?.id
        ?? message?.referencedMessage?.author?.id
        ?? message?.messageSnapshots?.[0]?.message?.author?.id
        ?? getReferencedMessage(message)?.author?.id;
}

function getMentionIds(message: MessageLike) {
    if (!Array.isArray(message?.mentions)) return [];

    return message.mentions
        .map((mention: string | { id?: string; }) => typeof mention === "string" ? mention : mention?.id)
        .filter((mentionId: string | undefined): mentionId is string => !!mentionId);
}

function getFilterData(message: MessageLike): FilterData {
    return {
        authorId: message?.author?.id,
        replyAuthorId: getReferencedAuthorId(message),
        mentionIds: getMentionIds(message)
    };
}

function shouldHideFromData({ authorId, replyAuthorId, mentionIds }: FilterData) {
    if (isFilteredUser(authorId)) return false;
    if (isFilteredUser(replyAuthorId)) return true;

    return mentionIds.some(isFilteredUser);
}

function parseFilterData(raw: string | null | undefined): FilterData | null {
    if (!raw) return null;

    try {
        const data = JSON.parse(raw);
        return {
            authorId: data.authorId,
            replyAuthorId: data.replyAuthorId,
            mentionIds: Array.isArray(data.mentionIds) ? data.mentionIds : []
        };
    } catch (e) {
        logger.error("Failed to parse rendered message data:", e);
        return null;
    }
}

function updateRenderedMessages() {
    for (const message of document.querySelectorAll<HTMLElement>(`[${DATA_ATTR}]`)) {
        const data = parseFilterData(message.getAttribute(DATA_ATTR));
        if (!data) continue;

        message.classList.toggle(HIDDEN_MESSAGE_CLASS, shouldHideFromData(data));
    }
}

export default definePlugin({
    name: "BlockPlus",
    description: "Hides messages that reply to or mention blocked users, optionally including ignored users",
    tags: ["Privacy", "Chat"],
    authors: [{ name: "KKTsN", id: 0n }],
    settings,

    patches: [
        {
            find: '"MessageStore"',
            replacement: {
                match: /(?<=MESSAGE_CREATE:function\((\i)\){)/,
                replace: (_, props) => `if($self.shouldHideMessage(${props}.message))return;`
            }
        },
        {
            find: '"ReadStateStore"',
            replacement: {
                match: /(?<=MESSAGE_CREATE:function\((\i)\){)/,
                replace: (_, props) => `if($self.shouldHideMessage(${props}.message))return;`
            }
        },
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
        }
    ],

    start() {
        scheduleDomRefresh();
    },

    stop() {
        for (const message of document.querySelectorAll<HTMLElement>(`.${HIDDEN_MESSAGE_CLASS}`)) {
            message.classList.remove(HIDDEN_MESSAGE_CLASS);
        }
    },

    flux: {
        RELATIONSHIP_ADD: scheduleDomRefresh,
        RELATIONSHIP_UPDATE: scheduleDomRefresh,
        RELATIONSHIP_REMOVE: scheduleDomRefresh
    },

    shouldHideMessage(message: MessageLike) {
        if (!message) return false;

        try {
            return shouldHideFromData(getFilterData(message));
        } catch (e) {
            logger.error("Failed to check message:", e);
            return false;
        }
    },

    getMessageProps(message: MessageLike) {
        return {
            [DATA_ATTR]: JSON.stringify(getFilterData(message))
        };
    },

    getMessageClasses(message: MessageLike) {
        return this.shouldHideMessage(message) ? `${HIDDEN_MESSAGE_CLASS} ` : "";
    }
});
