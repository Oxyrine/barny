# Product

## Register

product

## Platform

web

## Users

ISP subscribers monitoring their own home Wi-Fi, most often a non-technical person glancing at a status card during or after a connectivity problem. They don't know what RSSI or bufferbloat means and shouldn't need to. Their context is stress: something feels broken, they want to know whether it's them or the ISP, and whether it's already being handled. A hackathon demo audience will also see this live, but the interface is designed for the subscriber's context, not the pitch.

## Product Purpose

An automated Wi-Fi diagnostic and ISP ticketing engine. It watches network health continuously in the background, auto-runs a deep diagnostic suite (throughput, bufferbloat, traceroute) the moment something degrades, attempts a self-heal suggestion before escalating, translates the result into a plain-English summary, and automatically files a structured, evidence-backed ticket to the ISP's ticketing system. Success is the full pipeline visibly working end to end: a real degradation gets detected, a fix is attempted, the subscriber gets an explanation they can actually understand, and if the problem persists, a ticket lands with the ISP carrying real telemetry, not a vague complaint.

## Positioning

It closes the loop other tools leave open: most Wi-Fi apps stop at "here's your speed," this one detects, explains in plain language, attempts a fix, and files ISP-side evidence automatically, so a subscriber never has to be their own network engineer.

## Brand Personality

Precise, calm, trustworthy. The voice never panics, even reporting a Critical ticket reads as competent and in-control rather than alarming, because a subscriber under stress needs reassurance that something is being handled, not more anxiety. Plain language always wins over jargon; a summary explains "wall interference between your router and this room," never "RSSI -71dBm on 2.4GHz." Every claim on screen is backed by real data, an unavailable metric (SNR on Windows) is shown as unavailable, never invented, because a single fabricated number would undermine the trust the whole product depends on.

## Anti-references

None specified as a negative reference. The existing dark-glass aesthetic (matte black background, blurred glass cards, status-color glow, pill-shaped nav) is confirmed as the right direction; refine within it rather than replacing it.

## Design Principles

Status is legible at a glance and never conveyed by color alone; every status indicator pairs an icon or label with its color so the interface stays usable for colorblind users and reads correctly in a stressed, quick-glance moment. Plain language is the default register; technical terms appear only where a subscriber would reasonably encounter them (e.g. a Settings screen for an advanced user), never in the primary status/summary path. Every number and claim on screen must be real, sourced from actual probe or diagnostic data; nothing is fabricated or approximated to look more complete than it is. The interface proves the pipeline works rather than asserting it, live data over SSE, real diagnostic runs, a real filed ticket you can click through to, not a static or mocked state. Calm precedes urgency: a Critical status still reads as "handled, here's what's happening," not as an alarm.

## Accessibility & Inclusion

WCAG AA minimum contrast (4.5:1 body text, 3:1 large text). Status is never conveyed by color alone, already a stated project principle, carried through consistently. `prefers-reduced-motion` is respected throughout: route transitions, status pulses, and reveal animations degrade to instant/static rather than being suppressed outright.
