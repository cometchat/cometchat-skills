# Share invite on Flutter V6 (Bloc)

Same SDK + share_plus. V6-specific: wrap share state in a Cubit so the UI can disable the button while a share is in flight.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/share-invite
**Read first:** `cometchat-flutter-v5-calls/references/share-invite.md` — share_plus + deep-link config.

---

## Cubit

```dart
class ShareInviteCubit extends Cubit<bool> {
  ShareInviteCubit() : super(false);  // false = idle, true = sharing

  Future<void> share(String sessionId, {Rect? origin}) async {
    if (state) return;  // debounce
    emit(true);
    try {
      final url = 'https://yourapp.com/call/$sessionId';
      await Share.share(
        "I'm on a call — tap to join.\n$url",
        subject: 'Join my call',
        sharePositionOrigin: origin,
      );
    } finally {
      emit(false);
    }
  }
}
```

The boolean state is enough; we don't need a sealed-class state hierarchy here.

---

## Bridge from SDK event

```dart
@override
void onShareInviteButtonClicked() {
  context.read<ShareInviteCubit>().share(sessionId);
}
```

---

## App-built share button

```dart
class ShareInviteButton extends StatelessWidget {
  final String sessionId;
  const ShareInviteButton({super.key, required this.sessionId});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ShareInviteCubit, bool>(
      builder: (context, sharing) => IconButton(
        icon: sharing
          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
          : const Icon(Icons.share),
        onPressed: sharing
          ? null
          : () {
              final box = context.findRenderObject() as RenderBox?;
              context.read<ShareInviteCubit>().share(
                sessionId,
                origin: box != null ? box.localToGlobal(Offset.zero) & box.size : null,
              );
            },
      ),
    );
  }
}
```

---

## Anti-patterns

V5 sister rules apply, plus V6-specific:

1. **Full Bloc with events for a 1-state-update flow.** Cubit fits cleanly.
2. **Forgetting `try/finally` around `Share.share`.** If share throws, button stays in disabled state forever.

---

## Verification checklist

- [ ] `ShareInviteCubit` provided above call screen
- [ ] Button disabled while sharing (BlocBuilder)
- [ ] iPad anchor passed via `sharePositionOrigin`
- [ ] `try/finally` ensures cubit resets even on error
- [ ] Real-device smoke: same as V5

---

## Pointers

- `cometchat-flutter-v5-calls/references/share-invite.md` — V5 sister
- `cometchat-flutter-v6-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/share-invite
