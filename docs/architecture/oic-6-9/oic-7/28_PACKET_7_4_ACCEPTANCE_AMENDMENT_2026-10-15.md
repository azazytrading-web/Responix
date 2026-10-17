# Packet 7.4 acceptance amendment — 2026-10-15

**Status:** Owner-approved acceptance amendment. This note supplements the locked OIC-7 architecture and supersedes only an interpretation that Packet 7.4 requires naturally occurring human disagreement for acceptance. It does not alter prior historical records or reviewer evidence.

## Previous requirement and observed problem

Packet 7.4 was previously treated as requiring at least one genuine disagreement between two human reviewers. Two distinct, eligible, non-conflicted human reviewers independently reviewed the same blinded items in two predeclared, immutable local batches. Both batches produced agreement on every item, with no abstentions. The system retained and computed that result faithfully.

Natural disagreement is an outcome of human judgment, not a deterministic property of a correct review system. Requiring it for acceptance would reward changing fixtures after observing answers, coaching reviewers, or fabricating disagreement. Those actions violate the existing integrity requirements.

## Replacement acceptance semantics

Real-human Packet 7.4 acceptance requires:

1. Two distinct, active, application-scoped `HUMAN_IDENTITY` reviewers with real authentication.
2. Current `ELIGIBLE` calibration and protocol-specific `CLEARED` conflict state for each reviewer.
3. Independent review of the same server-controlled blinded item or items.
4. No cross-reviewer answer visibility; immutable individual submissions with correct identity attribution, evidence digests, and audit provenance.
5. Canonical inter-rater computation over those actual submissions, preserving the observed result honestly as `AGREEMENT`, `DISAGREEMENT`, abstention, or incomplete evidence as applicable.

Either real `AGREEMENT` or real `DISAGREEMENT` is a valid observed human-evidence result. Acceptance does not require reviewers to disagree. Agreement must not be described or stored as disagreement.

## Disagreement mechanics remain required

Disagreement remains a first-class result. Deterministic isolated tests must verify both reviewer orderings (`TRUE/FALSE` and `FALSE/TRUE`), same-value agreement (`TRUE/TRUE` and `FALSE/FALSE`), abstention as distinct from a Boolean value, and missing/unknown evidence as neither false nor disagreement. Tests must demonstrate that disagreement is computed, individually attributed, immutably retained, projected and audited, and can enter the protocol-defined adjudication path without overwriting either submission.

Synthetic test fixtures prove implementation behavior only. They are not human identities, do not substitute for real-human milestone evidence, and must never be represented as real submissions or production evidence.

## Guarantees preserved

This amendment does not weaken human identity or authentication, application isolation, calibration expiry, conflict checks, server-controlled blindness, immutable submissions, attribution, audit provenance, protected-oracle separation, or the rule that adjudication does not silently replace its source reviews. Existing real-human evidence remains unchanged.

## Canonical references

- The original packet ordering and handoff remain in [`54_PACKET_HANDOFF.md`](../cross-cutting/54_PACKET_HANDOFF.md).
- Human metric and judge semantics remain in [`24_METRICS_JUDGES_AND_STATISTICS.md`](24_METRICS_JUDGES_AND_STATISTICS.md).
- This amendment is the current Packet 7.4 acceptance interpretation; it does not revise other packet gates.
