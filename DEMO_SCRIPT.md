# VeriFlow Demo Video Script (2:30–3:00)

## Pre-Recording Checklist
- [ ] Railway deployment live and healthy
- [ ] Create a fresh admin account (`admin@veriflow.com`)
- [ ] Create a fresh applicant account (`jane@example.com`)
- [ ] Have a real passport/drivers license photo ready
- [ ] Have a selfie ready (or use webcam during demo)
- [ ] Have an API key generated
- [ ] Terminal open for curl demo
- [ ] Browser in dark mode (looks better on video)

---

## SCRIPT

### [0:00–0:20] THE HOOK — Frame the problem

> "KYC — Know Your Customer — is how financial institutions verify that you are who you say you are. It's mandatory, it's regulated, and at most companies, it's still painfully manual.
>
> A compliance analyst opens an application, squints at a passport photo, cross-checks the name and date of birth against what the person typed in, googles them for sanctions hits, and writes up their assessment. This takes 15 to 30 minutes per application. And when you're onboarding millions of users like Wealthsimple is — that doesn't scale.
>
> VeriFlow rebuilds this process from scratch as an AI-native system."

**[SCREEN: Show the VeriFlow login page]**

---

### [0:20–0:55] THE APPLICANT EXPERIENCE

> "Here's what the applicant sees."

**[SCREEN: Log in as `jane@example.com`, navigate to Submit Application]**

> "The submission form has a live progress stepper — as you fill out each section it tracks your completion. Name, date of birth, country, address."

**[SCREEN: Fill in fields, show the stepper updating in real time]**

> "Upload your identity document — passport, driver's license, or national ID. Then take a live selfie with your webcam. This isn't just for the file — it's for facial comparison."

**[SCREEN: Upload a document, take selfie with webcam capture. Hit submit.]**

> "That's it. The applicant is done. Behind the scenes, here's what happens in the next 30 seconds..."

---

### [0:55–1:40] THE AI ENGINE — Show what it actually does

**[SCREEN: Switch to admin account. Open the Dashboard.]**

> "The application hits a job queue. A background worker picks it up and runs three AI analyses in sequence."

**[SCREEN: Click into the application that's now in 'Pending Review'. Scroll through the results.]**

> "First — **document analysis**. GPT-4o Vision reads the identity document, extracts the name, date of birth, document number, expiry date, and compares every field against what the applicant submitted. It generates evidence annotations showing exactly *where* on the document each field was found and whether it matches."

**[SCREEN: Show the extracted data comparison table, highlight any mismatches or matches]**

> "Second — **facial comparison**. The AI compares the face on the ID document with the selfie, scoring similarity across features like face shape, jawline, skin tone. It flags anomalies like age differences or possible photo substitution."

**[SCREEN: Show the facial match panel with similarity score and observations]**

> "Third — **regulatory screening**. The system automatically runs PEP checks, sanctions screening against OFAC, UN, and SEMA lists, adverse media screening, jurisdiction risk assessment, and document expiry validation. Each check cites the specific FINTRAC regulation it's enforcing."

**[SCREEN: Show the Regulatory Flags section with the screening results]**

> "All of this produces a composite risk score, a risk level, and a priority classification — so the most dangerous applications surface first."

---

### [1:40–2:10] THE HUMAN'S ROLE — Where AI stops

> "Here's where it gets interesting. Low-risk applications — where the risk score is below the threshold, confidence is high, facial match confirms identity, and no critical flags exist — the system auto-approves them instantly. No human needed."

**[SCREEN: Show an auto-approved application card with the ⚡ AI badge, click into it, show the green 'AI Auto-Approved' review section]**

> "But rejections — denying someone access to financial services — that *always* requires a human. That's the critical decision that must remain human, and here's why: the consequence of a false rejection is real harm to a real person. Under FINTRAC regulations, a regulated entity needs human accountability for every denial."

**[SCREEN: Show a high-risk application still in 'Pending Review'. Click into it, show the Approve/Reject buttons]**

> "So the AI handles the 70–80% of applications that are clearly fine. Humans focus their time on the cases that actually need judgment. And the thresholds are fully configurable."

**[SCREEN: Quick flash of Settings page showing the Auto-Approve config panel with sliders]**

---

### [2:10–2:40] THE API — Scale beyond the UI

> "And this isn't just a UI tool. VeriFlow exposes a full REST API for programmatic integrations."

**[SCREEN: Switch to terminal. Run curl commands.]**

> "Any system — a mobile app, a partner bank, an onboarding flow — can submit verifications via API with an API key, and poll for results."

**[SCREEN: Show the curl POST to /api/v1/verify, then GET /status/{id} showing results]**

> "The same AI pipeline runs. The same human review queue surfaces them. The system handles the cognitive work at scale — the human handles the judgment calls."

---

### [2:40–2:55] THE CLOSE

> "VeriFlow takes a process that used to take 20 minutes of manual analyst time per application and compresses the AI portion to under 60 seconds — while producing more thorough, more consistent, and fully auditable analysis than a human could alone.
>
> One analyst can now review hundreds of applications a day instead of dozens — not by skipping steps, but because the AI has already done the reading, the comparison, and the screening. The human just has to decide."

**[SCREEN: Show the dashboard overview with stats — applications processed, risk breakdown]**

> "That's VeriFlow."

---

## RECORDING TIPS

1. **Screen record at 1080p minimum** — Use OBS, Loom, or QuickTime
2. **Record voiceover separately** if your mic quality is better in a quiet take
3. **Move at a steady pace** — don't rush the AI results, let the viewer read them
4. **Pre-load all pages** so there's no loading spinner lag during recording
5. **Use dark mode** — it looks more polished on video
6. **Keep it under 3 minutes** — the job posting says 2–3, respect it
7. **Don't narrate clicks** ("now I'll click here") — narrate *what the system is doing*
8. **If something loads slowly**, just narrate over it: "The worker is running the analysis now..."

---

## MAPPING TO JOB REQUIREMENTS

| They Want To See | Where In Demo |
|---|---|
| System actually working | Live walkthrough, not slides |
| Clearly define the human's role | Human reviews medium/high risk; AI auto-approves low risk |
| AI takes on real cognitive responsibility | Document analysis, facial matching, regulatory screening, AND auto-approval of clear-cut cases |
| One critical decision that must remain human + why | **Rejection** — denying financial services requires human accountability. False rejections cause real harm and carry regulatory penalties |
| Rebuilding a legacy workflow | Manual KYC review → AI-native pipeline with configurable auto-approval |
| Handling far more complexity | 3 AI analyses + regulatory screening + auto-approve in ~60s vs 20min manual |
| Operating reliably | Error handling, retry logic, structured fallbacks, threshold-guarded auto-approve |
| Cross-functional thinking | Regulatory compliance, UX, API design, AI engineering, operational efficiency |
