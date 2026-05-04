# v2 API - Users

This document outlines the standalone v2 CRUD API for the User entity. These endpoints act independently of the existing sync mechanisms and provide direct, strictly validated access to the Neon PostgreSQL database.

## Base Path
`/api/v2/users`

## Authentication
All endpoints require the user to be authenticated. The API expects an `auth_token` (JWT) passed via cookies. If the token is missing or invalid, the API will respond with `401 Unauthorized`.

---

## Endpoints

### 1. Get Current User Profile
Retrieves the profile of the currently authenticated user.

* **URL:** `/me`
* **Method:** `GET`
* **Auth Required:** Yes

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "user123",
    "photourl": "https://example.com/avatar.jpg",
    "emailVerifiedAt": "2026-05-04T12:00:00.000Z",
    "createdAt": "2026-05-04T12:00:00.000Z"
  }
}
```

**Error Responses:**
* `401 Unauthorized`: Missing or invalid authentication token.
* `404 Not Found`: The authenticated user was not found in the database.

---

### 2. Update User Profile
Updates the profile information of the currently authenticated user. Strict validation is enforced on the payload.

* **URL:** `/me`
* **Method:** `PUT`
* **Auth Required:** Yes

**Request Body (JSON):**
At least one of the following fields must be provided:
* `username` (string, optional): Must be between 3 and 20 characters. Must be unique across all users.
* `email` (string, optional): Must be a valid email format. Must be unique across all users.
* `password` (string, optional): Must be at least 8 characters long.
* `photourl` (string, optional): Must be a valid URL or an empty string. Can be `null`.

**Example Request:**
```json
{
  "username": "new_username",
  "photourl": "https://example.com/new-avatar.png"
}
```

**Success Response (200 OK):**
Returns the newly updated user record. Note: `emailVerifiedAt` will be reset to `null` if the `email` is changed.
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "new_username",
    "photourl": "https://example.com/new-avatar.png",
    "emailVerifiedAt": null,
    "createdAt": "2026-05-04T12:00:00.000Z"
  }
}
```

**Error Responses:**
* `400 Bad Request`: Validation failed (e.g., username too short, invalid email). The response body will contain detailed validation errors from Zod.
* `401 Unauthorized`: Missing or invalid authentication token.
* `404 Not Found`: User not found.
* `409 Conflict`: The requested `username` or `email` is already in use by another account.

---

### 3. Delete User Account
Permanently deletes the currently authenticated user's account from the database. Note: Be mindful of foreign key constraints if the user has associated habits or buckets.

* **URL:** `/me`
* **Method:** `DELETE`
* **Auth Required:** Yes

**Success Response (200 OK):**
```json
{
  "message": "User deleted successfully",
  "data": {
    "id": "uuid"
  }
}
```

**Error Responses:**
* `401 Unauthorized`: Missing or invalid authentication token.
* `404 Not Found`: User not found or already deleted.
