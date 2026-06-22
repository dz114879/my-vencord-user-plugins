# BlockPlus

`BlockPlus` hides messages from other users when they reply to or mention a user you have blocked.

It is intended to complement Vencord's built-in `NoBlockedMessages` plugin:

- `NoBlockedMessages` hides messages written by blocked or ignored users.
- `BlockPlus` hides messages written by other people when those messages point back to blocked or ignored users.

## Settings

- `Also hide messages that reply to or mention ignored users`: enabled by default.

## Implementation Notes

The plugin uses Discord's relationship state through `RelationshipStore`.

It patches both `MessageStore` and `ReadStateStore` on `MESSAGE_CREATE`, so newly hidden messages do not remain as unread or mention-only ghost pings.

It also keeps a message `<li>` render fallback that adds `vc-blockplus-hidden` to already-rendered messages. This keeps channel history and relationship setting changes in sync without maintaining a separate BlockPlus user list.