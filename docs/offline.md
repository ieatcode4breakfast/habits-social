# Offline Behavior

This document outlines how the application handles network connectivity interruptions for specific features.

## Edit Profile

The Edit Profile feature requires a stable server connection to update user credentials (username, email, password) and sync with the authentication provider.

### 1. Entry Prevention
If the application detects that the user is offline **before** they attempt to edit their profile:
- The "Edit Profile" modal will not open.
- A toast notification is displayed: *"You are offline. Profile changes require a connection."*

### 2. In-Progress Interruption
If the user's connection drops while the Edit Profile modal is **already open**:
- **Visual Feedback**: A "Connection Lost" banner appears at the top of the modal form.
- **Action Blocking**: The "Save" button is automatically disabled to prevent failed API calls.
- **Data Preservation**: All typed information (new username, email, etc.) is preserved. The user can continue typing or wait for the connection to return.
- **Recovery**: Once the connection is restored, the banner disappears and the "Save" button is re-enabled.
