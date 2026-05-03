---
name: cometchat-ios
description: Entry-point for CometChat iOS UI Kit integration in any Swift/iOS project. Detects the project type, gathers requirements through an interactive conversation, and writes production-quality integration code for UIKit and SwiftUI applications.
license: "MIT"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat dispatcher entry ios swift uikit swiftui chat messaging"
---

## Use this skill when

The user wants to add CometChat to any iOS project. Trigger phrases:

- `/cometchat`
- "add cometchat", "integrate cometchat", "add chat to my app"
- "add messaging", "add chat ui", "add in-app chat"
- "integrate chat in ios", "add chat to swift app"

This is the **entry point for iOS integration**. Do NOT invoke
framework-specific skills directly — this dispatcher detects the
project type first and routes to the right ones.

**Supported project types:**

| Type | Description |
|---|---|
| **UIKit** | Traditional UIKit-based iOS apps using Storyboards or programmatic UI |
| **SwiftUI** | Modern SwiftUI-based iOS apps |
| **Hybrid** | Apps using both UIKit and SwiftUI |

The iOS UI Kit loads `CometChatUIKitSwift` via CocoaPods or Swift Package Manager, along with `CometChatSDK`.

## How this skill works

This skill is **interactive and conversational**. You don't just detect
the project type and dump code. You have a conversation with the developer
to understand their project, their use case, and exactly where chat
should go — THEN you write code that fits.

**Pattern skills (loaded from your context):**
- `cometchat-ios-core` — initialization, login, provider pattern, anti-patterns
- `cometchat-ios-components` — component catalog, props, composition patterns
- `cometchat-ios-placement` — WHERE to put chat (navigation, tabs, modals)
- `cometchat-ios-theming` — customizing colors, fonts, and styles
- `cometchat-ios-customization` — custom views, templates, formatters

**Key principle: ask, don't assume.** Every piece of information you need
from the user should be asked explicitly. Don't guess the view controller,
don't guess where the trigger button goes, don't guess the auth system.

## Steps

### Step 1 — Detect project type + map the project

First, check for iOS project indicators:

**Detection checklist:**
1. Look for `.xcodeproj` or `.xcworkspace` files
2. Check for `Podfile` (CocoaPods), `Package.swift` (SPM as a package), or SPM dep refs in `*.xcodeproj/project.pbxproj` (SPM via Xcode GUI)
3. Read `Info.plist` for app configuration
4. Check for SwiftUI indicators (`@main App`, `ContentView.swift`)
5. Check for UIKit indicators (`AppDelegate.swift`, `SceneDelegate.swift`, Storyboards)

**If the project has NO `Podfile`, NO `Package.swift`, AND no SPM refs in the .xcodeproj** (the default state of every freshly Xcode-created `File → New → App` project), STOP. You must establish a dependency-management mechanism before touching integration code. Read `cometchat-ios-core` § 1.0 for the two options (CocoaPods script-able, SPM Xcode-GUI) and complete that step first. Skipping this produces an integration with `import CometChatUIKitSwift` that cannot resolve at build time.

**Then read the project yourself — this is critical.**

- `Podfile`, `Package.swift`, or SPM refs in `*.xcodeproj/project.pbxproj` — existing dependencies
- The source directory structure — list all directories under the project
- Find the entry point: `AppDelegate.swift`, `SceneDelegate.swift`, or `@main App`
- Find existing view controllers or SwiftUI views
- Find the navigation structure: `UINavigationController`, `UITabBarController`, `NavigationStack`

Store this mental map — you'll use it throughout the conversation.

**Compatibility baselines:**
- iOS 13+ required for CometChat UI Kit
- Swift 5.0+ required
- Xcode 14+ recommended

### Step 2 — Set up credentials (onboarding)

**Ask the user for their CometChat credentials:**

Use `AskUserQuestion`:
- **question:** "Let's set up CometChat. Do you have your credentials?"
- **header:** "CometChat Setup"
- **multiSelect:** false
- **options:**
  1. label: "I have my App ID, Region, and Auth Key", description: "I'll paste them now"
  2. label: "I need to create a CometChat account", description: "Guide me to get credentials"
  3. label: "I'll set them up later", description: "Just show me the integration code"

**If they have credentials:**
Ask for:
1. App ID (from CometChat Dashboard)
2. Region (`us`, `eu`, or `in`)
3. Auth Key (for development mode)

**If they need to create an account:**
Direct them to:
> "Create a free account at https://app.cometchat.com
> 1. Sign up and create a new app
> 2. Go to API & Auth Keys section
> 3. Copy your App ID, Region, and Auth Key
> Tell me when you have them."

### Step 3 — Interactive requirements gathering

#### 3a. "What are you building?"

Use `AskUserQuestion`:
- **question:** "What kind of app are you building?"
- **header:** "Your app"
- **multiSelect:** false
- **options:**
  1. label: "Messaging app", description: "Chat is the main feature — like WhatsApp, Telegram, or iMessage"
  2. label: "Marketplace or platform", description: "Buyers and sellers communicate — like Airbnb or eBay"
  3. label: "SaaS or productivity", description: "Team chat or support chat inside a product"
  4. label: "Social or community", description: "User profiles with messaging — like a dating app or community"
  5. label: "Support or helpdesk", description: "Customer-to-agent communication"
  6. label: "Just exploring", description: "Quick demo — fastest path to see chat working"

**If "Just exploring":** Skip the rest of Step 3 and scaffold the minimal integration — one view controller showing `CometChatConversations` with `cometchat-uid-1` pre-logged-in.

#### 3b. Show what you recommend and why

| Intent | What you'll set up |
|---|---|
| **Messaging app** | A dedicated messages tab with conversation list + message view |
| **Marketplace** | A "Chat with seller" button on product screens + an inbox tab |
| **SaaS / dashboard** | A chat modal triggered from navigation + a messages section |
| **Social / community** | A full messenger with tabs: Chats, Calls, Users, Groups |
| **Support** | A floating chat button that opens a support conversation |

Ask: "Does this sound right, or do you want a different approach?"

#### 3c. Ask where things should go

**Show the user their actual project structure** — list the view controllers/views you found in Step 1.

**For UIKit projects:**
> "I found these view controllers in your project:
>   - MainViewController
>   - ProfileViewController
>   - SettingsViewController
>
> Where should the messages screen be accessible from?"

**For SwiftUI projects:**
> "I found these views in your project:
>   - ContentView
>   - HomeView
>   - ProfileView
>
> Where should the messages view be accessible from?"

#### 3d. Detect and ask about authentication

Look for auth libraries in the project:
- `FirebaseAuth` → Firebase Authentication
- `AuthenticationServices` → Sign in with Apple
- `GoogleSignIn` → Google Sign-In
- Custom auth patterns

Report what you found and ask:

If auth detected:
> "I see you're using [Firebase Auth / etc.]. Here's how CometChat will work:
>
> - **Development (now):** I'll use CometChat's Auth Key for quick testing
> - **Production (later):** Your server will mint per-user auth tokens
>
> Start with dev mode for now?"

If no auth detected:
> "I don't see an authentication system yet. For now, I'll set up CometChat
> with a hardcoded test user (cometchat-uid-1).
>
> When you add auth later, you can connect them."

#### 3e. Confirm the plan

**Show EXACTLY what you'll do before doing it:**

> "Here's what I'll create:
>
> **New files:**
> - `CometChatManager.swift` — initialization and login handling
> - `ChatViewController.swift` — main chat interface
>
> **Files I'll modify:**
> - `AppDelegate.swift` — add CometChat initialization
> - `MainViewController.swift` — add navigation to chat
>
> **Dependencies:** CometChatUIKitSwift, CometChatSDK
>
> **Auth mode:** Development (Auth Key)
>
> Proceed? [y/n]"

Wait for explicit confirmation.

### Step 4 — Reference pattern skills

**All skills are already loaded in your context.** Read and follow them directly:

1. `cometchat-ios-core` — initialization, login, provider pattern
2. `cometchat-ios-components` — component catalog, composition patterns
3. `cometchat-ios-placement` — placement pattern for the chosen approach
4. `cometchat-ios-theming` — if customization is needed

### Step 5 — Write the integration

Execute the confirmed plan:

1. **Add dependencies** — CocoaPods or SPM
2. **CometChatManager** — singleton for init/login
3. **Chat UI** — appropriate components for the use case
4. **Wire into existing project** — READ each file before modifying
5. **Environment setup** — credentials configuration

### Step 6 — Verify + show result

After writing code:

1. Verify the project builds
2. Check for any missing imports
3. Surface any common issues

**Result message:**
> "CometChat is integrated! Here's what was set up:
>
> - CometChatManager.swift ✓
> - ChatViewController.swift ✓
> - Dependencies added ✓
>
> Next steps:
> 1. Run `pod install` (if using CocoaPods)
> 2. Build and run the app
> 3. Navigate to the chat screen
>
> **About the empty conversation list:**
> Every CometChat app has 5 pre-created test users: `cometchat-uid-1` through `uid-5`.
> To see chat working:
> 1. Open https://app.cometchat.com → your app → Users
> 2. Send a message from `cometchat-uid-2` to `cometchat-uid-1`
> 3. Refresh the app to see the conversation"

### Step 7 — Iteration menu

Use `AskUserQuestion`:
- **question:** "What would you like to do next?"
- **header:** "Next step"
- **options:**
  1. label: "Customize look and feel", description: "Change colors, fonts, and styles"
  2. label: "Add a feature", description: "Calls, reactions, polls, AI features"
  3. label: "Customize a component", description: "Custom message bubbles, headers, etc."
  4. label: "Set up push notifications", description: "APNs setup for message notifications"
  5. label: "Set up production auth", description: "Replace dev Auth Key with server tokens"
  6. label: "Troubleshoot an issue", description: "Debug common problems"
  7. label: "I'm done", description: "Exit"

## Hard rules

### Always

- **Ask, don't assume.** Every integration decision should be confirmed.
- **Always detect project type first.** Do not assume UIKit or SwiftUI.
- NEVER replace existing project files unless the user explicitly confirms.
- ALWAYS read existing files before modifying them.
- ALWAYS show the plan and get confirmation before writing.
- For component names and properties, use the `cometchat-ios-components` skill — never invent from training data.

### iOS-specific

- **Initialize CometChat in AppDelegate or App init** — before any UI renders
- **Use the singleton pattern** for CometChatManager
- **Handle async initialization properly** — don't show chat UI until init completes
- **Respect iOS lifecycle** — handle background/foreground transitions
- **Support both light and dark mode** — use CometChatTheme

## Error handling

Common iOS integration errors:

| Error | Cause | Solution |
|---|---|---|
| "CometChat is not initialized" | UI shown before init completes | Use completion handler pattern |
| "Invalid App ID" | Wrong credentials | Verify App ID in dashboard |
| "Module not found" | Dependencies not installed | Run `pod install` or add SPM package |
| Build errors | Missing imports | Add `import CometChatUIKitSwift` |

## Skill routing reference

| Skill | When to load |
|---|---|
| `cometchat-ios-core` | Always — before any integration code |
| `cometchat-ios-components` | Always — before writing component code |
| `cometchat-ios-placement` | When integrating — for placement patterns |
| `cometchat-ios-theming` | When customizing themes |
| `cometchat-ios-customization` | When writing custom views or templates |
| `cometchat-ios-features` | When adding calls, reactions, polls, AI features |
| `cometchat-ios-push` | When setting up push notifications |
| `cometchat-ios-production` | When setting up production auth |
| `cometchat-ios-troubleshooting` | When diagnosing problems |

## Complete Skill Set

This iOS UI Kit skill set includes 9 comprehensive skills:

1. **cometchat-ios** (this file) — Entry-point dispatcher
2. **cometchat-ios-core** — Initialization, login, manager pattern
3. **cometchat-ios-components** — Complete component catalog
4. **cometchat-ios-placement** — Navigation patterns, tabs, modals
5. **cometchat-ios-theming** — Colors, fonts, dark mode
6. **cometchat-ios-customization** — Custom views, templates, formatters
7. **cometchat-ios-features** — Calls, reactions, polls, AI, extensions
8. **cometchat-ios-push** — Push notifications setup
9. **cometchat-ios-production** — Server-side auth, security
10. **cometchat-ios-troubleshooting** — Common issues and debugging
