# Clarification contract (all coding agents)

Every place a CometChat skill says **"ask the user"**, **"render an `AskUserQuestion`"**, **"MUST ask"**, or **"NON-NEGOTIABLE prompt"** means: **follow this contract.** It is **model-agnostic** — it works on Claude Code, Codex, Cursor, Gemini CLI, OpenAI coding agents, Windsurf, and any future agent. `AskUserQuestion` is merely Claude Code's name for step 1; every agent has an equivalent, and if it doesn't, the text fallback below is mandatory.

## The contract

1. **RENDER a structured choice.**
   - If your runtime has a native structured-question primitive (Claude Code: `AskUserQuestion`; others may differ), use it.
   - **If it does not, render a numbered text list** — a one-line header, the question, then each option on its own numbered line — and ask the user to reply with a number or the option text. Never skip the prompt just because you lack a GUI primitive.

2. **WAIT for a real answer. Do NOT proceed on a guess.**
   - Do not pick a default, do not infer the answer from the repo, the project name, or "what's most common."
   - **Auto / YOLO / "moving fast for the demo" / approval-mode does NOT authorize skipping a user-facing decision.** Those modes govern *tool and shell approvals*, not product choices. Surface the prompt regardless of approval mode.

3. **MAP the answer by VALUE / LABEL — never by ordinal position.**
   - The user may reply with the option text, a number, or free text. Resolve it to the option's *meaning*, not "they typed 1 so it's the first option."
   - This matters because different agents render options in different orders; matching on position silently corrupts the choice.

4. **ACCEPT a free-text fallback.**
   - If the answer isn't one of the listed options (a different `uid`, region, app name, framework version…), treat it as a valid custom value — do not loop re-prompting the same list.

5. **ONE decision per prompt** unless the choices are genuinely independent. Don't bundle unrelated decisions (e.g. framework + uid + region) into a single question.

6. **SELF-VERIFY before moving on.** Confirm you have an explicit answer for every *required* prompt of the current step. If you are running **headless / non-interactive** (no stdin, CI, cron), do **not** guess — STOP and emit the exact question + options so a human can answer, then resume.

## Canonical text rendering (for agents without a structured primitive)

```
❓ <one-line question>   (reply with the number or the text)
  1) <Option label> — <short description>
  2) <Option label> — <short description>
  3) <Option label> — <short description>
  Or type your own answer.
```

Wait for the reply. Resolve it to an option by label/text (or accept a custom value). Then continue.

## Prompts in the CometChat skills that MUST follow this contract

These are load-bearing — skipping them silently picks defaults the user never saw, which corrupts downstream routing or ships broken code:

- **Greenfield framework choice** (when `detect` returns no framework) — never scaffold a framework the user didn't choose.
- **Android version** (V5 vs V6) and **Flutter version** (V5 vs V6) when the project is greenfield — these route to *different* SDKs; guessing wrong emits unusable code.
- **Android/Flutter surface** (Compose vs Kotlin Views; which screen) when both are present.
- **Dev-mode login UID** — never hardcode `cometchat-uid-1`; ask which test user. A default UID flagged as a Bot in the dashboard fails auth with an opaque error.
- **Sign-up flow choices** — product, role, intent, app name, region, industry. These mirror the dashboard browser flow and drive downstream recommendations.
- **Calling mode** (default UI calling vs session-mode vs raw SDK), **chat-only vs chat+calls**, and **custom-UI vs UI-Kit** when the journey forks.
- **Existing-integration decisions** — when a competing chat SDK, existing Firebase/push, or an existing auth system is detected (see the dispatcher's pre-flight scan), ask how to proceed rather than clobbering.
