/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { React, Select, TextInput, UserStore, useState } from "@webpack/common";

import { addUser, type BlockedUser, type BlockMode, getBlockList, removeUser } from "./index";

const cl = classNameFactory("vc-blockplus-");

const MODE_OPTIONS = [
    { label: "彻底屏蔽+", value: 1 },
    { label: "彻底屏蔽", value: 2 },
    { label: "单向屏蔽", value: 3 },
];

function UserEntry({ user, onDelete }: { user: BlockedUser; onDelete: () => void; }) {
    const discordUser = UserStore.getUser(user.userId);
    const displayName = discordUser?.username ?? user.userId;

    return (
        <div className={cl("user-entry")}>
            <div className={cl("user-info")}>
                <div className={cl("username")}>{displayName}</div>
                <div className={cl("userid")}>{user.userId}</div>
            </div>
            <span className={cl("mode-badge", `mode-${user.mode}`)}>
                {user.mode === 1 ? "屏蔽+" : user.mode === 2 ? "屏蔽" : "隐身"}
            </span>
            <Button size="small" variant="dangerPrimary" onClick={onDelete}>
                X
            </Button>
        </div>
    );
}

export function BlockPlusModal({ rootProps }: { rootProps: ModalProps; }) {
    const [userId, setUserId] = useState("");
    const [mode, setMode] = useState<BlockMode>(1);
    const [list, setList] = useState<BlockedUser[]>(() => [...getBlockList()]);

    async function handleAdd() {
        const trimmed = userId.trim();
        if (!trimmed || !/^\d+$/.test(trimmed)) return;
        if (list.some(u => u.userId === trimmed)) return;

        await addUser(trimmed, mode);
        setList([...getBlockList()]);
        setUserId("");
    }

    async function handleDelete(targetId: string) {
        await removeUser(targetId);
        setList([...getBlockList()]);
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent className={cl("modal-content")}>
                <div className={cl("add-form")}>
                    <TextInput
                        placeholder="输入用户 ID..."
                        value={userId}
                        onChange={setUserId}
                        onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleAdd()}
                    />
                    <Select
                        className={cl("mode-select")}
                        options={MODE_OPTIONS}
                        select={v => setMode(v)}
                        isSelected={v => v === mode}
                        serialize={String}
                    />
                    <Button onClick={handleAdd} disabled={!userId.trim()}>
                        添加
                    </Button>
                </div>

                {list.length === 0 ? (
                    <div className={cl("empty")}>暂无屏蔽用户</div>
                ) : (
                    <div className={cl("user-list")}>
                        {list.map(user => (
                            <UserEntry
                                key={user.userId}
                                user={user}
                                onDelete={() => handleDelete(user.userId)}
                            />
                        ))}
                    </div>
                )}

                <Paragraph className={cl("legend")}>
                    彻底屏蔽+: 完全隐藏该用户消息 + 提及/回复该用户的消息，无需使用DC自带屏蔽(也可一起使用)<br />
                    彻底屏蔽: 隐藏该用户自己的消息；其他人提及该用户的消息照常显示，若是回复该用户则仅移除回复引用部分<br />
                    单向屏蔽: 必须先使用DC原生屏蔽，自己视角能正常查看对方消息(自动展开+移除屏蔽消息提示)
                </Paragraph>
            </ModalContent>
        </ModalRoot>
    );
}
