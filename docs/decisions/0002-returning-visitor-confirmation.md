# ADR 0002: Returning Visitor Privacy and Confirmation Method

- **Status**: Accepted
- **Date**: 2026-11-24
- **Deciders**: Engineering Team

## Context and Problem Statement
Public check-in kiosks and reception tablets are shared surfaces. Requirements FR-03 and FR-07 state that returning visitors must be identified by phone number without disclosing private profile information prior to an appropriate confirmation step. If lookup queries immediately returned full names, phone numbers, or attendance history, anyone could type random numbers to harvest visitor identities or inspect who is currently inside the workspace.

## Decision
1. **Two-Phase Privacy Workflow**:
   - **Phase 1 (Lookup)**: The visitor enters their phone number. If recognised, the server returns:
     - A masked name hint (e.g. `Johnathan Doe` becomes `J*** D**`).
     - A cryptographically signed HMAC lookup token with an expiration time of 5 minutes (`exp: 300s`).
     - The response **never** contains full name, raw phone number, or visit history.
   - **Phase 2 (Confirmation)**: The visitor confirms their identity by entering their full name. The server verifies that the entered name matches the record associated with the signed lookup token.
   - **Phase 3 (Attendance Action)**: Upon successful confirmation, the client submits the validated token to complete check-in or check-out.
2. **Enumeration Resistance**: Lookup requests return generic responses and are rate-limited per IP to prevent rapid telephone enumeration attacks.
3. **Token Security**: The lookup token is signed server-side using HMAC-SHA256 and cannot be tampered with or forged by clients.

## Consequences
### Positive
- Strict compliance with FR-03 and FR-07.
- Protects visitor privacy from shoulder surfing at reception desk kiosks.
- Prevents malicious actors from looking up other visitors' attendance or checking them out without authorization.

### Negative / Trade-offs
- Returning visitors have to type their name once during confirmation before checking in or out (instead of a single tap).
