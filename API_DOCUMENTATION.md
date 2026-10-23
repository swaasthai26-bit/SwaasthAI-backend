# SwaasthAI — Hospital Discovery, Insurance & Blood Donor API

**Frontend Integration Reference**

**Live base URL: `http://13.206.7.202/api/v1`**  ·  Uploaded files: `http://13.206.7.202/uploads/...`

> **Verified against the live server on 2026-08-12.** Every endpoint below was executed against `http://13.206.7.202`; the sample responses are real (values trimmed). Endpoints that behave differently from what the source implies are flagged inline with 🐞.
>
> **Read §0 first — it lists 4 things that will break your integration if you assume otherwise.**

---

## 0. Verified findings you must handle

| # | Finding | Impact on frontend |
|---|---|---|
| 1 | **Undefined fields are omitted, not `null`.** A new user's `/me` response has **no** `firstName`, `lastName`, `dateOfBirth`, `gender`, `address`, `emergencyContact` keys at all. Hospital/doctor **detail** responses have no `distanceKm` key. | Use optional chaining / default values everywhere. Never assume a key exists. |
| 2 | 🐞 **Blood donor detail + contact-link are broken for self-registered donors.** `GET /blood-donors` returns rows with `source: "user"` whose `id` is a **User** id, but `GET /blood-donors/:id` and `POST /blood-donors/:id/contact-link` look up only the admin donor table → both return `NOT_FOUND` (HTTP 500). Verified live. | Do **not** build a donor-detail screen off the search result for `source: "user"` rows. The search response already contains `phone`, so build the WhatsApp link client-side. Only `source: "admin"` rows work with those two endpoints. |
| 3 | 🐞 **`POST /insurance/leads` never links the user.** The route has no auth middleware, so `userId` is **always `null`** even when you send a Bearer token. Verified live. | Send `name`/`phone` explicitly in the body — don't rely on the server knowing who the user is. |
| 4 | **Query schemas are strict.** `GET /hospitals?foo=bar` → `Unrecognized key: "foo"` (HTTP 500). | Strip empty/extra query params before sending. Never forward UI state as query params. |

Also confirmed on this server: **SMTP is not configured**, so `POST /insurance/leads` returns `emailStatus: "failed"`, `emailLastError: "Insurance lead email is not configured"`. The lead is still saved — treat the request as successful.

---

## 1. Conventions

### 1.1 Global response envelope

Every **successful** response is wrapped by a response formatter middleware:

```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": { }
}
```

`message` defaults by HTTP method unless the endpoint sets its own:

| Method | Default message |
|---|---|
| GET | `Data fetched successfully` |
| POST | `Data inserted successfully` |
| PUT / PATCH | `Data updated successfully` |
| DELETE | `Data deleted successfully` |

> **Important — nested `data`.** When an endpoint returns both a list *and* pagination, the envelope nests them:
> ```json
> { "status": true, "message": "...", "data": { "data": [...], "pagination": {...} } }
> ```
> Read those as `res.data.data` and `res.data.pagination`. Each endpoint below shows its exact final shape, so follow the shape shown rather than guessing.

### 1.2 Error envelope

```json
{
  "status": false,
  "message": "Human readable message",
  "code": "OPTIONAL_ERROR_CODE"
}
```

> ⚠️ **HTTP status codes are non-standard.** All of the following were captured from the live server:

| Real request | HTTP | Body |
|---|---|---|
| `GET /hospitals/000000000000000000000000` | **500** | `{"status":false,"message":"Hospital not found","code":"NOT_FOUND"}` |
| `GET /hospitals/not-an-id` | **500** | `{"status":false,"message":"hospitalId: Invalid ObjectId","code":"VALIDATION_ERROR"}` |
| `GET /doctors/000000000000000000000000` | **403** | `{"status":false,"message":"Doctor not found","code":"NOT_FOUND"}` |
| `POST /auth/otp/send` bad phone | **500** | `{"status":false,"message":"Phone must be in +91XXXXXXXXXX format (Indian mobile)","code":"VALIDATION_ERROR"}` |
| `POST /auth/otp/verify` no OTP issued | **403** | `{"status":false,"message":"OTP expired or not requested. Please request a new one.","code":"OTP_NOT_FOUND"}` |
| `POST /auth/otp/send` within cooldown | **500** | `{"status":false,"message":"Please wait 29s before requesting another OTP","code":"RATE_LIMITED"}` |
| `POST /auth/refresh` with an already-used token | **403** | `{"status":false,"message":"Refresh token reuse detected; all sessions revoked","code":"TOKEN_REUSED"}` |
| `GET /me` without header | **403** | `{"status":false,"message":"Missing or malformed Authorization header","code":"AUTH_REQUIRED"}` |
| `GET /admin/analytics` as normal user | **403** | `{"status":false,"message":"Insufficient permissions","code":"FORBIDDEN"}` |
| `GET /hospitals?foo=bar` | **500** | `{"status":false,"message":"Unrecognized key: \"foo\"","code":"VALIDATION_ERROR"}` |
| `GET /blood-donors?bloodGroup=O%2B` (missing `state`) | **400** | `{"status":false,"message":"state: Invalid input: expected string, received undefined"}` — **no `code` field** |
| `POST /reviews` bad rating | **400** | `{"status":false,"message":"rating: Invalid input: expected number, received NaN"}` — **no `code` field** |
| `GET /nope` | **404** | `{"status":false,"message":"Route not found"}` — **no `code` field** |

Rules that follow from the above:

- **Never branch on the HTTP status.** Check `body.status === false`, then `body.code`, then `body.message`.
- **500 usually is not a crash** — it is most often *not found*, *validation failed*, *conflict*, or *rate limited*.
- **`code` is not always present.** Zod errors raised directly in a handler (HTTP 400) and the 404 handler send only `status` + `message`. Guard with `body.code ?? "UNKNOWN"`.
- **"Not found" is inconsistent**: hospitals → 500, doctors → 403. Match on `code === "NOT_FOUND"`, not the status.
- **`TOKEN_REUSED` (403) must force a full logout** — the server has already revoked every session for that user.
- `message` is safe to show to users; it is a plain sentence, already localized to English.

### 1.3 Authentication

```
Authorization: Bearer <accessToken>
```

- Access token TTL: **45 days** (`JWT_ACCESS_TTL_SECONDS`, default `3888000` s)
- Refresh token TTL: **7 days** (`JWT_REFRESH_TTL_SECONDS`, default `604800` s)
- Roles: `user` · `content_admin` · `platform_admin`
- Admin routes require `content_admin` or `platform_admin`.

### 1.4 Localization

Send `x-locale: en | hi | or` (default `en`). Affects hospital display names and specialization labels.

### 1.5 File uploads

Endpoints marked **multipart** accept `multipart/form-data`. In multipart mode, object/array fields must be sent as **JSON strings** (the listed `jsonFields`), numbers/booleans are coerced. The server stores the file under `/uploads` and returns an absolute URL in the response.

### 1.6 Pagination shapes

Two shapes exist in the codebase — check each endpoint:

```json
{ "page": 1, "limit": 20, "total": 57, "totalPages": 3 }
{ "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 }
```

---

## 2. Health / Meta

| Method | Path | Auth |
|---|---|---|
| GET | `/` | – |
| GET | `/health` | – |
| GET | `/api/health` | – |

`GET /health` — **verified live**. Note the inner `status` is the string `"ok"`, while the outer `status` is the boolean envelope flag:
```json
{ "status": true, "message": "Data fetched successfully", "data": { "status": "ok", "locale": "en" } }
```

`GET /` — **verified live**:
```json
{
  "status": true,
  "message": "Hospital Discovery & Insurance Platform API",
  "data": {
    "baseRoute": "/api/v1",
    "supportedLocales": ["en", "hi", "or"],
    "localizationInfo": {
      "description": "Use 'x-locale' header to set language",
      "supportedValues": { "en": "English", "hi": "हिन्दी (Hindi)", "or": "ଓଡ଼ିଆ (Odia)" },
      "defaultLocale": "en",
      "example": "x-locale: hi"
    }
  }
}
```

---

## 3. Auth — `/api/v1/auth`

> **Dev note:** OTP generation is currently hardcoded to **`123456`** (see `authController.generateOtp`). Swap to random before production.

Rate limits: 60 s resend cooldown, max 5 OTP requests / 15 min, 5 wrong attempts → lockout (escalating).

### POST `/auth/otp/send`
```json
{ "phone": "+919876543210", "deviceId": "optional-device-id" }
```
`phone` must match `^\+91[6-9]\d{9}$`.

**200**
```json
{ "status": true, "message": "OTP sent successfully" }
```
*(no `data` key on this endpoint)*

**Errors:** `RATE_LIMITED` (503-style body, HTTP 500) with `retryAfterSeconds` in details.

---

### POST `/auth/otp/verify`
```json
{ "phone": "+919876543210", "otp": "123456" }
```

**200 — real response from a first-time signup (note how many user keys are simply absent):**
```json
{
  "status": true,
  "message": "Signup successful",
  "data": {
    "user": {
      "id": "6a7c299cd2c79311154d7280",
      "phone": "+919000000001",
      "role": "user",
      "isPhoneVerified": true,
      "isActive": true,
      "photoUrl": null,
      "familyMembers": [],
      "savedHospitals": [],
      "savedInsurancePlans": [],
      "preferences": { "language": "en", "theme": "system", "notifications": true },
      "isRegistered": false,
      "isDonor": false,
      "donorBloodGroup": null,
      "isAvailable": false,
      "isContactVisible": false,
      "lastDonationDate": null,
      "eligibilitySelfDeclared": false,
      "viewCount": 0,
      "donateCount": 0,
      "stopAsDonor": false,
      "isDonorVerified": false,
      "createdAt": "2026-08-12T08:06:52.167Z",
      "updatedAt": "2026-08-12T08:06:52.167Z"
    },
    "isNewUser": true,
    "requiresProfileCompletion": true,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessTokenExpiresIn": 3888000,
    "refreshTokenExpiresIn": 604800
  }
}
```
⚠️ `firstName`, `lastName`, `dateOfBirth`, `gender`, `address`, `emergencyContact` are **missing keys**, not `null`. They appear only after `PUT /me`.

`message` is `"Login successful"` for a returning user (`isNewUser: false`).
`requiresProfileCompletion` is `true` until `firstName`, `dateOfBirth` and `gender` are all set → route the user to the profile-completion screen.

**Errors:** `OTP_NOT_FOUND`, `OTP_INVALID` (details carry `attemptsRemaining`), `RATE_LIMITED`.

---

### POST `/auth/refresh`
```json
{ "refreshToken": "eyJhbGciOi..." }
```
**200** — refresh tokens are **rotated**; store the new one and discard the old.
**Reuse is detected**: sending the same refresh token twice returns HTTP 403 `TOKEN_REUSED` — *"Refresh token reuse detected; all sessions revoked"* — and kills every session for that user. Handle this by clearing local storage and sending the user to login.
```json
{
  "status": true,
  "message": "Data inserted successfully",
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "accessTokenExpiresIn": 3888000,
    "refreshTokenExpiresIn": 604800
  }
}
```

---

### POST `/auth/logout`
```json
{ "refreshToken": "optional" }
```
**200** — idempotent.
```json
{ "status": true, "message": "Logout successful" }
```

### POST `/auth/logout-all` 🔒
Requires `Authorization` header. Revokes every session for the user.
```json
{ "status": true, "message": "Logout successful" }
```

---

## 4. Current User — `/api/v1/me` 🔒

### 4.1 The User object

Returned by almost every `/me` endpoint as `data`. **This is the fully-populated shape** — any field the user has not set is *absent from the JSON*, so treat every key below except `id`, `phone`, `role`, `isPhoneVerified`, `isActive`, `isRegistered`, `createdAt`, `updatedAt` as optional:

```json
{
  "id": "66f1a2b3c4d5e6f708192a3b",
  "phone": "+919876543210",
  "role": "user",
  "isPhoneVerified": true,
  "isActive": true,
  "firstName": "Nikhil",
  "lastName": "Sharma",
  "dateOfBirth": "1998-04-12T00:00:00.000Z",
  "gender": "male",
  "photoUrl": "https://host/uploads/nikhil_sharma_1712345678.jpg",
  "address": {
    "line": "Plot 21, Sector 5",
    "city": "Bhubaneswar",
    "state": "Odisha",
    "pincode": "751001",
    "location": { "type": "Point", "coordinates": [85.8245, 20.2961] }
  },
  "familyMembers": [
    {
      "id": "66f1...",
      "name": "Asha Sharma",
      "dateOfBirth": "1970-01-05T00:00:00.000Z",
      "age": 55,
      "relation": "mother",
      "gender": "female",
      "bloodGroup": "B+",
      "mobileNumber": "+919812345678",
      "photoUrl": null
    }
  ],
  "savedHospitals": ["66f1a2..."],
  "savedInsurancePlans": ["66f1b3..."],
  "emergencyContact": { "name": "Asha", "phone": "+919812345678", "relation": "mother" },
  "preferences": { "language": "en", "theme": "system", "notifications": true },
  "isRegistered": true,

  "isDonor": true,
  "donorBloodGroup": "O+",
  "isAvailable": true,
  "isContactVisible": false,
  "lastDonationDate": "2025-11-02T00:00:00.000Z",
  "eligibilitySelfDeclared": true,
  "viewCount": 12,
  "donateCount": 3,
  "stopAsDonor": false,
  "isDonorVerified": false,

  "createdAt": "2025-01-11T10:00:00.000Z",
  "updatedAt": "2026-08-10T07:30:00.000Z"
}
```
`isRegistered` = `firstName && dateOfBirth && gender` are all present.

---

### GET `/me`
→ `data` = User object.

### PUT `/me`
All fields optional; at least one required. Strict schema — unknown keys are rejected.

```json
{
  "firstName": "Nikhil",
  "lastName": "Sharma",
  "dateOfBirth": "1998-04-12",
  "gender": "male",
  "photoUrl": "https://...",
  "address": {
    "line": "Plot 21, Sector 5",
    "city": "Bhubaneswar",
    "state": "Odisha",
    "pincode": "751001",
    "location": { "type": "Point", "coordinates": [85.8245, 20.2961] }
  },
  "emergencyContact": { "name": "Asha", "phone": "+919812345678", "relation": "mother" },
  "preferences": { "language": "en", "theme": "dark", "notifications": true },
  "dpdpConsentAccepted": true,
  "donor": {
    "isDonor": true,
    "donorBloodGroup": "O+",
    "donorCity": "Bhubaneswar",
    "donorPincode": "751001",
    "lastDonationDate": "2025-11-02",
    "isAvailable": true,
    "eligibilitySelfDeclared": true
  }
}
```
Rules:
- `dateOfBirth` — `YYYY-MM-DD`, past date, **age ≥ 13**
- `pincode` — 6 digits · phones — `+91XXXXXXXXXX`
- `location.coordinates` — **`[longitude, latitude]`**
- `donor` block: to enrol send `isDonor: true` **with** `donorBloodGroup` and `eligibilitySelfDeclared: true`. To unenrol send `{ "isDonor": false }` only.

→ `data` = updated User object.

### DELETE `/me`
Soft-deletes the account.
```json
{ "status": true, "message": "User deleted successfully" }
```

### POST `/me/photo` — **multipart**
Field `photo` (1 file, required).
→ `data` = updated User object with new `photoUrl`.

### DELETE `/me/photo`
→ `data` = User object with `photoUrl: null`.

---

### Change phone

**POST `/me/change-phone/otp/send`**
```json
{ "newPhone": "+919812345678", "deviceId": "optional" }
```
→ `{ "status": true, "message": "OTP sent successfully" }`
Errors: `PHONE_ALREADY_REGISTERED`, `RATE_LIMITED`.

**POST `/me/change-phone/otp/verify`**
```json
{ "newPhone": "+919812345678", "otp": "123456" }
```
→ `data` = User object with the new phone.

---

### Family members

**GET `/me/family-members`**
```json
{ "status": true, "message": "Data fetched successfully", "data": [ { "id": "...", "name": "...", "age": 55, "...": "" } ] }
```

**POST `/me/family-members`** — **multipart** (optional file field `photo`)

Body fields:
| Field | Required | Rule |
|---|---|---|
| `name` | ✔ | 2–100 chars |
| `dateOfBirth` | ✔ | `YYYY-MM-DD`, age ≥ 13 |
| `relation` | ✔ | 2–50 chars |
| `gender` | ✔ | `male`\|`female`\|`other` |
| `mobileNumber` | – | `+91XXXXXXXXXX` |
| `bloodGroup` | – | `A+ A- B+ B- AB+ AB- O+ O-` |
| `photo` (file) | – | image |

→ `{ "status": true, "message": "Member added successfully", "data": { …User object } }`

**PUT `/me/family-members/:id`** — **multipart**, all fields optional
→ `message: "Member updated successfully"`, `data` = User object.

**DELETE `/me/family-members/:id`**
→ `message: "Member deleted successfully"`, `data` = User object.

**DELETE `/me/family-members/:id/photo`**
→ `data` = User object.

---

### Saved items & preferences

| Method | Path | Response `data` |
|---|---|---|
| POST | `/me/saved/hospitals/:id` | User object |
| DELETE | `/me/saved/hospitals/:id` | User object |
| GET | `/me/saved/insurance` | array of insurance plan **summaries** (§7.1) |
| POST | `/me/saved/insurance/:id` | `{ "savedInsurancePlans": ["id1","id2"] }` — max **10** saved plans |
| DELETE | `/me/saved/insurance/:id` | `{ "savedInsurancePlans": [...] }` |
| PUT | `/me/preferences` | User object — body: `{ "language":"en", "theme":"dark", "notifications":true }` |

---

### FCM / device tokens

| Method | Path | Body | Response `data` |
|---|---|---|---|
| POST | `/me/fcm-tokens` | `{ "token":"...", "deviceId":"...", "platform":"android" }` | User object |
| DELETE | `/me/fcm-tokens/:deviceId` | – | User object |
| POST | `/devices/register` | same as above | User object |
| DELETE | `/devices/:deviceId` | – | User object |

---

### Recently viewed

**GET `/me/recently-viewed?lat=&lng=&limit=6`** (max 10 items stored, `limit` 1–20, default 6)

```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": [
    {
      "type": "hospital",
      "id": "66f1...",
      "name": "Apollo Hospital",
      "city": "Bhubaneswar",
      "photo": "https://host/uploads/apollo_1.jpg",
      "rating": { "avg": 4.6, "count": 128 },
      "startingConsultationFee": 500,
      "specializations": ["cardiology", "orthopedics"],
      "distanceKm": 3.2,
      "viewedAt": "2026-08-10T06:10:00.000Z"
    },
    {
      "type": "doctor",
      "id": "66f2...",
      "name": "Dr. Meera Rao",
      "photo": null,
      "specializations": ["cardiology"],
      "city": "Bhubaneswar",
      "rating": { "avg": 4.8, "count": 40 },
      "consultationFee": 700,
      "distanceKm": null,
      "viewedAt": "2026-08-10T06:05:00.000Z"
    }
  ]
}
```
Views are recorded automatically when a logged-in user calls `GET /hospitals/:id` or `GET /doctors/:id`.

**DELETE `/me/recently-viewed`** → `{ "status": true, "message": "Recently viewed cleared" }`

---

## 5. Hospitals — `/api/v1/hospitals`

### 5.1 Hospital object

```json
{
  "id": "66f1a2b3c4d5e6f708192a3b",
  "name": "Apollo Hospital",
  "localizedName": { "hi": "अपोलो अस्पताल", "or": "ଆପୋଲୋ ଡାକ୍ତରଖାନା" },
  "slug": "apollo-hospital-bbsr",
  "description": "Multi-speciality tertiary care hospital",
  "location": { "type": "Point", "coordinates": [85.8245, 20.2961] },
  "address": "Plot 251, Sainik School Road",
  "city": "Bhubaneswar",
  "state": "Odisha",
  "pincode": "751005",
  "country": "India",
  "whatsappNumber": "+919876543210",
  "contactPhone": "+916742345678",
  "contactEmail": "care@apollobbsr.com",
  "specializations": ["cardiology", "orthopedics"],
  "amenities": ["pharmacy", "ambulance", "icu"],
  "photos": [ { "url": "https://host/uploads/apollo_1.jpg", "caption": "Front", "order": 0 } ],
  "timings": {
    "mon": { "open": "09:00", "close": "21:00", "isClosed": false },
    "tue": { "open": "09:00", "close": "21:00" },
    "wed": { "open": "09:00", "close": "21:00" },
    "thu": { "open": "09:00", "close": "21:00" },
    "fri": { "open": "09:00", "close": "21:00" },
    "sat": { "open": "09:00", "close": "18:00" },
    "sun": { "open": "00:00", "close": "00:00", "isClosed": true }
  },
  "holidays": ["2026-01-26T00:00:00.000Z"],
  "acceptedInsurancePlans": ["66f1b3..."],
  "startingConsultationFee": 500,
  "rating": { "avg": 4.6, "count": 128 },
  "status": "active",
  "isVerified": true,
  "verifiedAt": "2025-06-01T00:00:00.000Z",
  "distanceKm": 3.2,
  "isOpenNow": true,
  "hasWhatsApp": true,
  "hasCashless": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z"
}
```
`distanceKm` is present only when `lat`/`lng` were supplied. `isOpenNow` is computed in IST.

---

### GET `/hospitals` — search / list (public)

Query params (all optional, **strict** — unknown params are rejected):

| Param | Type | Notes |
|---|---|---|
| `lat`, `lng` | number | enables distance sorting + `distanceKm` |
| `radius` | number | 2–50, default 10 (km) |
| `specialization` | csv string | e.g. `cardiology,neurology` |
| `minRating` | number | 0–5 |
| `hasCashless` | `true`\|`false` | |
| `city` | string | |
| `pincode` | 6 digits | |
| `minFee`, `maxFee` | number | consultation fee range |
| `acceptedInsurancePlan` | plan id | |
| `insurerName` | string | resolved to plan ids, e.g. `Star Health` |
| `openNow` | `true`\|`false` | bypasses cache |
| `q` | string | free text |
| `sort` | `distance`\|`rating`\|`fee`\|`fee_desc`\|`popularity`\|`cashless` | default `distance` |
| `gender` | `male`\|`female`\|`other` | doctor-gender availability |
| `availableDate` | `YYYY-MM-DD` | |
| `page` | number | default 1 |
| `pageSize` | number | 1–100, default 20 |

**200**
```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "data": [ { "…Hospital object": "" } ],
    "pagination": { "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 }
  }
}
```
Public callers only see verified/active hospitals; admin tokens see pending/unverified ones too.

---

### GET `/hospitals/nearby` (public)

`?lat=20.29&lng=85.82&radius=10&limit=20&page=1&q=apollo&hasCashless=true`
`lat` + `lng` are **required**. `radius` clamped 2–50, `limit` 1–100.

```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "data": [ { "…Hospital object": "" } ],
    "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 },
    "location": { "lat": 20.29, "lng": 85.82 },
    "radius": 10
  }
}
```

---

### GET `/hospitals/top-rated` (public)

`?lat=&lng=&radius=10&limit=10&minRating=4.5&page=1` — `lat`/`lng` required.

```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "data": [ { "…Hospital object": "", "isTopRated": true, "hasCashless": true } ],
    "pagination": { "page": 1, "limit": 10, "total": 5, "totalPages": 1 },
    "meta": { "location": { "lat": 20.29, "lng": 85.82 }, "radiusKm": 10, "minRating": 4.5 }
  }
}
```

---

### GET `/hospitals/nearby-me` 🔒

Uses the saved address coordinates on the user profile. `?radius=10` optional.

```json
{
  "status": true,
  "message": "Found 8 hospitals within 10 km of your location",
  "data": {
    "data": [ { "…Hospital object": "" } ],
    "userLocation": {
      "lat": 20.2961, "lng": 85.8245,
      "address": "Plot 21, Sector 5",
      "city": "Bhubaneswar", "state": "Odisha", "pincode": "751001"
    },
    "radius": 10,
    "totalFound": 8
  }
}
```
**Errors (HTTP 403):** `ADDRESS_NOT_FOUND`, `LOCATION_COORDINATES_MISSING`, `INVALID_COORDINATES`, `INVALID_COORDINATE_VALUES`, `COORDINATES_OUT_OF_RANGE`. Call the readiness endpoint below before showing this screen.

### GET `/hospitals/check-profile-readiness` 🔒

```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "isReady": true,
    "missingFields": [],
    "userInfo": { "id": "...", "phone": "+919876543210", "firstName": "Nikhil", "lastName": "Sharma" },
    "addressInfo": {
      "line": "Plot 21", "city": "Bhubaneswar", "state": "Odisha", "pincode": "751001",
      "location": { "coordinates": [85.8245, 20.2961], "lat": 20.2961, "lng": 85.8245 }
    },
    "requiredToSearch": true,
    "instructions": ["Your profile is ready! ..."]
  }
}
```

---

### GET `/hospitals/:id` (public, optional auth)

`id` must be a 24-char ObjectId. → `data` = Hospital object.
If a valid Bearer token is sent, the view is recorded into *recently viewed*.

### GET `/hospitals/:id/doctors` (public)
→ `data` = array of Doctor objects (§6.1).

### GET `/hospitals/:id/insurance` (public)
→ `data` = array of insurance plan **details** each with `"cashless": true` added.

### GET `/hospitals/:id/reviews` (public)
→ `data` = array of approved Review objects (§10.1).

---

### Admin hospital endpoints

Available under **both** `/hospitals/...` (role checked in the controller) and `/admin/hospitals/...`. Prefer the `/admin` prefix.

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/hospitals` | same query params as `GET /hospitals`, includes unverified |
| POST | `/admin/hospitals` | **multipart**, 1–8 images in field `photos` |
| PUT | `/admin/hospitals/:id` | **multipart**, all fields optional |
| DELETE | `/admin/hospitals/:id/photos/:photoIndex` | index is 0-based |
| DELETE | `/admin/hospitals/:id` | soft delete → `{ "message": "Hospital deleted" }` |
| POST | `/admin/hospitals/:id/verify` | sets `isVerified: true, status: "active"` |
| POST | `/admin/hospitals/import` | ⚠️ **not implemented** — always errors `NOT_IMPLEMENTED` |

**Create body** (multipart; `jsonFields` must be JSON strings: `location`, `specializations`, `amenities`, `timings`, `holidays`, `acceptedInsurancePlans`):

```
name=Apollo Hospital
slug=apollo-hospital-bbsr           # lowercase, a-z0-9-
description=...
address=Plot 251...                 # 5–500 chars
city=Bhubaneswar
state=Odisha
pincode=751005                      # 6 digits
country=India
contactPhone=+916742345678          # required
contactEmail=care@apollo.com        # required
whatsappNumber=+919876543210        # optional
startingConsultationFee=500         # number, >= 0
isVerified=false
status=pending                      # pending|active|suspended|closed
location={"type":"Point","coordinates":[85.8245,20.2961]}
specializations=["cardiology","orthopedics"]
amenities=["pharmacy","icu"]
timings={"mon":{"open":"09:00","close":"21:00"}, ... all 7 days required}
holidays=["2026-01-26T00:00:00.000Z"]
acceptedInsurancePlans=["66f1b3..."]
photos=<file> (1–8)
```
→ `data` = created Hospital object.

---

## 6. Doctors — `/api/v1/doctors`

### 6.1 Doctor object

```json
{
  "id": "66f2a1...",
  "name": "Dr. Meera Rao",
  "photo": "https://host/uploads/dr_meera_rao.jpg",
  "qualification": "MBBS, MD (Cardiology)",
  "specialization": "cardiology",
  "languages": ["English", "Hindi", "Odia"],
  "experienceYears": 12,
  "registrationNumber": "OMC-45211",
  "bio": "Senior consultant cardiologist...",
  "gender": "female",
  "consultationFee": 700,
  "hospitalAffiliations": [
    {
      "hospitalId": "66f1a2...",
      "hospitalName": "Apollo Hospital",
      "whatsappNumber": "+919876543210",
      "consultationFee": 700,
      "isPrimary": true,
      "joinedAt": "2020-03-01T00:00:00.000Z"
    }
  ],
  "availability": [
    { "hospitalId": "66f1a2...", "dayOfWeek": "Monday", "startTime": "10:00", "endTime": "14:00" }
  ],
  "rating": { "avg": 4.8, "count": 40 },
  "isActive": true,
  "distanceKm": 3.2,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z"
}
```
`consultationFee` is taken from the **primary** affiliation. `distanceKm` appears only in list results when `lat`/`lng` are supplied (else `null`).

---

### GET `/doctors` (public)

Query: `q`, `specialization` (csv), `gender`, `minRating`, `city`, `availableDate` (`YYYY-MM-DD`), `lat`, `lng`, `page`, `pageSize`.

**With any filter/pagination param:**
```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "data": [ { "…Doctor object": "" } ],
    "pagination": { "page": 1, "pageSize": 20, "total": 31, "totalPages": 2 }
  }
}
```
**With no params at all** the service returns a plain array:
```json
{ "status": true, "message": "Data fetched successfully", "data": [ { "…Doctor object": "" } ] }
```
> Always send at least `page=1&pageSize=20` so you get the paginated shape consistently.

### GET `/doctors/hospital/:hospitalId` (public)
→ `data` = **array** of Doctor objects (note: `GET /hospitals/:id/doctors` returns the same list — both end up as `data: [...]`).

### GET `/doctors/:id` (public, optional auth)
→ `data` = Doctor object. Records a *recently viewed* entry when authenticated.

### GET `/doctors/:id/reviews` (public)
→ `data` = array of approved Review objects.

---

### Admin doctor endpoints

Under `/doctors/...` (role checked inside) and `/admin/doctors/...`.

| Method | Path | Notes |
|---|---|---|
| POST | `/admin/doctors` | **multipart**, optional file `photo` |
| PUT | `/admin/doctors/:id` | **multipart**, all fields optional |
| DELETE | `/admin/doctors/:id` | `{ "message": "Doctor deleted" }` |
| POST | `/admin/doctors/import` | ⚠️ **not implemented** |

**Create body** (`jsonFields`: `languages`, `hospitalAffiliations`, `availability`):
```
name=Dr. Meera Rao              # required, 2–200
qualification=MBBS, MD          # required
primarySpecialization=cardiology # required
registrationNumber=OMC-45211    # required
experienceYears=12
bio=...
gender=female
isActive=true
languages=["English","Hindi"]
hospitalAffiliations=[{"hospitalId":"66f1a2...","consultationFee":700,"isPrimary":true}]   # min 1
availability=[{"hospitalId":"66f1a2...","dayOfWeek":"Monday","startTime":"10:00","endTime":"14:00"}]
photo=<file>
```
→ `data` = created Doctor object.

---

## 7. Insurance — `/api/v1/insurance`

### 7.1 Plan **summary** (list responses)

```json
{
  "id": "66f1b3...",
  "insurerName": "Star Health",
  "insurerLogoUrl": "https://host/uploads/star_health.png",
  "planName": "Family Health Optima",
  "planType": "family_floater",
  "premium": { "monthly": 1200, "quarterly": 3400, "halfYearly": 6600, "annual": 12500 },
  "coverageAmount": 500000,
  "cashlessHospitalCount": 34,
  "highlightFeatures": ["No room rent capping", "Day-1 maternity cover"],
  "isIrdaiApproved": true,
  "claimsSettledPercent": 96.4,
  "isRecommended": true,
  "isBestValue": false,
  "roomRent": "Single private room",
  "restoration": "100% once a year",
  "bonus": "50% no-claim bonus",
  "rating": { "avg": 4.3, "count": 210 },
  "maxMembersAllowed": 6,
  "applyUrl": "https://insurer.com/apply?utm_source=swaasthai_app&utm_medium=app&utm_campaign=insurance_discovery",
  "lastUpdatedAt": "2026-07-20T00:00:00.000Z",
  "isActive": true,
  "isStale": false,
  "availabilityMessage": "No longer available"
}
```
`maxMembersAllowed`: individual 1 · family_floater 6 · senior_citizen 2 · critical_illness 1 · maternity 2.
`isStale` = plan not updated in >30 days. `availabilityMessage` present only when `isActive` is false.

### 7.2 Plan **detail** = summary **plus**
```json
{
  "sumInsuredOptions": [300000, 500000, 1000000],
  "features": [ { "key": "room_rent", "value": "No capping", "isHighlight": true } ],
  "exclusions": ["Cosmetic surgery", "Self-inflicted injury"],
  "waitingPeriods": [ { "condition": "Pre-existing diseases", "days": 1095 } ],
  "ageRange": { "min": 18, "max": 65 },
  "cashlessHospitals": ["66f1a2..."],
  "faqs": [ { "question": "Is maternity covered?", "answer": "Yes, after 9 months." } ]
}
```

---

### GET `/insurance/plans` (public)

Query: `page`, `limit` (≤100), `planType`, `q` *or* `search`, `minPremium`, `maxPremium`, `minCoverage`, `maxCoverage`, `hasCashlessNearby=true|false`, `sort` = `premium|premium_desc|coverage|updatedAt|recommended`.

`planType` accepts friendly aliases: `all` (no filter), `individual`, `family` → `family_floater`, `senior` → `senior_citizen`, `critical` → `critical_illness`, `maternity`. The legacy `?type=` param is also accepted.

```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "data": [ { "…Plan summary": "" } ],
    "pagination": { "page": 1, "limit": 20, "total": 18, "totalPages": 1 }
  }
}
```

### GET `/insurance/plans/:id` (public)
→ `data` = Plan detail.

### GET `/insurance/compare?ids=id1,id2,id3` (public)
1–3 ids. → `data` = array of Plan details (order preserved, missing ids dropped).

### GET `/insurance/plans/:id/cashless-near?lat=&lng=&radius=10` (public)
`lat`/`lng` required, `radius` 1–50 (default 10).
```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "data": [
      {
        "id": "66f1a2...", "name": "Apollo Hospital", "city": "Bhubaneswar", "state": "Odisha",
        "address": "Plot 251...", "contactPhone": "+916742345678", "contactEmail": "care@apollo.com",
        "location": { "type": "Point", "coordinates": [85.8245, 20.2961] },
        "distanceKm": 3.2
      }
    ],
    "total": 1
  }
}
```

### Saved plans 🔒
| Method | Path | Response `data` |
|---|---|---|
| GET | `/insurance/plans/saved` | array of Plan summaries |
| POST | `/insurance/plans/:id/save` | `{ "savedInsurancePlans": ["id1"] }` (max 10) |
| DELETE | `/insurance/plans/:id/save` | `{ "savedInsurancePlans": [...] }` |

### POST `/insurance/leads` (public)

🐞 **`userId` is always `null`.** The route has no auth middleware, so sending a Bearer token changes nothing — verified live. Always supply `name` and `phone` in the body yourself.

```json
{
  "planId": "66f1b3...",
  "name": "Nikhil Sharma",
  "phone": "+919876543210",
  "email": "nikhil@example.com",
  "message": "Please call me in the evening"
}
```
```json
{
  "status": true,
  "message": "Lead captured. Our team will contact you shortly.",
  "data": {
    "_id": "66f9...", "userId": null, "planId": "66f1b3...",
    "name": "Nikhil Sharma", "phone": "+919876543210", "email": "nikhil@example.com",
    "message": "Please call me in the evening",
    "status": "new", "notes": [],
    "emailStatus": "sent", "emailRetryCount": 1, "emailLastError": null,
    "createdAt": "2026-08-10T07:00:00.000Z", "updatedAt": "2026-08-10T07:00:00.000Z"
  }
}
```
`emailStatus` may be `sent` / `failed` / `pending` depending on SMTP config — the lead is saved either way.
**On `13.206.7.202` today this returns `"emailStatus":"failed"`, `"emailLastError":"Insurance lead email is not configured"`.** Treat the call as successful regardless; do not surface `emailStatus` to the user.

---

### Admin insurance endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/admin/insurance-plans` | **multipart**, file field `logo` (required, 1) → `insurerLogoUrl` |
| PUT | `/admin/insurance-plans/:id` | **multipart**, logo optional |
| DELETE | `/admin/insurance-plans/:id` | `{ "message": "Insurance plan deleted successfully" }` |
| GET | `/admin/leads` | `?page=&limit=&status=new\|contacted\|converted\|lost&planId=` → `data: { data:[…leads], pagination }` |
| PUT | `/admin/leads/:id` | `{ "status": "contacted", "note": "Called, interested" }` → `data` = lead |

Plan `jsonFields` for multipart: `premium`, `sumInsuredOptions`, `cashlessHospitals`, `features`, `exclusions`, `waitingPeriods`, `ageRange`, `faqs`. `applyUrl` **must** start with `https://`. `lastUpdatedAt` is required on create.

---

## 8. Blood Donors

### GET `/api/v1/blood-donors` (public) — search

**Required:** `bloodGroup`, `state`, `city`, `pincode` (6 digits).
Optional: `lat` + `lng` (together), `radius` 1–50 (default 25), `sort` = `distance|recent`, `page`, `limit`.
`bloodGroup` is normalised — `O`, `o`, `O%2B`, `O ` all resolve to `O+`.

```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "data": [
      {
        "id": "66fa...",
        "source": "user",
        "firstName": "Rahul",
        "photo": "https://host/uploads/rahul.jpg",
        "bloodGroup": "O+",
        "city": "Bhubaneswar",
        "state": "Odisha",
        "age": 27,
        "lastDonationDate": "2025-11-02T00:00:00.000Z",
        "lastAvailableAt": "2026-08-01T00:00:00.000Z",
        "daysSinceLastDonation": 281,
        "mayBeEligible": true,
        "distanceKm": 2.4,
        "isVerified": false,
        "isAvailable": true,
        "isContactVisible": false,
        "phone": "+919876543210",
        "viewCount": 12,
        "donateCount": 3
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 4, "totalPages": 1 }
  }
}
```
`source` is `"user"` (self-registered) or `"admin"` (admin-imported). Admin-source rows carry the same fields but `viewCount`/`donateCount` are absent and only the donor's first name is exposed.

> 🔒 **Privacy note:** this endpoint is **unauthenticated** and returns each donor's full `phone` number in plain text. Confirm this is intended before shipping a public donor list.

---

### 🐞 GET `/api/v1/blood-donors/:id` and POST `/api/v1/blood-donors/:id/contact-link` — broken for `source: "user"`

Both endpoints resolve the `:id` against the **admin `BloodDonor` collection only**. Search results with `source: "user"` carry a **User** `_id`, which does not exist in that collection. Verified live:

```
GET  /api/v1/blood-donors/6a7c29b5d2c79311154d7283
→ 500 {"status":false,"message":"Donor not found","code":"NOT_FOUND"}

POST /api/v1/blood-donors/6a7c29b5d2c79311154d7283/contact-link   (with valid Bearer token)
→ 500 {"status":false,"message":"Donor not available","code":"NOT_FOUND"}
```
…even though that exact id was returned by `GET /blood-donors` moments earlier.

**Frontend workaround until the backend is fixed:**
- Render the donor card entirely from the search-result row — it already has `firstName`, `bloodGroup`, `city`, `state`, `age`, `mayBeEligible`, `daysSinceLastDonation`, `isVerified` and `phone`.
- Build the WhatsApp link client-side:
  `https://wa.me/{phone without + and non-digits}?text={encodeURIComponent(message)}`
- Only call these two endpoints when `row.source === "admin"`.
- Note the workaround skips the server-side **3-contacts-per-donor-per-day** rate limit, so that protection is lost until the backend is fixed.

**When it works (`source: "admin"`)** — `GET /blood-donors/:id` → `data` = `{ id, firstName, bloodGroup, city, lastDonationDate, lastAvailableAt, daysSinceLastDonation, mayBeEligible, distanceKm, isVerified, isAvailable }`, and contact-link returns:
```json
{
  "status": true,
  "message": "Data inserted successfully",
  "data": {
    "donor": { "…public donor summary": "" },
    "whatsappLink": "https://wa.me/919876543210?text=Hi%2C%20I%20found%20you%20via...",
    "message": "Hi, I found you via the SwaasthAI app. I urgently need O+ blood for family member in Bhubaneswar. Are you available to donate? - Nikhil",
    "contactsRemainingToday": 2
  }
}
```

---

### My donor profile 🔒

**GET `/api/v1/me/donor`**
```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "isDonor": true,
    "donorBloodGroup": "O+",
    "city": "Bhubaneswar", "state": "Odisha", "pincode": "751001",
    "isAvailable": true,
    "isContactVisible": false,
    "lastDonationDate": "2025-11-02T00:00:00.000Z",
    "eligibilitySelfDeclared": true,
    "viewCount": 12,
    "donateCount": 3,
    "stopAsDonor": false,
    "name": "Nikhil Sharma",
    "phone": "+919876543210"
  }
}
```
Returns `NOT_FOUND` ("Donor profile not found") if the user is not a donor.

**PUT `/api/v1/me/donor`** — all fields optional (strict schema)
```json
{
  "isDonor": true,
  "bloodGroup": "O+",
  "city": "Bhubaneswar",
  "state": "Odisha",
  "pincode": "751001",
  "lastDonationDate": "2025-11-02",
  "isAvailable": true,
  "eligibilitySelfDeclared": true,
  "isContactVisible": false,
  "stopAsDonor": false
}
```
- `isDonor: true` → (re)enrol and reset counters
- `isDonor: false` → unenrol
- omit `isDonor` → partial update of whatever you send

→ `data` = `{ isDonor, donorBloodGroup, city, state, pincode, isAvailable, isContactVisible, stopAsDonor, lastDonationDate, eligibilitySelfDeclared, viewCount, donateCount }`

**DELETE `/api/v1/me/donor`** → `{ "status": true, "message": "Blood donor profile unregistered successfully" }`

---

### Admin blood-donor endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/blood-donors` | `?page=&limit=&bloodGroup=&city=&isVerified=&isAvailable=&q=` → `data: { data:[…donor docs], pagination }` |
| POST | `/admin/blood-donors` | body: `name, phone, bloodGroup, city` (+ `userId, state, pincode, lastDonationDate, isAvailable, isPhoneVerified, isVerified, eligibilitySelfDeclared`) |
| GET | `/admin/blood-donors/:id` | full donor document |
| PUT | `/admin/blood-donors/:id` | partial update |
| DELETE | `/admin/blood-donors/:id` | `{ "message": "Blood donor deleted successfully" }` |
| PUT | `/admin/blood-donors/:id/verify` | sets `isVerified: true` |
| PUT | `/admin/blood-donors/:id/suspend` | sets `isAvailable: false` |
| POST | `/admin/blood-donors/import` | body `{ "csvContent": "name,phone,bloodGroup,city,pincode,lastDonationDate\n..." }` |
| GET | `/admin/blood-donors/analytics` | see below |

**Import response**
```json
{ "status": true, "message": "Data inserted successfully",
  "data": { "totalRows": 50, "imported": 47, "failed": 3,
            "errors": [ { "row": 12, "message": "Phone number already exists", "data": { } } ] } }
```

**Analytics response** — `data` is an aggregation array with one `$facet` element:
```json
{
  "status": true, "message": "Data fetched successfully",
  "data": [
    {
      "byBloodGroup": [ { "_id": "A+", "count": 21 }, { "_id": "O+", "count": 44 } ],
      "byCity": [ { "_id": "Bhubaneswar", "count": 30 } ],
      "totals": [ { "_id": null, "total": 120, "available": 88, "verified": 41 } ]
    }
  ]
}
```

### Admin user-donor toggles

| Method | Path | Body | Response `data` |
|---|---|---|---|
| PUT | `/admin/users/:id/donor` | any of `isDonor, isAvailable, isContactVisible, stopAsDonor, donateCount, lastDonationDate(YYYY-MM-DD)` | `{ _id, isDonor, isAvailable, isContactVisible, stopAsDonor, isDonorVerified, donorBloodGroup, donateCount, lastDonationDate }`, message `"Donor status updated"` |
| PUT | `/admin/users/:id/donor/verify` | – | `{ _id, isDonorVerified: true }`, message `"Donor verified"` |

---

## 9. Booking Intents — `/api/v1/booking-intents`

A "booking intent" records a click-to-contact and returns a ready-made WhatsApp / tel link.

### POST `/booking-intents` 🔒
```json
{ "hospitalId": "66f1a2...", "doctorId": "66f2a1...", "source": "doctor_profile" }
```
`source` ∈ `hospital_profile | doctor_profile | search_result` (default `doctor_profile`). Rate limit: **10 per hour per hospital per user**.

```json
{
  "status": true,
  "message": "Data inserted successfully",
  "data": {
    "intentId": "66fb...",
    "contactMethod": "whatsapp",
    "actionLink": "https://wa.me/919876543210?text=Hi%2C%20I%20would%20like...",
    "whatsappLink": "https://wa.me/919876543210?text=...",
    "callLink": null,
    "message": "Hi, I would like to book an appointment with Dr. Meera Rao (cardiology) at Apollo Hospital. My name is Nikhil Sharma. Please let me know the available times. - Sent via SwaasthAI app",
    "hospital": { "id": "66f1a2...", "name": "Apollo Hospital", "city": "Bhubaneswar", "contactPhone": "+916742345678", "hasWhatsApp": true },
    "doctor": { "id": "66f2a1...", "name": "Dr. Meera Rao", "primarySpecialization": "cardiology" }
  }
}
```
If the hospital has no WhatsApp number, `contactMethod` is `"call"`, `actionLink` is `tel:+91...`, `whatsappLink` is `null`.

**Errors:** `HOSPITAL_UNAVAILABLE` (unverified/inactive), `HOSPITAL_CLOSED_TODAY`, `DOCTOR_HOSPITAL_MISMATCH`, `RATE_LIMITED`, `NOT_FOUND`.

### GET `/booking-intents/my` 🔒 and GET `/booking-intents` 🔒
Query: `hospitalId`, `doctorId`, `from` (`YYYY-MM-DD`), `to`, `page`, `limit`.
```json
{
  "status": true, "message": "Data fetched successfully",
  "data": {
    "data": [
      {
        "id": "66fb...",
        "userId": "66f1...",
        "user": { "phone": "+919876543210", "name": "Nikhil Sharma" },
        "hospitalId": "66f1a2...",
        "doctorId": "66f2a1...",
        "source": "doctor_profile",
        "contactMethod": "whatsapp",
        "actionLink": "https://wa.me/...",
        "whatsappLink": "https://wa.me/...",
        "callLink": null,
        "message": "Hi, I would like to book...",
        "hospital": { "id": "...", "name": "...", "city": "...", "contactPhone": "...", "hasWhatsApp": true },
        "doctor": { "id": "...", "name": "...", "primarySpecialization": "cardiology" },
        "createdAt": "2026-08-10T07:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
  }
}
```

### GET `/booking-intents/:id` 🔒 — own intent only
→ `data` = single intent object (same shape as above).

### GET `/booking-intents/:id/reopen` 🔒
Regenerates the contact link without creating a new intent.
```json
{ "status": true, "message": "Data fetched successfully",
  "data": { "intentId": "66fb...", "contactMethod": "whatsapp", "actionLink": "...", "whatsappLink": "...", "callLink": null, "message": "..." } }
```

### Admin
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/booking-intents` | adds `userId` + `q` (searches user phone/first/last name) filters |
| GET | `/admin/booking-intents/analytics` | see below |
| GET | `/admin/booking-intents/export` | returns a **CSV file** (`text/csv`, `Content-Disposition: attachment`), *not* JSON. Filters: `userId, hospitalId, doctorId, q, from, to` |

**Analytics**
```json
{
  "status": true, "message": "Data fetched successfully",
  "data": {
    "total": 412,
    "topHospitals": [ { "id": "66f1a2...", "count": 88, "name": "Apollo Hospital", "city": "Bhubaneswar" } ],
    "topDoctors": [ { "id": "66f2a1...", "count": 34, "name": "Dr. Meera Rao", "primarySpecialization": "cardiology" } ],
    "byDay": [ { "date": "2026-08-10", "count": 12 } ],
    "bySource": [ { "source": "doctor_profile", "count": 250 } ]
  }
}
```

---

## 10. Reviews — `/api/v1/reviews`

### 10.1 Review object
```json
{
  "_id": "66fc...",
  "userId": "66f1...",
  "targetId": "66f1a2...",
  "targetType": "hospital",
  "relatedBookingIntentId": null,
  "rating": 5,
  "text": "Excellent care and clean facilities.",
  "photos": ["https://host/uploads/hospital_66f1a2_1.jpg"],
  "hasBookingIntent": false,
  "isFlagged": false,
  "flagReasons": [],
  "flagCount": 0,
  "adminStatus": "pending",
  "hospitalResponse": { "text": "Thank you!", "respondedAt": "...", "respondedBy": "..." },
  "editedAt": "2026-08-10T07:00:00.000Z",
  "createdAt": "2026-08-10T07:00:00.000Z",
  "updatedAt": "2026-08-10T07:00:00.000Z"
}
```
`adminStatus` ∈ `pending | approved | removed`. **Public lists only return `approved` reviews**, so a freshly posted review will not appear until moderated.

### GET `/reviews` (public)
`?targetId=&targetType=hospital|doctor&page=&limit=` — `targetType` is required whenever `targetId` is given.
```json
{ "status": true, "message": "...", "data": { "data": [ {…Review} ], "pagination": { "page":1,"limit":20,"total":9,"totalPages":1 } } }
```

### GET `/reviews/:targetType/:targetId` (public)
→ `data` = array of approved reviews (no pagination).

### POST `/reviews` 🔒 — **multipart** (up to 3 photos in field `photos`)
```
targetId=66f1a2...
targetType=hospital        # hospital|doctor
rating=5                   # 1–5
text=Excellent care
relatedBookingIntentId=66fb...   # optional
photos=<file> x0-3
```
One review per user per target — repeat posts **upsert** the existing one and reset `adminStatus` to `pending`.
→ `data` = Review object.

### PUT `/reviews/:id` 🔒 — **multipart**
Own review only, **within 24 hours** of creation. Sets `adminStatus` back to `pending`.
→ `data` = Review object.
**Errors:** `FORBIDDEN` ("You can edit only your own review" / "Reviews can be edited only within 24 hours").

### DELETE `/reviews/:id` 🔒 — own review only
→ `{ "status": true, "message": "Review deleted successfully" }`

### POST `/reviews/:id/flag` 🔒
```json
{ "reason": "Spam content" }
```
→ `data` = Review object with `isFlagged: true`, incremented `flagCount`.

### Admin moderation
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/reviews` | latest 100 reviews (all statuses) → `data: [ {…Review} ]` |
| POST | `/admin/reviews/:id/moderate` | `{ "adminStatus": "approved" \| "removed", "flagReason": "optional" }` → `data` = Review |

> 🐞 The routes `GET /reviews/admin/moderation` and `POST /reviews/admin/:id/moderate` also exist but are **shadowed** by `/reviews/:targetType/:targetId` declared earlier in the router. Verified live: `GET /reviews/admin/moderation` returns `200 {"status":true,...,"data":[]}` — a silently empty list, **not** an error, even without an admin token. **Use `/api/v1/admin/reviews` instead.**

---

## 11. Specializations — `/api/v1/specializations`

### GET `/specializations` (public)
`?page=1&limit=20` — honours `x-locale` for the `label`.
```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "data": [
      { "id": "66fd...", "key": "cardiology", "label": "Cardiology", "iconKey": "heart",
        "imageUrl": "https://host/uploads/cardiology.png",
        "createdAt": "...", "updatedAt": "..." }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 24, "totalPages": 2 }
  }
}
```
A default set is auto-seeded on first call.

### Admin
| Method | Path | Notes |
|---|---|---|
| POST | `/admin/specializations` | **multipart** (file `image`) — body `key` (lowercase + underscores), `label`, `iconKey` |
| PUT | `/admin/specializations/:key` | **multipart**, partial: `label`, `iconKey`, `imageUrl` |
| DELETE | `/admin/specializations/:key/image` | → `data` = specialization without `imageUrl` |
| DELETE | `/admin/specializations/:key` | → `{ "message": "Specialization deleted successfully" }` |

---

## 12. Search — `/api/v1/search`

### GET `/search?q=apollo&limit=10&lat=&lng=` (public)
`q` required (min 1 char); `limit` 1–50, default 10. **Strict** — no other params allowed.

```json
{
  "status": true,
  "message": "Data fetched successfully",
  "data": {
    "hospitals": [
      {
        "id": "66f1a2...", "name": "Apollo Hospital", "slug": "apollo-hospital-bbsr",
        "city": "Bhubaneswar",
        "location": { "type": "Point", "coordinates": [85.8245, 20.2961] },
        "specializations": ["cardiology"],
        "rating": { "avg": 4.6, "count": 128 },
        "startingFee": 500,
        "isOpenNow": true,
        "hasCashless": true,
        "photos": [ { "url": "https://host/uploads/apollo_1.jpg", "caption": "Front", "order": 0 } ],
        "distanceKm": 3.2
      }
    ],
    "doctors": [
      {
        "id": "66f2a1...", "name": "Dr. Meera Rao", "specialization": "cardiology",
        "photo": "https://host/uploads/dr_meera.jpg",
        "qualification": "MBBS, MD", "experienceYears": 12,
        "rating": { "avg": 4.8, "count": 40 },
        "consultationFee": 700,
        "distanceKm": 3.2
      }
    ]
  }
}
```
`distanceKm` is `null` when `lat`/`lng` are omitted.

---

## 13. Geo — `/api/v1/geo` (all public)

### GET `/geo/states`
```json
{ "status": true, "message": "...", "data": [ { "key": "odisha", "label": "Odisha" }, { "key": "maharashtra", "label": "Maharashtra" } ] }
```

### GET `/geo/states/:state/cities`
`:state` is the slug from the previous call.
```json
{ "status": true, "message": "...", "data": [ { "key": "bhubaneswar", "label": "Bhubaneswar" } ] }
```
**404** `{ "status": false, "message": "State not found" }`

### GET `/geo/resolve?city=|pincode=|lat=&lng=`
At least one of `city`, `pincode`, or `lat`+`lng`.
```json
{ "status": true, "message": "...", "data": { "type": "Point", "coordinates": [85.8245, 20.2961] } }
```
`data` is `null` when nothing could be resolved.

### GET `/geo/distance?fromLat=&fromLng=&toLat=&toLng=`
```json
{ "status": true, "message": "...", "data": { "distanceKm": 12.4 } }
```

### GET `/geo/reverse?lat=&lng=`
```json
{ "status": true, "message": "...",
  "data": { "label": "Bhubaneswar, India", "city": "Bhubaneswar", "country": "India",
            "distanceKm": 1.2, "location": { "type": "Point", "coordinates": [85.8245, 20.2961] } } }
```

### GET `/geo/autocomplete?q=bhu` (min 2 chars, max 10 results)
```json
{ "status": true, "message": "...",
  "data": [ { "label": "Bhubaneswar", "city": "Bhubaneswar", "country": "India",
              "location": { "type": "Point", "coordinates": [85.8245, 20.2961] } } ] }
```

---

## 14. Notifications — `/api/v1/notifications` 🔒

### GET `/notifications?page=1&limit=20`
```json
{
  "status": true, "message": "Data fetched successfully",
  "data": {
    "data": [
      {
        "_id": "66fe...",
        "userId": "66f1...",
        "title": "Your review was approved",
        "message": "Your review for Apollo Hospital is now live.",
        "category": "review",
        "isRead": false,
        "metadata": { },
        "createdAt": "2026-08-10T07:00:00.000Z",
        "updatedAt": "2026-08-10T07:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 6, "totalPages": 1 }
  }
}
```

### GET `/notifications/unread-count`
```json
{ "status": true, "message": "Data fetched successfully", "data": { "count": 3 } }
```

### POST `/notifications/mark-read`
```json
{ "all": true }
```
or `{ "notificationId": "66fe..." }` — exactly one is required.
```json
{ "status": true, "message": "Data inserted successfully", "data": { "updatedCount": 3 } }
```

---

## 15. Admin — `/api/v1/admin`

### GET `/admin/analytics` 🔒 admin
```json
{
  "status": true, "message": "Data fetched successfully",
  "data": {
    "users": 1240,
    "hospitals": 86,
    "pendingHospitals": 14,
    "totalHospitals": 100,
    "doctors": 340,
    "insurancePlans": 18,
    "bloodDonors": 120,
    "bookingIntents": 412,
    "pendingReviews": 7,
    "newLeads": 5
  }
}
```

### GET `/admin/audit-logs` 🔒 admin
`?actorUserId=&targetId=&targetType=&action=&page=&limit=`
→ `data: { data: [ …audit log docs ], pagination: { page, limit, total } }`

### GET `/admin/users` 🔒 admin
`?q=&role=user|content_admin|platform_admin&page=&limit=`
→ `data: { data: [ …raw user documents ], pagination: { page, limit, total } }`
> These are raw Mongo documents (`_id`, `fcmTokens`, etc.), **not** the shaped User object from §4.1.

| Method | Path | Role | Response `data` |
|---|---|---|---|
| POST | `/admin/users/:id/ban` | `platform_admin` | user document with `isActive: false` |
| POST | `/admin/users/:id/unban` | `platform_admin` | user document with `isActive: true` |

---

## 16. Full endpoint index

Legend: 🔓 public · 🔒 authenticated user · 👑 admin (`content_admin` / `platform_admin`)

| # | Method | Path | Access |
|---|---|---|---|
| 1 | GET | `/` | 🔓 |
| 2 | GET | `/health` | 🔓 |
| 3 | GET | `/api/health` | 🔓 |
| 4 | POST | `/api/v1/auth/otp/send` | 🔓 |
| 5 | POST | `/api/v1/auth/otp/verify` | 🔓 |
| 6 | POST | `/api/v1/auth/refresh` | 🔓 |
| 7 | POST | `/api/v1/auth/logout` | 🔓 |
| 8 | POST | `/api/v1/auth/logout-all` | 🔒 |
| 9 | GET | `/api/v1/me` | 🔒 |
| 10 | PUT | `/api/v1/me` | 🔒 |
| 11 | DELETE | `/api/v1/me` | 🔒 |
| 12 | POST | `/api/v1/me/photo` | 🔒 |
| 13 | DELETE | `/api/v1/me/photo` | 🔒 |
| 14 | POST | `/api/v1/me/change-phone/otp/send` | 🔒 |
| 15 | POST | `/api/v1/me/change-phone/otp/verify` | 🔒 |
| 16 | GET | `/api/v1/me/family-members` | 🔒 |
| 17 | POST | `/api/v1/me/family-members` | 🔒 |
| 18 | PUT | `/api/v1/me/family-members/:id` | 🔒 |
| 19 | DELETE | `/api/v1/me/family-members/:id` | 🔒 |
| 20 | DELETE | `/api/v1/me/family-members/:id/photo` | 🔒 |
| 21 | POST | `/api/v1/me/saved/hospitals/:id` | 🔒 |
| 22 | DELETE | `/api/v1/me/saved/hospitals/:id` | 🔒 |
| 23 | GET | `/api/v1/me/saved/insurance` | 🔒 |
| 24 | POST | `/api/v1/me/saved/insurance/:id` | 🔒 |
| 25 | DELETE | `/api/v1/me/saved/insurance/:id` | 🔒 |
| 26 | PUT | `/api/v1/me/preferences` | 🔒 |
| 27 | POST | `/api/v1/me/fcm-tokens` | 🔒 |
| 28 | DELETE | `/api/v1/me/fcm-tokens/:deviceId` | 🔒 |
| 29 | GET | `/api/v1/me/recently-viewed` | 🔒 |
| 30 | DELETE | `/api/v1/me/recently-viewed` | 🔒 |
| 31 | POST | `/api/v1/devices/register` | 🔒 |
| 32 | DELETE | `/api/v1/devices/:deviceId` | 🔒 |
| 33 | GET | `/api/v1/hospitals` | 🔓 |
| 34 | GET | `/api/v1/hospitals/nearby` | 🔓 |
| 35 | GET | `/api/v1/hospitals/top-rated` | 🔓 |
| 36 | GET | `/api/v1/hospitals/nearby-me` | 🔒 |
| 37 | GET | `/api/v1/hospitals/check-profile-readiness` | 🔒 |
| 38 | GET | `/api/v1/hospitals/:id` | 🔓 |
| 39 | GET | `/api/v1/hospitals/:id/doctors` | 🔓 |
| 40 | GET | `/api/v1/hospitals/:id/insurance` | 🔓 |
| 41 | GET | `/api/v1/hospitals/:id/reviews` | 🔓 |
| 42 | POST | `/api/v1/hospitals` · `/api/v1/admin/hospitals` | 👑 |
| 43 | PUT | `/api/v1/hospitals/:id` · `/api/v1/admin/hospitals/:id` | 👑 |
| 44 | DELETE | `/api/v1/hospitals/:id` · `/api/v1/admin/hospitals/:id` | 👑 |
| 45 | DELETE | `/api/v1/admin/hospitals/:id/photos/:photoIndex` | 👑 |
| 46 | POST | `/api/v1/admin/hospitals/:id/verify` | 👑 |
| 47 | GET | `/api/v1/admin/hospitals` | 👑 |
| 48 | POST | `/api/v1/admin/hospitals/import` | 👑 ⚠️ not implemented |
| 49 | GET | `/api/v1/doctors` | 🔓 |
| 50 | GET | `/api/v1/doctors/hospital/:hospitalId` | 🔓 |
| 51 | GET | `/api/v1/doctors/:id` | 🔓 |
| 52 | GET | `/api/v1/doctors/:id/reviews` | 🔓 |
| 53 | POST | `/api/v1/doctors` · `/api/v1/admin/doctors` | 👑 |
| 54 | PUT | `/api/v1/doctors/:id` · `/api/v1/admin/doctors/:id` | 👑 |
| 55 | DELETE | `/api/v1/doctors/:id` · `/api/v1/admin/doctors/:id` | 👑 |
| 56 | POST | `/api/v1/admin/doctors/import` | 👑 ⚠️ not implemented |
| 57 | GET | `/api/v1/insurance/plans` | 🔓 |
| 58 | GET | `/api/v1/insurance/plans/:id` | 🔓 |
| 59 | GET | `/api/v1/insurance/plans/:id/cashless-near` | 🔓 |
| 60 | GET | `/api/v1/insurance/compare` | 🔓 |
| 61 | POST | `/api/v1/insurance/leads` | 🔓 |
| 62 | GET | `/api/v1/insurance/plans/saved` | 🔒 |
| 63 | POST | `/api/v1/insurance/plans/:id/save` | 🔒 |
| 64 | DELETE | `/api/v1/insurance/plans/:id/save` | 🔒 |
| 65 | POST | `/api/v1/admin/insurance-plans` | 👑 |
| 66 | PUT | `/api/v1/admin/insurance-plans/:id` | 👑 |
| 67 | DELETE | `/api/v1/admin/insurance-plans/:id` | 👑 |
| 68 | GET | `/api/v1/admin/leads` | 👑 |
| 69 | PUT | `/api/v1/admin/leads/:id` | 👑 |
| 70 | GET | `/api/v1/blood-donors` | 🔓 |
| 71 | GET | `/api/v1/blood-donors/:id` | 🔓 |
| 72 | POST | `/api/v1/blood-donors/:id/contact-link` | 🔒 |
| 73 | GET | `/api/v1/me/donor` | 🔒 |
| 74 | PUT | `/api/v1/me/donor` | 🔒 |
| 75 | DELETE | `/api/v1/me/donor` | 🔒 |
| 76 | GET | `/api/v1/admin/blood-donors` | 👑 |
| 77 | POST | `/api/v1/admin/blood-donors` | 👑 |
| 78 | GET | `/api/v1/admin/blood-donors/:id` | 👑 |
| 79 | PUT | `/api/v1/admin/blood-donors/:id` | 👑 |
| 80 | DELETE | `/api/v1/admin/blood-donors/:id` | 👑 |
| 81 | PUT | `/api/v1/admin/blood-donors/:id/verify` | 👑 |
| 82 | PUT | `/api/v1/admin/blood-donors/:id/suspend` | 👑 |
| 83 | POST | `/api/v1/admin/blood-donors/import` | 👑 |
| 84 | GET | `/api/v1/admin/blood-donors/analytics` | 👑 |
| 85 | PUT | `/api/v1/admin/users/:id/donor` | 👑 |
| 86 | PUT | `/api/v1/admin/users/:id/donor/verify` | 👑 |
| 87 | POST | `/api/v1/booking-intents` | 🔒 |
| 88 | GET | `/api/v1/booking-intents/my` | 🔒 |
| 89 | GET | `/api/v1/booking-intents` | 🔒 |
| 90 | GET | `/api/v1/booking-intents/:id` | 🔒 |
| 91 | GET | `/api/v1/booking-intents/:id/reopen` | 🔒 |
| 92 | GET | `/api/v1/admin/booking-intents` | 👑 |
| 93 | GET | `/api/v1/admin/booking-intents/analytics` | 👑 |
| 94 | GET | `/api/v1/admin/booking-intents/export` | 👑 (CSV) |
| 95 | GET | `/api/v1/reviews` | 🔓 |
| 96 | GET | `/api/v1/reviews/:targetType/:targetId` | 🔓 |
| 97 | POST | `/api/v1/reviews` | 🔒 |
| 98 | PUT | `/api/v1/reviews/:id` | 🔒 |
| 99 | DELETE | `/api/v1/reviews/:id` | 🔒 |
| 100 | POST | `/api/v1/reviews/:id/flag` | 🔒 |
| 101 | GET | `/api/v1/admin/reviews` | 👑 |
| 102 | POST | `/api/v1/admin/reviews/:id/moderate` | 👑 |
| 103 | GET | `/api/v1/specializations` | 🔓 |
| 104 | POST | `/api/v1/admin/specializations` | 👑 |
| 105 | PUT | `/api/v1/admin/specializations/:key` | 👑 |
| 106 | DELETE | `/api/v1/admin/specializations/:key/image` | 👑 |
| 107 | DELETE | `/api/v1/admin/specializations/:key` | 👑 |
| 108 | GET | `/api/v1/search` | 🔓 |
| 109 | GET | `/api/v1/geo/states` | 🔓 |
| 110 | GET | `/api/v1/geo/states/:state/cities` | 🔓 |
| 111 | GET | `/api/v1/geo/resolve` | 🔓 |
| 112 | GET | `/api/v1/geo/distance` | 🔓 |
| 113 | GET | `/api/v1/geo/reverse` | 🔓 |
| 114 | GET | `/api/v1/geo/autocomplete` | 🔓 |
| 115 | GET | `/api/v1/notifications` | 🔒 |
| 116 | GET | `/api/v1/notifications/unread-count` | 🔒 |
| 117 | POST | `/api/v1/notifications/mark-read` | 🔒 |
| 118 | GET | `/api/v1/admin/analytics` | 👑 |
| 119 | GET | `/api/v1/admin/audit-logs` | 👑 |
| 120 | GET | `/api/v1/admin/users` | 👑 |
| 121 | POST | `/api/v1/admin/users/:id/ban` | 👑 `platform_admin` |
| 122 | POST | `/api/v1/admin/users/:id/unban` | 👑 `platform_admin` |

---

## 17. Frontend integration checklist

1. **Never trust the HTTP status alone** — read `body.status` and `body.code`. Not-found / validation / conflict / rate-limit all arrive as **500** today, and `code` is sometimes absent.
2. **Treat almost every field as optional** — unset fields are omitted from the JSON entirely (§0.1).
3. **Unwrap carefully** — list endpoints double-nest (`res.data.data`). Detail endpoints don't.
4. **Strip empty query params** — schemas are strict and reject unknown keys with a 500.
5. **Coordinates are `[longitude, latitude]`** everywhere (GeoJSON order).
6. **Dates in, dates out** — send `YYYY-MM-DD`, receive full ISO 8601 timestamps.
7. **Phones** must be `+91` + 10 digits starting 6–9 for every phone field.
8. **Rotate refresh tokens** — `/auth/refresh` invalidates the token you sent; reuse returns `TOKEN_REUSED` and kills all sessions → force logout.
9. **After login**, check `requiresProfileCompletion` / `isRegistered` before entering the main app.
10. **Multipart endpoints** need object/array fields JSON-stringified.
11. **Reviews are moderated** — a new review won't show in public lists until an admin approves it (`adminStatus: "pending"` on create, confirmed live).
12. **Always send `page`/`pageSize` to `GET /doctors`** — with no params it returns a bare array instead of `{data, pagination}` (confirmed live).
13. **Blood donor detail/contact-link only work for `source: "admin"`** — see §0.2.
14. **OTP is hardcoded to `123456`** on this server — confirmed live. Do not ship against a random-OTP assumption without confirming the backend change.

---

## 18. Verification log — 2026-08-12 against `http://13.206.7.202`

**Working exactly as documented (spot-checked live):**

| Area | Verified |
|---|---|
| Meta | `GET /`, `/health`, `/api/health` |
| Auth | otp/send, otp/verify (signup + login), refresh (rotation + reuse detection), logout, resend cooldown |
| Profile | `GET/PUT /me`, `/me/preferences`, `/me/family-members` (add), `/me/saved/hospitals/:id`, `/me/saved/insurance`, `/me/recently-viewed`, `/devices/register` |
| Hospitals | list + pagination, `/nearby`, `/top-rated`, `/nearby-me`, `/check-profile-readiness`, `/:id`, `/:id/doctors`, `/:id/insurance`, `/:id/reviews` |
| Doctors | list (both shapes), filtered list, `/:id`, `/hospital/:hospitalId`, `/:id/reviews` |
| Insurance | `/plans` (incl. `?type=family` alias), `/plans/:id`, `/compare`, `/plans/:id/cashless-near`, `/plans/saved`, save/unsave, `/leads` |
| Blood donors | search (incl. `O%2B` normalisation, live end-to-end after enrolling a donor), `GET/PUT/DELETE /me/donor` |
| Booking intents | create (WhatsApp link generated correctly), `/my`, `/:id`, `/:id/reopen` |
| Reviews | list + pagination, `/:targetType/:targetId`, create (upsert → `pending`) |
| Specializations | list + pagination + localized labels |
| Search | `/search` typeahead (hospitals + doctors) |
| Geo | `/states`, `/states/:state/cities`, `/resolve`, `/distance`, `/reverse`, `/autocomplete` |
| Notifications | list, `/unread-count`, `/mark-read` |
| Admin guard | `/admin/analytics` + `/admin/users` correctly reject a normal user with `FORBIDDEN` |

**Admin endpoints — verified with a `platform_admin` token.** All return 200 and the envelope shapes match this document: `/admin/analytics`, `/admin/audit-logs`, `/admin/users`, `/admin/hospitals`, `/admin/leads`, `/admin/reviews`, `/admin/blood-donors`, `/admin/blood-donors/analytics`, `/admin/booking-intents`, `/admin/booking-intents/analytics`.

One note: **`GET /admin/specializations` returns 404** — the admin router defines only POST `/`, PUT `/:key`, DELETE `/:key/image` and DELETE `/:key`. There is no admin GET; read the list from the public `GET /specializations` instead. This matches §11, which never listed an admin GET.

**Also not exercised:** multipart file uploads (`/me/photo`, hospital/doctor/review photos) and the two CSV import endpoints, which throw `NOT_IMPLEMENTED` by design.

**Test data created on the live server during verification** — delete if it pollutes your data: users `+919000000001`, `+919000000002`, `+919000000003`; one booking intent, one pending review, one insurance lead, and one donor enrolment, all under `+919000000002`.

### Backend fixes worth making before launch

| Priority | Issue |
|---|---|
| High | Blood donor `:id` endpoints don't resolve `source: "user"` donors (§0.2) |
| High | Error HTTP status codes — `NotFoundError`/`ConflictError`/`RateLimitError`/`ValidationError` should be 404/409/429/400, not 500 |
| High | OTP hardcoded to `123456` in `authController.generateOtp` |
| Medium | `POST /insurance/leads` has no `optionalAuth`, so `userId` is always null |
| Medium | Public donor search exposes full phone numbers without auth |
| Medium | `/reviews/admin/*` routes shadowed — return empty 200 with no auth check |
| Low | `GET /doctors` returns two different shapes depending on query params |
| Low | SMTP not configured → insurance lead notification emails silently fail |
