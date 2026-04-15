/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { PlusIcon } from "@components/Icons";
import { insertTextIntoChatInputBox, sendMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, showToast, Toasts } from "@webpack/common";

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

const settings = definePluginSettings({
    autoSend: {
        type: OptionType.BOOLEAN,
        description: "Automatically send the +1 message instead of just pasting it into the input box",
        default: false,
    }
});

export default definePlugin({
    name: "QuickPlusOne",
    description: "Adds a +1 button to the message popover when holding Shift, to quickly copy or send a message's text content",
    authors: [{ name: "KKTsN", id: 0n }],
    dependencies: ["MessagePopoverAPI"],
    settings,

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
        icon: PlusIcon,
        render(msg) {
            if (!isShiftDown) return null;

            return {
                label: "+1",
                icon: PlusIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => {
                    if (!msg.content) {
                        showToast("该消息没有文本内容", Toasts.Type.FAILURE);
                        return;
                    }

                    if (settings.store.autoSend) {
                        sendMessage(msg.channel_id, { content: msg.content });
                    } else {
                        insertTextIntoChatInputBox(msg.content);
                    }
                }
            };
        }
    }
});
