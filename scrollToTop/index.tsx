/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { ChannelStore, MessageActions, SelectedChannelStore } from "@webpack/common";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_BOTTOM,", 'position:"bottom"');

function UpArrowIcon() {
    return (
        <svg viewBox="0 0 24 24" width={20} height={20} className="vc-scrolltotop-icon">
            <path
                fill="currentColor"
                d="M5.3 9.3a1 1 0 0 1 1.4 0l5.3 5.29 5.3-5.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.42Z"
                transform="rotate(180 12 12)"
            />
        </svg>
    );
}

function ScrollToTopButton({ channelId }: { channelId?: string; }) {
    const currentChannelId = channelId ?? SelectedChannelStore.getChannelId();
    const channel = currentChannelId ? ChannelStore.getChannel(currentChannelId) : null;

    if (channel?.isForumChannel()) return null;

    return (
        <ErrorBoundary noop>
            <HeaderBarIcon
                className="vc-scrolltotop-btn"
                onClick={() => {
                    if (!currentChannelId) return;

                    MessageActions.jumpToMessage({
                        channelId: currentChannelId,
                        messageId: currentChannelId,
                        flash: false,
                    });
                }}
                tooltip="Scroll to Top"
                icon={() => <UpArrowIcon />}
            />
        </ErrorBoundary>
    );
}

function prependButtonToToolbar(match: string, pushNotificationButtonExpression: string, channel: string, isLurking?: string) {
    const toolbar = pushNotificationButtonExpression.slice(0, pushNotificationButtonExpression.indexOf(".push"));
    const dedupeCondition = `!${toolbar}.some(e=>e?.key==="vc-scrolltotop-"+${channel}.id)`;
    const insertCondition = isLurking == null
        ? `if(${dedupeCondition})`
        : `if(!${isLurking}&&${dedupeCondition})`;

    return `${match}${insertCondition}${toolbar}.unshift($self.renderButton(${channel}.id));`;
}

export default definePlugin({
    name: "ScrollToTop",
    description: "Adds a scroll-to-top button to the channel toolbar",
    authors: [{ name: "KKTsN", id: 0n }],

    patches: [{
        find: "Missing channel in Channel.renderHeaderToolbar",
        replacement: [
            {
                match: /renderHeaderToolbar(?:",|=)\(\)=>{.+?case \i\.\i\.GUILD_TEXT:(?=.+?(\i\.push.{0,50}channel:(\i)},"notifications"\)\)))(?<=isLurking:(\i).+?)/,
                replace: (m, pushNotificationButtonExpression, channel, isLurking) =>
                    prependButtonToToolbar(m, pushNotificationButtonExpression, channel, isLurking)
            },
            {
                match: /renderHeaderToolbar(?:",|=)\(\)=>{.+?case \i\.\i\.GUILD_MEDIA:(?=.+?(\i\.push.{0,40}channel:(\i)},"notifications"\)\)))(?<=isLurking:(\i).+?)/,
                replace: (m, pushNotificationButtonExpression, channel, isLurking) =>
                    prependButtonToToolbar(m, pushNotificationButtonExpression, channel, isLurking)
            },
            {
                match: /renderHeaderToolbar(?:",|=)\(\)=>{.+?case \i\.\i\.ANNOUNCEMENT_THREAD:(?=.+?(\i\.push.{0,120}channel:(\i)},"notifications"\)\)))/,
                replace: (m, pushNotificationButtonExpression, channel) =>
                    prependButtonToToolbar(m, pushNotificationButtonExpression, channel)
            },
            {
                match: /renderHeaderToolbar(?:",|=)\(\)=>{.+?case \i\.\i\.PUBLIC_THREAD:(?=.+?(\i\.push.{0,120}channel:(\i)},"notifications"\)\)))/,
                replace: (m, pushNotificationButtonExpression, channel) =>
                    prependButtonToToolbar(m, pushNotificationButtonExpression, channel)
            },
            {
                match: /renderHeaderToolbar(?:",|=)\(\)=>{.+?case \i\.\i\.PRIVATE_THREAD:(?=.+?(\i\.push.{0,120}channel:(\i)},"notifications"\)\)))/,
                replace: (m, pushNotificationButtonExpression, channel) =>
                    prependButtonToToolbar(m, pushNotificationButtonExpression, channel)
            }
        ]
    }],

    renderButton: (channelId?: string) => <ScrollToTopButton key={`vc-scrolltotop-${channelId ?? "unknown"}`} channelId={channelId} />,
});
