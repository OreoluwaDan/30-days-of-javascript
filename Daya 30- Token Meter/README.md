# Token Meter

A small Chrome extension for claude.ai. It estimates the tokens in each Claude reply and keeps a running total until you reset it.

Everything it shows is an **estimate** (about 4 characters per token), not your exact usage.

## What it shows

- **Total:** the running total since you started recording or last pressed Reset. It is saved, so it survives refreshes and restarts.
- **Last reply:** the size of Claude's newest reply.
- **Last turn:** that reply plus the chat Claude had to re-read to write it. This is closer to real usage, and it is what the total adds up.
- **This chat:** the size of the chat on screen, with a bar that turns amber and then red as it gets long.
- Click **–** to shrink it to a small pill. Click **Reset total** twice to start again from zero.

## Install (no store needed)

1. Download or clone this folder.
2. Open `chrome://extensions` in Chrome, Brave or Edge.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick this folder.
5. Open or refresh claude.ai.


## Limits

- It only sees visible text. Hidden instructions, thinking, attachments and tool use are not counted, so real usage is higher.
- Claude's usage limits are not a simple token count, so treat this as a trend, not a gauge for being cut off.
- If claude.ai changes its page layout, replies may stop being found. Update the selectors at the top of `content.js`.

## What I learned

- Saving data in an extension with `chrome.storage`
- Debouncing: waiting for things to go quiet before acting
- Telling new messages from old ones with a `WeakSet`
- Why long chats cost more: the whole conversation is re-read with every message
