# Use case — Telehealth (provider ↔ patient)

A virtual visit between a healthcare provider and a patient. The shape: pre-call waiting room, provider initiates the call, video-first, screen-share for sharing labs/imaging, in-call chat for sending links, optional recording with explicit consent, post-call note-taking workflow.

**Compliance:** HIPAA (US) + PIPEDA (CA) + GDPR (EU) — patient data in any form (incl. recording, screen-share content) is regulated. Telehealth integrations carry compliance risk that's outside CometChat's scope. Always:
- Run a Business Associate Agreement (BAA) with CometChat
- Run a separate BAA with your storage provider (S3, GCS) for recordings
- Surface explicit consent UI before recording starts
- Implement HIPAA-compliant audit logging

**The architecture below is a reference shape — pair it with your legal/compliance review before shipping.**

---

## End-to-end flow

```
1. Patient books appointment in your scheduling system
   ↓
2. At appointment time, both join a "virtual waiting room"
   (CometChat group keyed to appointment ID)
   ↓
3. Provider sees patient is waiting, clicks "Start visit"
   → CometChat.initiateCall(patientUid, sessionId=appointmentId, type="video")
   ↓
4. Patient gets incoming call → accepts → in-call
   ↓
5. (Optional) Provider taps "Start recording" → consent prompt to patient
   → only on patient accept does setRecordingOnCallStart fire
   ↓
6. (Optional) Provider screen-shares lab results
   ↓
7. (Optional) Provider opens in-call chat to send PDF/links
   ↓
8. Provider ends call → recording uploaded to your secure storage
   → patient redirected to feedback form
```

---

## Recommended call settings (web/RN)

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";
const settings = {
  layout: "SPOTLIGHT",                   // Focus on the person speaking
  hideChangeLayoutButton: true,           // Don't let user switch — calmer UX

  hideRecordingButton: false,             // Provider needs it
  startRecordingOnCallStart: false,       // NEVER auto-record without consent

  hideScreenShareButton: false,           // Sharing labs is core
  hideVirtualBackgroundButton: false,     // Patient often wants privacy

  hideChatButton: false,                  // For sending links/PDFs
  hideShareInviteButton: true,            // Patient ↔ provider only — no inviting
  hideRaiseHandButton: true,              // 1:1 — no need

  callIdleTime: 600,                      // 10min — long enough for thinking pauses
};
```

---

## Two-party consent recording

Two-party-consent jurisdictions (CA, IL, FL, MD, MA, MT, NH, PA, WA + Canada + EU) require explicit consent from BOTH parties before recording starts. Implement a banner, not just a small "REC" indicator:

```tsx
function RecordingConsentBanner({ onAccept, onReject }: Props) {
  return (
    <div role="alertdialog" aria-labelledby="rec-title" className="rec-banner">
      <h2 id="rec-title">Recording requested</h2>
      <p>
        Your provider would like to record this visit for medical records.
        The recording will be stored securely and accessible to you in your
        patient portal.
      </p>
      <button onClick={onAccept}>I consent to recording</button>
      <button onClick={onReject}>I do not consent</button>
    </div>
  );
}

// Provider's "Start recording" button:
async function requestRecording() {
  // 1. Send a CometChat custom message asking for consent
  await CometChat.sendCustomMessage(/* type: 'recording_request', target: patientUid */);
  // 2. Wait for patient response (custom message back: 'recording_consent_granted')
  // 3. ONLY THEN call CometChatCalls.startRecording()
}
```

---

## Waiting room pattern

```tsx
function WaitingRoom({ appointmentId }: Props) {
  const [providerOnline, setProviderOnline] = useState(false);

  useEffect(() => {
    // Subscribe to the appointment group; provider's presence triggers visit start
    const groupGuid = `appt-${appointmentId}`;
    const listener = CometChat.addGroupMemberListener(/* fires when provider joins */);
    return () => CometChat.removeGroupMemberListener(listener);
  }, [appointmentId]);

  return (
    <div role="status" aria-live="polite">
      {providerOnline ? <p>Your provider is ready. The visit will start shortly.</p>
        : <p>Please wait. Your provider will be with you soon.</p>}
      <button onClick={cancelVisit}>Leave waiting room</button>
    </div>
  );
}
```

`role="status"` + `aria-live="polite"` so a screen reader announces the state change without interrupting (vs `assertive` which interrupts).

---

## Anti-patterns

1. **Recording without explicit consent UI.** Two-party-consent law violation = lawsuit risk + HIPAA non-compliance.
2. **Storing recordings in default S3.** Use a HIPAA-compliant tier with BAA + KMS encryption + audit logging.
3. **No idle timeout.** Patient or provider walks away → call runs forever → bills + privacy concern (if recording).
4. **Sharing PHI in call settings.** Don't put `patientName` in `callerName` — use opaque IDs in the SDK config; resolve display names client-side from your auth-gated user store.
5. **Sending custom-message PII without encryption.** CometChat E2E encryption is opt-in (Extensions) — turn it on for telehealth.

---

## Verification checklist

- [ ] BAA executed with CometChat
- [ ] BAA executed with recording storage provider
- [ ] Recording UX includes explicit consent prompt + audit log
- [ ] Waiting room → call transition is automatic on provider initiate
- [ ] Idle timeout 10min
- [ ] Layout locked to SPOTLIGHT
- [ ] Share-invite hidden (1:1 only)
- [ ] No PII in SDK config or push payloads — only opaque IDs
- [ ] HIPAA audit log captures: visit start/end, recording start/stop, screen-share start/stop, file send

---

## Pointers

- `cometchat-react-calls/references/recording.md` — recording reference
- `cometchat-react-calls/references/screen-sharing.md` — screen share
- `cometchat-react-calls/references/in-call-chat.md` — link/file sending
- `cometchat-react-calls/references/idle-timeout.md` — idle timeout config
- `cometchat-production` skill — credential hygiene for sensitive integrations
- `cometchat-react-extensions` — message encryption setup
