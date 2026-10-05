# Brand assets for store listings

Used by the plugin manifests: `.cursor-plugin/plugin.json` (`logo`), and the OpenAI/Codex `interface` in `plugin.json` and `.codex-plugin/plugin.json` (`logo`, `composerIcon`, `screenshots`). `npm run verify:plugin-manifest` fails if a declared file is missing.

| File | What it is |
| --- | --- |
| `icon.svg`, `icon.png` (512×512), `composer-icon.png` (128×128) | The CometChat mark on white, matching the Play Store app icon |
| `logo.svg`, `logo.png` (1024 wide) | The CometChat wordmark, `#141414` on transparent |
| `logo-light.svg` | The wordmark in white, for dark backgrounds |
| `screenshot-1.png` (1440×833) | Current UI Kit: conversations list, a one-to-one chat, and call history with the bottom tab bar |

**Source:** the CometChat Android UI Kit sample app published on the Play Store.
- The mark and wordmark are converted from the app's vector logo. Path data is unchanged; the PNGs are rendered from the SVGs.
- `screenshot-1.png` is the current UI Kit overview screenshot (October 2026), flattened onto white.

To refresh: re-export from that logo, or replace these files with official marketing assets of the same names.
