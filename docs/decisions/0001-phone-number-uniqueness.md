# ADR 0001: Phone Number Uniqueness and Normalization

- **Status**: Accepted
- **Date**: 2026-11-24
- **Deciders**: Engineering Team

## Context and Problem Statement
In the CLOCK IN attendance system, visitors register digitally and returning visitors look up their records via phone number. If phone numbers are entered in inconsistent formats (e.g., `08031234567`, `+234 803 123 4567`, `8031234567`), lookup queries will fail to match existing profiles, resulting in duplicate registrations and fragmented visit counts. Additionally, we must decide whether a single phone number can belong to multiple visitors (e.g., family members or colleagues) or must uniquely identify a single visitor profile.

## Decision
1. **Strict Uniqueness**: A phone number uniquely identifies one visitor profile. A unique constraint is placed on the `visitors.phone_number` column.
2. **E.164 Normalization**: Every incoming phone number must be normalized to standard international E.164 format before database queries or persistence:
   - Default region: Nigeria (`+234`).
   - Local format `0803...` (11 digits) becomes `+234803...`.
   - Strip whitespace, dashes, brackets, and leading trunk prefix `(0)`.
   - Non-Nigerian international numbers formatted with `+` are preserved in valid E.164 format.
3. **Validation**: Submissions that cannot be normalized to valid E.164 are rejected at the API boundary with a `400 Bad Request` validation error.

## Consequences
### Positive
- Guarantees fast, unambiguous index lookups by phone number.
- Accurate historical attendance tracking and visit frequency counts (weekly and monthly).
- Eliminates duplicate profiles caused by varied formatting.

### Negative / Trade-offs
- Two individuals cannot register using the exact same phone number; each visitor requires a distinct phone number.
