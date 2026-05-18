# CometChat Calls SDK v5 — Android Skills

Agent skills for building with the CometChat Calls SDK v5 on Android. Install individually or browse all available skills.

## How It Works

Skills are bundled in this repository under `skills/`. When you clone the repo and open it in a supported AI coding assistant, skills auto-trigger based on what you're doing — mention "join session" and the join-session skill loads, ask about "VoIP calling" and the voip-calling skill loads. No manual activation needed.

To use these skills in your own project, copy the `skills/` folder into your project root:

```bash
cp -r skills/ /path/to/your/project/skills/
```

## Available Skills

### Core

| Skill | Triggers On |
|-------|-------------|
| `setup` | SDK dependencies, Cloudsmith maven, CallAppSettings, init, permissions, Jetifier |
| `join-session` | CometChatCalls.joinSession, SessionSettingsBuilder, voice vs video |
| `ringing-integration` | Dual SDK (Chat + Calls), initiateCall, accept/reject/cancel, incoming/outgoing |
| `session-settings` | All SessionSettingsBuilder options: layouts, session type, audio mode, hide buttons |
| `event-listeners` | SessionStatus, Participant, Media, ButtonClick, Layout listeners |
| `call-logs` | CallLogRequest, fetching and displaying call history |

### Advanced

| Skill | Triggers On |
|-------|-------------|
| `recording` | Auto-start recording, recording events |
| `screen-sharing` | Screen share setup, MediaProjection permissions |
| `picture-in-picture` | PiP mode configuration |
| `background-handling` | CometChatOngoingCallService, foreground service |
| `voip-calling` | VoIP push notifications, ConnectionService |
| `audio-controls` | Mute/unmute, audio device switching |
| `video-controls` | Camera on/off, switch camera |
| `participant-management` | Participant list, mute/kick, raise hand |
| `custom-ui` | Custom control panel, participant list, layout customization |
| `in-call-chat` | In-call messaging during active session |

## How Auto-Detection Works

Each skill has a `description` field in its YAML frontmatter that lists trigger keywords. When you mention something related (like "join a call" or "add VoIP support"), the agent reads the description, decides the skill is relevant, and loads its full content. You never need to manually select a skill.

## Compatibility

- CometChat Calls SDK v5 (5.0.0-beta.2+)
- CometChat Chat SDK v4 (4.0.+) — required for ringing and VoIP
- Kotlin, Java 17
- Gradle KTS, compileSdk 35, minSdk 26
- Works with: Kiro, Claude Code, Cursor, Copilot, and other AI coding assistants that support the skills ecosystem
