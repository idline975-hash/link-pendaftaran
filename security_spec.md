# Security Specification — Pendaftaran Lomba HUT RI ke-81 (Hybrid Cloud Firestore + LocalStorage)

## 1. Data Invariants
1. **Global Safety Net**: Every path defaults to `false` unless explicitly matched.
2. **PII Isolation (`/registrations/{registrationId}`)**:
   - `childName`, `parentName`, and `whatsapp` are PII.
   - Public visitors may `create` new registrations with strict schema validation (`checkedIn == false`, `checkedInAt == null`, `createdAt == request.time`), enabling zero-friction public registration and background sync.
   - `get`, `list`, `update`, and `delete` on `/registrations/{registrationId}` are restricted strictly to `isAdmin()` (`request.auth != null && request.auth.token.email_verified == true` and either `idline975@gmail.com` or existing doc in `/admins/{uid}`).
3. **Immutable Fields on Update**: `registrationCode` and `createdAt` cannot be modified after creation.
4. **Action-Based Updates**: Updates on `/registrations/{registrationId}` are split into explicit action branches (`checkedIn`/`checkedInAt` check-in toggle vs participant profile edit) using `affectedKeys().hasOnly(...)`.
5. **Public Event Settings (`/event_settings/{settingId}`)**: Public `get` allowed for valid IDs; `create`/`update` restricted strictly to `isAdmin()` with server timestamp `request.time`.

## 2. "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. Unauthenticated `list` on `/registrations` (PII scrape attempt).
2. Unauthenticated `get` on `/registrations/{id}` (PII single-record scrape).
3. Unverified email (`email_verified: false`) admin email spoof on `/registrations` read or write.
4. Public `create` on `/registrations/{id}` with `checkedIn: true` pre-set.
5. Public `create` on `/registrations/{id}` with forged client `createdAt != request.time`.
6. Public `create` on `/registrations/{id}` with shadow field `isAdmin: true`.
7. Public `create` on `/registrations/{id}` with invalid ID > 128 chars or special characters.
8. Public `create` on `/registrations/{id}` with out-of-range age (`age: 99` or `age: 1`).
9. Public `create` on `/registrations/{id}` with unknown competition ID in `competitions`.
10. Unauthenticated or non-admin `update` trying to mark `checkedIn: true` directly in Firestore.
11. Admin `update` attempting to alter immutable `registrationCode` or `createdAt`.
12. Non-admin authenticated user attempting to write `/admins/{uid}` (self-escalation).
