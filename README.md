# Routelo — Route Planning Prototype

> **Project status: legacy prototype.**
> This repository preserves the first working exploration that led to
> [Routelo v2](https://github.com/JasonLee0416/Routelo.version_2).

Routelo began with a narrow question:

> Can a delivery driver enter several destinations on a phone and get a more
> useful visit order without operating a full logistics platform?

This prototype was built to explore that interaction. It connects device
location, address geocoding, map markers, distance estimates, and a simple
nearest-neighbor route ordering flow in one React Native screen.

## What This Prototype Explored

- Requesting and using the driver's current location
- Converting a typed address into map coordinates
- Adding and removing delivery destinations
- Estimating point-to-point distance with the Haversine formula
- Reordering destinations with a nearest-neighbor heuristic
- Comparing list, map, and settings interactions on a mobile device

The prototype source is preserved in [`for Andorid`](for%20Andorid). It is a
historical snapshot rather than a production-ready application.

## What It Did Not Solve

The experiment exposed the limitations of route planning in isolation:

- Drivers still had to transcribe paper receipt data manually.
- Straight-line distance was not a substitute for road distance or traffic.
- Delivery deadlines and event times were not part of the route decision.
- The single-screen structure did not scale to a complete daily workflow.
- Text encoding and project packaging needed a more disciplined foundation.

Those limitations became requirements for the next experiments.

## Evolution

```text
Routelo prototype
  └─ validated mobile destination entry and route-order UX
       ↓
Flogg
  └─ explored receipt capture, Vision API extraction, and local SQLite records
       ↓
Routelo v2
  └─ integrates delivery operations, reviewable OCR data, deadline risk,
     local-first records, and route handoff to Google Maps
```

- Receipt workflow experiment:
  [Flogg](https://github.com/JasonLee0416/Flogg)
- Current integrated project:
  [Routelo v2](https://github.com/JasonLee0416/Routelo.version_2)

## Key Lesson

The main lesson was that a useful field tool cannot optimize only coordinates.
It also needs to understand the operational context attached to each stop:
addresses, contacts, strict deadlines, event times, source documents, and the
driver's ability to review uncertain data.

This repository remains public to document that change in problem definition.

## License

[MIT](LICENSE)
