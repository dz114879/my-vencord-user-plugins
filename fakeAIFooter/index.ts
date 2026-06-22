/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const LINK_ONLY_REGEX = /^\s*(?:\[.*?\]\(.*?\)|https?:\/\/\S+)\s*$/;
const MARKDOWN_LINK_ONLY_REGEX = /^\s*\[.*?\]\((https?:\/\/.*)\)\s*$/;
const URL_ONLY_REGEX = /^\s*(https?:\/\/\S+)\s*$/;
const CUSTOM_EMOJI_ONLY_REGEX = /^\s*<a?:\w+:\d+>\s*$/;
const SINGLE_UNICODE_EMOJI_REGEX = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)$/u;
const FAKE_NITRO_EMOJI_REGEX = /\/emojis\/(\d+?)\.(png|webp|gif)(?:\?|$)/;
const FAKE_NITRO_STICKER_REGEX = /\/stickers\/(\d+?)\./;
const FAKE_NITRO_GIF_STICKER_REGEX = /\/attachments\/\d+?\/\d+?\/(\d+?)\.gif(?:\?|$)/;

const settings = definePluginSettings({
    filterSingleNativeEmoji: {
        type: OptionType.BOOLEAN,
        description: "Do not append the footer when the message only contains a single native emoji",
        default: true,
    },
    filterSingleServerEmoji: {
        type: OptionType.BOOLEAN,
        description: "Do not append the footer when the message only contains a single custom/server emoji like <:name:id>",
        default: true,
    },
    filterSingleFakeNitroItem: {
        type: OptionType.BOOLEAN,
        description: "Do not append the footer when the message only contains a single FakeNitro emoji/sticker link",
        default: true,
    },
    fakeTps: {
        type: OptionType.NUMBER,
        description: "Base fake output TPS. The generated footer time uses Out ÷ randomized TPS",
        default: 1.5,
    },
    fakeTpsVariance: {
        type: OptionType.NUMBER,
        description: "Random +/- range applied to fakeTPS before converting it into the footer time",
        default: 0.5,
    }
}, {
    fakeTps: {
        isValid(value) {
            return Number.isFinite(value) && value > 0 || "fakeTPS must be greater than 0";
        }
    },
    fakeTpsVariance: {
        isValid(value) {
            return Number.isFinite(value) && value >= 0 || "fakeTPS variance must be 0 or greater";
        }
    }
});

function countTokens(text: string): number {
    let count = 0;
    for (const char of text) {
        count += CJK_REGEX.test(char) ? 2 : 1;
    }
    return count;
}

function getStandaloneLink(text: string): string | null {
    const markdownMatch = text.match(MARKDOWN_LINK_ONLY_REGEX);
    if (markdownMatch) return markdownMatch[1];

    return text.match(URL_ONLY_REGEX)?.[1] ?? null;
}

function isSingleUnicodeEmoji(text: string): boolean {
    return SINGLE_UNICODE_EMOJI_REGEX.test(text);
}

function isSingleCustomEmoji(text: string): boolean {
    return CUSTOM_EMOJI_ONLY_REGEX.test(text);
}

function isSingleFakeNitroItem(text: string): boolean {
    const link = getStandaloneLink(text);
    if (!link) return false;

    return FAKE_NITRO_EMOJI_REGEX.test(link)
        || FAKE_NITRO_STICKER_REGEX.test(link)
        || FAKE_NITRO_GIF_STICKER_REGEX.test(link);
}

function getRandomizedTps(): number {
    const baseTps = Math.max(settings.store.fakeTps, Number.EPSILON);
    const variance = Math.max(settings.store.fakeTpsVariance, 0);
    const minTps = Math.max(baseTps - variance, Number.EPSILON);
    const maxTps = baseTps + variance;

    return minTps + Math.random() * (maxTps - minTps);
}

export default definePlugin({
    name: "FakeAIFooter",
    description: "Automatically appends a fake AI-style footer to sent messages",
    tags: ["Chat", "Fun"],
    authors: [{ name: "KKTsN", id: 0n }],
    settings,

    onBeforeMessageSend(_channelId, msg) {
        if ((window as any).__vencordFakeStreamOutputEnabled) return;

        const trimmedContent = msg.content.trim();
        if (!trimmedContent) return;
        if (trimmedContent.startsWith("/")) return;

        const fakeNitroOnly = isSingleFakeNitroItem(trimmedContent);

        if (settings.store.filterSingleNativeEmoji && isSingleUnicodeEmoji(trimmedContent)) return;
        if (settings.store.filterSingleServerEmoji && isSingleCustomEmoji(trimmedContent)) return;
        if (settings.store.filterSingleFakeNitroItem && fakeNitroOnly) return;
        if (LINK_ONLY_REGEX.test(trimmedContent) && !fakeNitroOnly) return;

        const out = countTokens(trimmedContent);
        const inTokens = Math.floor(Math.random() * 30001) + 20000;
        const time = (out / getRandomizedTps()).toFixed(3);

        msg.content += `\n-# Time:${time}s | In:${inTokens}t | Out:${out}t`;
    }
});
