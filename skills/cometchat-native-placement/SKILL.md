---
name: cometchat-native-placement
description: "Where to put chat in a React Native app — Stack screen, BottomTab, Modal, BottomSheet, Embedded. Maps each to CometChat component composition with ASCII layout references."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native placement stack tabs modal bottomsheet embedded"
---

## Purpose

Teaches Claude the five canonical placement patterns for putting chat inside a React Native app. Each pattern specifies:

1. Which CometChat components to compose
2. How to wire the placement into `@react-navigation/*` (or Expo Router)
3. Platform gotchas (safe-area, keyboard avoiding, gesture handling)
4. When to choose this placement over the alternatives

Ground truth: `docs/ui-kit/react-native/react-native-conversation.mdx`, `react-native-one-to-one-chat.mdx`, `react-native-tab-based-chat.mdx`, their `expo-*.mdx` equivalents, and the `examples/SampleApp/` + `examples/SampleAppExpo/` sample apps.

**Read `cometchat-native-core` and `cometchat-native-components` before this skill** — the provider wrapper chain and component catalog are prerequisites.

---

## "What are you building?" — placement recommendation

Use this table to pick a placement. If the user says "add chat to my app" without specifying where, ask them what they're building.

| User intent | Recommended placement | Experience |
|---|---|---|
| Messaging app (WhatsApp / Telegram / Signal style) | **Conversations stack** — list → tap → full-page messages screen | Two-pane-equivalent on mobile |
| SaaS / marketplace / e-commerce with chat as a feature | **Stack screen** — dedicated `/chat` or `/messages` route | Full-page chat inside the app |
| Support app or focused 1-to-1 | **Stack screen (single thread)** — no conversation list, go straight into one chat | Single thread |
| Full messaging hub with calls / users / groups | **Bottom tabs** — Chats / Users / Groups / Calls tabs + stack screen for message view | Tab-based messenger |
| Occasional chat overlay from a non-chat screen | **Modal** — present from anywhere, dismiss to return | Modal |
| Inline comments / contextual chat | **BottomSheet** — swipe up from a screen section | Sheet |
| Chat embedded inside an existing screen (e.g. a support tab next to product details) | **Embedded** — CometChat components inside a parent layout | Embedded |

---

## Visual reference — five RN placement patterns

### 1. Stack screen (full page)

```
┌───────────────────────────────────┐
│ ← Hiking Group               ⋮    │  ← CometChatMessageHeader
├───────────────────────────────────┤
│                                   │
│                ╭──────────╮       │
│                │ Message  │       │
│                ╰──────────╯       │  ← CometChatMessageList
│                                   │
│  ╭──────────╮                     │
│  │ Reply    │                     │
│  ╰──────────╯                     │
│                                   │
├───────────────────────────────────┤
│ +  Type a message...          ▶   │  ← CometChatMessageComposer
└───────────────────────────────────┘
```

### 2. Bottom tab

```
┌───────────────────────────────────┐
│ ← Hiking Group               ⋮    │  ← header
├───────────────────────────────────┤
│                                   │
│           (messages)              │
│                                   │
├───────────────────────────────────┤
│  Chats  Users  Groups  Calls      │  ← bottom tab bar
└───────────────────────────────────┘
```

### 3. Modal (slide-up over current screen)

```
              ┌─────────────────┐
              │ ═══ Chat  ✕     │  ← drag handle + close
              ├─────────────────┤
              │                 │
              │   (messages)    │
              │                 │
              ├─────────────────┤
              │ Type message ▶  │
              └─────────────────┘
  (parent screen dimmed behind)
```

### 4. BottomSheet (swipe-up partial)

```
parent screen visible at top ─────
              ┌─────────────────┐
              │  ═══ (handle)   │
              │ Hiking Group    │
              ├─────────────────┤
              │   (messages)    │
              ├─────────────────┤
              │ Type message ▶  │
              └─────────────────┘
```

### 5. Embedded (inside an existing screen)

```
┌───────────────────────────────────┐
│ Product details                   │
│ [product image + specs]           │
├───────────────────────────────────┤
│ Contact seller                    │  ← section heading
│ ┌────────────────────────────┐    │
│ │ (CometChatMessageHeader)    │    │
│ │ (CometChatMessageList)      │    │  ← embedded chat
│ │ (CometChatMessageComposer)  │    │
│ └────────────────────────────┘    │
└───────────────────────────────────┘
```

---

## 1. Stack screen

The most common pattern — chat lives in its own screen, pushed via `@react-navigation/native-stack`.

### Pattern A — Conversations list → Messages

Two screens: list + messages.

```tsx
// ConversationsScreen.tsx
import { CometChatConversations, CometChatUiKitConstants } from "@cometchat/chat-uikit-react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

export function ConversationsScreen({ navigation }: { navigation: NativeStackNavigationProp<any> }) {
  return (
    <CometChatConversations
      onItemPress={(conversation) => {
        const type = conversation.getConversationType();
        if (type === CometChatUiKitConstants.ConversationTypeConstants.user) {
          navigation.navigate("Messages", { user: conversation.getConversationWith() });
        } else {
          navigation.navigate("Messages", { group: conversation.getConversationWith() });
        }
      }}
    />
  );
}
```

```tsx
// MessagesScreen.tsx
import { View } from "react-native";
import {
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatMessageComposer,
} from "@cometchat/chat-uikit-react-native";

export function MessagesScreen({ route, navigation }: any) {
  const { user, group } = route.params ?? {};
  return (
    <View style={{ flex: 1 }}>
      <CometChatMessageHeader user={user} group={group} onBack={() => navigation.goBack()} showBackButton />
      <CometChatMessageList user={user} group={group} hideReplyInThreadOption />
      <CometChatMessageComposer user={user} group={group} />
    </View>
  );
}
```

```tsx
// AppNavigator.tsx
import { createNativeStackNavigator } from "@react-navigation/native-stack";
const Stack = createNativeStackNavigator();

<Stack.Navigator screenOptions={{ headerShown: false }}>
  <Stack.Screen name="Conversations" component={ConversationsScreen} />
  <Stack.Screen name="Messages" component={MessagesScreen} />
</Stack.Navigator>
```

### Pattern B — Single thread (no conversation list)

For support chat, marketplace "Contact seller", or any focused 1-to-1 where the target user/group is known in advance.

```tsx
export function SupportChatScreen() {
  const [agent, setAgent] = useState<CometChat.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    CometChat.getUser("support-agent-uid")
      .then((user) => {
        setAgent(user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!agent) return <Text style={{ padding: 16 }}>Support unavailable. Try again shortly.</Text>;

  return (
    <View style={{ flex: 1 }}>
      <CometChatMessageHeader user={agent} />
      <CometChatMessageList user={agent} hideReplyInThreadOption />
      <CometChatMessageComposer user={agent} />
    </View>
  );
}
```

### Navigation wiring notes

- The screen is wrapped in a `<View style={{ flex: 1 }}>` so the composer sits at the bottom and the list fills the middle.
- `CometChatMessageHeader`'s `onBack` should call `navigation.goBack()`. Set `showBackButton` explicitly so the header knows to render it.
- **Keyboard avoiding**: when the composer is visible, RN needs `KeyboardAvoidingView` on iOS or `android:windowSoftInputMode="adjustResize"` on Android. The framework patterns (`cometchat-native-expo-patterns`, `cometchat-native-bare-patterns`) cover the platform-specific wiring.

---

## 2. Bottom tab

For full-featured messengers with distinct entry points per content type.

```tsx
// TabsNavigator.tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Chats" component={ConversationsScreen} />
      <Tab.Screen name="Users" component={UsersScreen} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Calls" component={CallLogsScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
    </Stack.Navigator>
  );
}
```

Each tab screen pushes to a shared `Messages` stack screen with the selected entity:

```tsx
export function UsersScreen({ navigation }: any) {
  return (
    <CometChatUsers onItemPress={(user) => navigation.navigate("Messages", { user })} />
  );
}
export function GroupsScreen({ navigation }: any) {
  return (
    <CometChatGroups onItemPress={(group) => navigation.navigate("Messages", { group })} />
  );
}
export function CallLogsScreen() {
  return <CometChatCallLogs />;
}
```

### Wiring notes

- Tabs use `@react-navigation/bottom-tabs`. The `Messages` screen is OUTSIDE the tab navigator (at the stack level) so it presents full-screen without the tab bar.
- For the **Calls** tab, `CometChatCallLogs` only works when `@cometchat/calls-sdk-react-native` is installed. Omit the Calls tab if the project doesn't use calling.

---

## 3. Modal

For occasional chat that doesn't belong in the primary navigation. Two approaches — native RN `<Modal>` or react-navigation's `presentation: "modal"`.

### Pattern A — React Navigation modal (recommended)

Cleaner — the modal is a regular stack screen with a modal presentation option.

```tsx
<Stack.Navigator screenOptions={{ headerShown: false }}>
  <Stack.Screen name="Home" component={HomeScreen} />
  <Stack.Screen
    name="ChatModal"
    component={ChatModalScreen}
    options={{ presentation: "modal" }}
  />
</Stack.Navigator>
```

```tsx
function ChatModalScreen({ navigation }: any) {
  const [agent, setAgent] = useState<CometChat.User | null>(null);
  useEffect(() => { CometChat.getUser("support-agent").then(setAgent); }, []);
  if (!agent) return null;
  return (
    <View style={{ flex: 1 }}>
      <CometChatMessageHeader user={agent} onBack={() => navigation.goBack()} showBackButton />
      <CometChatMessageList user={agent} hideReplyInThreadOption />
      <CometChatMessageComposer user={agent} />
    </View>
  );
}

// Trigger from anywhere:
<Button title="Contact support" onPress={() => navigation.navigate("ChatModal")} />
```

iOS gets the native modal slide-up. Android shows a fade-in full-screen by default — if you need a swipe-to-dismiss feel, use the BottomSheet pattern instead.

### Pattern B — RN `<Modal>` component

For lightweight one-off modals that don't need a separate route.

```tsx
import { Modal, Pressable, View } from "react-native";

const [visible, setVisible] = useState(false);

<Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
  <SafeAreaView style={{ flex: 1 }}>
    <View style={{ flex: 1 }}>
      <CometChatMessageHeader user={agent} onBack={() => setVisible(false)} showBackButton />
      <CometChatMessageList user={agent} hideReplyInThreadOption />
      <CometChatMessageComposer user={agent} />
    </View>
  </SafeAreaView>
</Modal>
```

Works fine but bypasses navigation state — deep links and back-button handling need extra work.

---

## 4. BottomSheet

Native-feel swipe-up chat overlaid on a parent screen. Two library options; pick one based on the project's existing navigation:

| Library | When to use |
|---|---|
| `@gorhom/bottom-sheet` | Most flexible + most common. Good for partial-height sheets with snap points. |
| `@cometchat/chat-uikit-react-native`'s `CometChatBottomSheet` | Lightweight. Good if the project doesn't already depend on `@gorhom/bottom-sheet`. |

### Pattern A — @gorhom/bottom-sheet

```tsx
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useRef, useMemo } from "react";

function ProductScreen({ product }: any) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["25%", "90%"], []);
  const [agent, setAgent] = useState<CometChat.User | null>(null);

  useEffect(() => {
    CometChat.getUser(product.sellerUid).then(setAgent);
  }, [product.sellerUid]);

  return (
    <View style={{ flex: 1 }}>
      <ProductDetails product={product} />
      <Button title="Contact seller" onPress={() => sheetRef.current?.expand()} />

      <BottomSheet ref={sheetRef} snapPoints={snapPoints} index={-1} enablePanDownToClose>
        <BottomSheetView style={{ flex: 1 }}>
          {agent && (
            <>
              <CometChatMessageHeader user={agent} />
              <CometChatMessageList user={agent} hideReplyInThreadOption />
              <CometChatMessageComposer user={agent} />
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
```

### Pattern B — CometChatBottomSheet

```tsx
import { CometChatBottomSheet } from "@cometchat/chat-uikit-react-native";

const sheetRef = useRef<any>(null);

<CometChatBottomSheet ref={sheetRef}>
  <View style={{ flex: 1, height: "100%" }}>
    <CometChatMessageHeader user={agent} />
    <CometChatMessageList user={agent} hideReplyInThreadOption />
    <CometChatMessageComposer user={agent} />
  </View>
</CometChatBottomSheet>

<Button title="Chat" onPress={() => sheetRef.current?.show()} />
```

### BottomSheet gotchas

- **Snap points must be memoized**: Always wrap `snapPoints` in `useMemo(() => [...], [])` (see Pattern A above). An inline array creates a new reference on every parent render, which forces `@gorhom/bottom-sheet` to re-measure layout and tears the open/close gesture animation. The example above does this correctly — do NOT "simplify" by inlining the array.
- **Keyboard behavior**: `@gorhom/bottom-sheet` has `keyboardBehavior` + `keyboardBlurBehavior` props. Without them the composer gets covered by the keyboard on iOS. Use `keyboardBehavior="interactive"` + `keyboardBlurBehavior="restore"`.
- **Gesture handler wrap**: BottomSheet requires `<GestureHandlerRootView style={{ flex: 1 }}>` at the root (already required by the UI Kit — see `cometchat-native-core` § 3).
- **Height**: Pass `flex: 1` + `height: "100%"` on the inner View so the message list expands to fill the sheet.

---

## 5. Embedded

Chat inside an existing screen, not its own route.

```tsx
export function ProductDetailScreen({ product }: any) {
  const [agent, setAgent] = useState<CometChat.User | null>(null);
  useEffect(() => { CometChat.getUser(product.sellerUid).then(setAgent); }, [product.sellerUid]);

  return (
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
      <ProductImages images={product.images} />
      <ProductSpecs product={product} />

      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: "600", padding: 16 }}>Chat with seller</Text>
        <View style={{ height: 480 }}>
          {agent && (
            <>
              <CometChatMessageHeader user={agent} />
              <CometChatMessageList user={agent} hideReplyInThreadOption />
              <CometChatMessageComposer user={agent} />
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
```

### Embedded gotchas

- **Fixed height required.** CometChat components fill 100% of their parent. If you put them inside a `ScrollView` without a bounded height, the list collapses to zero height. Wrap in a `<View style={{ height: NNN }}>` or flex container with an explicit height.
- **Scroll conflict.** If the parent is a `ScrollView`, the message list's internal scroll competes with the parent's scroll. Consider the single-thread-as-stack-screen pattern instead if the chat is a primary UX.
- **Composer focus.** When the user taps the composer, the keyboard rises and can push the embedded chat off-screen on iOS. `keyboardShouldPersistTaps="handled"` on the parent ScrollView + `KeyboardAvoidingView` at the root help.

Usually the embedded pattern is the wrong default — prefer a Modal or BottomSheet trigger from a button on the screen, which gives users a dedicated surface for chatting.

---

## Hard rules

These apply to ALL placement patterns. Violating any of them causes integration bugs or destroys the existing navigation.

1. **NEVER modify the project's existing navigator without reading it first.** Understand what's there before adding screens or tabs. Don't replace a user's navigation structure unless they explicitly chose "demo mode."

2. **ALWAYS use a separate screen / stack entry for chat**, not inline replacement of an existing screen. The one exception is embedded placement (§ 5) where chat is explicitly part of a bigger screen.

3. **The four-wrapper chain is required at the app root**, not per-screen (see `cometchat-native-core` § 3). Re-wrapping per screen causes duplicate init + login, dropped WebSockets, and a 2–3-second flicker on first mount.

4. **`import "react-native-gesture-handler"`** must be at the very top of `index.js` (or Expo entry). Missing this import silently disables swipe gestures in the composer, bottom sheet, and attachment drawer.

5. **Every `<CometChatMessageList>` MUST include `hideReplyInThreadOption`** unless the integration also wires a full thread panel (`CometChatThreadHeader` + scoped list + scoped composer with `parentMessageId`). Drawer / modal / bottom sheet / embedded / stack-screen placements without a thread panel **must include the flag** — otherwise "Reply in Thread" shows in the message menu and silently does nothing.

6. **Resolve user / group before rendering.** The component props `user` and `group` expect `CometChat.User` and `CometChat.Group` instances — not bare UID strings. Fetch via `CometChat.getUser(uid)` / `CometChat.getGroup(guid)` in a `useEffect` and gate the render on the resolved object.

7. **Pass either `user` or `group`, never both.** Passing both causes runtime errors. Branch in render based on which one is set.

8. **Every CometChat container must have explicit flex height.** Components fill 100% of parent. If parent has no bounded height (`flex: 1`, `height: N`, or inside a flex layout with `flex: N`), components collapse to zero height and render empty. This is THE most common "why is my chat blank" bug.

9. **For modals and bottom sheets, set `keyboardShouldPersistTaps="handled"`** on any ScrollView / FlatList parent and configure keyboard behavior explicitly. Otherwise the composer gets hidden by the keyboard on iOS.

10. **Never animate a CometChat-containing container with `transform`** (including Tailwind's `translate-x-*` / `translate-y-*` / `scale-*` / `rotate-*` utilities if using NativeWind). `transform` creates a new containing block for `position: "absolute"` descendants, which reparents CometChat's absolute-positioned overlays (emoji picker, action sheet, reactions popover) and makes them misalign. In RN this is less common than web (RN has no `position: fixed`) but the same rule applies to any `position: absolute` pickers. Animate `right` / `left` / `top` / `bottom` offsets instead.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-native-core` | Always first — init, login, provider wrapper chain |
| `cometchat-native-components` | For component prop details — always |
| `cometchat-native-placement` | This skill — picking + wiring a placement |
| `cometchat-native-expo-patterns` | Expo-specific integration (app.json, permissions, Expo Router) |
| `cometchat-native-bare-patterns` | Bare RN (pod install, native modules, privacy manifest) |
| `cometchat-native-theming` | Customize colors / typography / dark mode |
| `cometchat-native-features` | Calls, extensions, AI — the "add a feature" flow |
| `cometchat-native-customization` | Custom slot views, text formatters, events |
| `cometchat-native-production` | Server-side auth tokens |
| `cometchat-native-troubleshooting` | Blank chat / gestures not working / keyboard covering composer / pod install fails |
