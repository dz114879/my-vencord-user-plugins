/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NoEntrySignIcon } from "@components/Icons";
import definePlugin from "@utils/types";
import { ChannelStore, RelationshipStore, RestAPI, showToast, Toasts, UserStore } from "@webpack/common";

let isShiftDown = false;

function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Shift") isShiftDown = true;
}

function onKeyUp(e: KeyboardEvent) {
    if (e.key === "Shift") isShiftDown = false;
}

function onWindowBlur() {
    isShiftDown = false;
}

export default definePlugin({
    name: "QuickBlock",
    description: "Adds a block button to the message popover when holding Shift, to quickly block a user without confirmation",
    authors: [{ name: "KKTsN", id: 0n }],
    dependencies: ["MessagePopoverAPI"],

    start() {
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", onWindowBlur);
    },

    stop() {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onWindowBlur);
        isShiftDown = false;
    },

    messagePopoverButton: {
        icon: NoEntrySignIcon,
        render(msg) {
            if (!isShiftDown) return null;

            const currentUser = UserStore.getCurrentUser();
            if (msg.author.id === currentUser?.id) return null;

            if (RelationshipStore.isBlocked(msg.author.id)) return null;

            return {
                label: "屏蔽用户",
                icon: NoEntrySignIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: async () => {
                    try {
                        await RestAPI.put({
                            url: `/users/@me/relationships/${msg.author.id}`,
                            body: { type: 2 }
                        });
                        const displayName = msg.author.globalName ?? msg.author.username;
                        showToast(`已屏蔽 ${displayName}`, Toasts.Type.SUCCESS);
                    } catch (e) {
                        showToast("屏蔽失败", Toasts.Type.FAILURE);
                    }
                }
            };
        }
    }
});
