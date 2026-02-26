# VeriFlow — Written Explanation

## What the human can now do that they couldn't before

When Wealthsimple's automated verification (Persona/Onfido) fails — mismatched names, poor images, international IDs, fraud flags — roughly 10–30% of applicants land in a manual review queue. Today, a compliance analyst opens each case, reads the document, manually cross-references fields, checks sanctions lists, assesses risk, and decides. It's slow, fatiguing, and doesn't scale.

VeriFlow rebuilds this from scratch. Every case arrives pre-analyzed: documents extracted field-by-field, cross-referenced against submitted data, scored for risk, screened against PEP/sanctions/adverse media databases, and annotated with forensic evidence showing exactly where on the document each data point was found. The reviewer isn't starting from a blank document — they're reviewing an AI-generated brief and deciding whether they agree.

Clear-cut low-risk cases (high confidence, facial match confirmed, no critical flags) are auto-approved without human involvement. Human attention is concentrated exclusively on cases that actually need judgment: ambiguous matches, elevated risk, edge-case documents, potential fraud. One reviewer can now handle the entire escalation queue at 5–10x throughput.

## What AI is responsible for

AI owns the full triage pipeline:

- **Document analysis** — GPT-4o vision extracts name, DOB, document number, expiry, and issuing authority from any government ID, assesses quality, and detects tampering
- **Cross-referencing** — compares every extracted field against submitted data and flags discrepancies with severity levels
- **Facial comparison** — compares the selfie against the ID photo, returning a similarity score with feature-level observations
- **Regulatory screening** — screens against PEP lists, sanctions databases, adverse media, and FATF high-risk jurisdictions, then adjusts risk accordingly
- **Risk scoring** — produces a composite score determining queue priority and auto-approval eligibility
- **Auto-approval** — applications meeting all configurable thresholds are approved instantly

## Where AI must stop

**Rejections must always be made by a human.**

Denying someone access to financial services has real consequences — it can block their ability to save, invest, or participate in the economy. An AI that auto-rejects creates an accountability gap: who does the person appeal to? A confidence threshold? Regulatory frameworks like FINTRAC and the EU AI Act require explainability and human oversight for consequential decisions. Auto-approving a clearly legitimate applicant carries low downside. Auto-rejecting someone who might be legitimate carries asymmetric harm. VeriFlow draws the line here: AI can say yes, but only a human can say no.

## What would break first at scale

The GPT-4o API is the bottleneck. Each application requires 2–3 calls (document analysis, facial comparison, optional voice), each taking 5–15 seconds. At 10,000 applications/day, that's 20,000+ calls with significant latency and cost. The fix is clear: distill GPT-4o's structured outputs into purpose-built models — a fine-tuned document extraction model, a dedicated facial similarity model — reserving the general-purpose LLM only for ambiguous cases needing reasoning. The job queue architecture already supports horizontal scaling; it's the AI provider dependency that needs decoupling.
