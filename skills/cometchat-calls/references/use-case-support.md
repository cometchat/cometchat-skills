# Use case — Customer support / Help desk

A customer initiates contact with a support agent. The shape: customer arrives via "Talk to us" button, lands in a queue, gets matched to next available agent, voice-first (video optional), screen-share for troubleshooting, recording for QA + agent training, post-call CSAT survey.

**Examples:** Intercom voice/video upgrade, Zendesk Talk, custom help-desk integrations.

---

## End-to-end flow

```
1. Customer clicks "Get help" in your app
   → Server checks queue depth → routes to next agent OR shows wait estimate
   ↓
2. Server creates a support group (CometChat group keyed to ticket ID)
   Both customer + agent are members
   ↓
3. Agent gets push notification "New support call"
   ↓
4. Agent accepts → call starts; customer auto-joins
   ↓
5. Mid-call: agent can request screen-share to see the customer's screen
   → Customer must explicitly allow (OS-level permission)
   ↓
6. Agent ends call → recording auto-uploaded to your QA pipeline
   ↓
7. Customer gets CSAT survey (1-5 rating + comment)
   → Stored against the ticket for agent performance reviews
```

---

## Agent-side identity

Display the agent's first name + photo, NOT internal handle:

```ts
// Agent's CometChat user metadata (set when agent logs into the support tool):
await CometChat.updateUser(new CometChat.User({
  uid: `agent-${employeeId}`,
  name: "Sarah",                       // First name only — privacy + warmth
  metadata: {
    displayPhoto: "/agent-photos/sarah.png",
    role: "Support Specialist",
    department: "Billing",
  },
}));
```

---

## Recommended call settings

```ts
const settings = {
  layout: "SPOTLIGHT",                   // Speaker focus
  hideChangeLayoutButton: false,          // Agent may want grid for note-taking workflows

  hideRecordingButton: true,              // Don't let agent toggle — server-side auto-record
  startRecordingOnCallStart: true,        // QA recording is the policy
                                          // (consent text in the in-app "By starting the call,
                                          //  you agree to recording for quality" notice)
  hideScreenShareButton: false,           // Critical for troubleshooting

  hideVirtualBackgroundButton: false,     // Agent uses brand background

  hideChatButton: false,                  // For pasting links/error messages
  hideShareInviteButton: true,            // Customer ↔ agent only

  hideRaiseHandButton: true,
  callIdleTime: 300,                      // 5min — short, agents are busy
};
```

---

## Recording consent (one-party + platform notice)

For most customer-support flows, a "By starting this call, you agree to recording" notice in your app's pre-call screen is sufficient (one-party consent jurisdictions). For two-party-consent jurisdictions (CA, IL, FL), add an explicit consent dialog before connecting:

```tsx
function PreCallScreen({ onAccept, onCancel }: Props) {
  return (
    <dialog open className="precall">
      <h2>Connect to support</h2>
      <p>Estimated wait: 2 minutes</p>
      <div role="note" aria-label="Recording notice">
        <p><strong>This call will be recorded for quality assurance.</strong></p>
        <p>By starting the call, you consent to recording. Recordings are
           retained for 90 days, accessible to you on request, and never sold.</p>
      </div>
      <button onClick={onAccept}>Start call</button>
      <button onClick={onCancel}>Cancel</button>
    </dialog>
  );
}
```

---

## Queue display + ETA

```tsx
function QueueWaiting({ ticketId }: Props) {
  const [position, setPosition] = useState<number>(0);
  const [eta, setEta] = useState<number>(0);

  useEffect(() => {
    // Server-side queue manager publishes updates via CometChat custom messages
    const listener = CometChat.addMessageListener("queue-updates", new CometChat.MessageListener({
      onCustomMessageReceived: (msg) => {
        const data = msg.getCustomData();
        if (data.ticketId === ticketId) {
          setPosition(data.position);
          setEta(data.etaSeconds);
        }
      },
    }));
    return () => CometChat.removeMessageListener("queue-updates");
  }, [ticketId]);

  return (
    <div role="status" aria-live="polite">
      <p>You're number {position} in line</p>
      <p>Estimated wait: {Math.round(eta / 60)} minutes</p>
    </div>
  );
}
```

---

## Post-call CSAT

Fire immediately after call end; before they navigate away:

```tsx
function PostCallSurvey({ ticketId }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  return (
    <dialog open>
      <h2>How was your call?</h2>
      <fieldset>
        <legend>Rate from 1 (poor) to 5 (excellent)</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-pressed={rating === n}>
            {n} ⭐
          </button>
        ))}
      </fieldset>
      <textarea name="comment" placeholder="Anything else?" />
      <button onClick={() => api.submitCsat({ ticketId, rating, comment })}>Submit</button>
    </dialog>
  );
}
```

---

## Anti-patterns

1. **No recording notice.** Two-party-consent law: lawsuit risk.
2. **Letting agent disable recording mid-call.** QA pipeline breaks. Hide the recording button server-side; only ops can disable for specific tickets via admin tool.
3. **Sharing internal employee handles.** Customer doesn't need agent's full name or company username — just first name.
4. **Recording forever.** Set 90-day retention; auto-delete via storage lifecycle.
5. **No queue UX.** Customer waits 5 minutes thinking it's broken → bounces. Show position + ETA.
6. **Agent transfers without context.** When transferring to another agent, pass the ticket history (custom messages with summary). Customer hates re-explaining.

---

## Verification checklist

- [ ] Recording is server-side auto-on; agent can't disable
- [ ] Pre-call screen shows recording notice + estimated wait
- [ ] Queue position + ETA visible during wait
- [ ] Customer ↔ agent only — share-invite hidden
- [ ] Idle timeout 5min (short on purpose)
- [ ] Post-call CSAT fires immediately
- [ ] Recording retention enforced via storage lifecycle (90d default)
- [ ] Agent transfer carries ticket context

---

## Pointers

- `cometchat-react-calls/references/recording.md` — recording config
- `cometchat-react-calls/references/screen-sharing.md` — for troubleshooting
- `cometchat-react/SKILL.md` — group + custom message patterns
- `cometchat-production` — credential hygiene
- `cometchat-react-extensions` — analytics for agent QA
