# Specification

## Summary
**Goal:** Add a login overlay with localStorage-based authentication and a logout button to the InsightIQ app, without modifying any existing layout, routing, or analytics logic.

**Planned changes:**
- Create a `LoginOverlay` full-screen modal component with Email and Password fields, a Login button, and basic validation (non-empty fields check with error message)
- Inject `LoginOverlay` into `App.tsx` as an additive overlay layer (no routing or layout changes)
- Store auth state in localStorage using a session token key (`iq_auth_token`); read on app load to skip overlay if token exists
- Add a Logout button to the existing header/sidebar header area, visible only when authenticated; clicking it clears the token and re-shows the overlay

**User-visible outcome:** Users must log in via a full-screen modal before accessing the dashboard. The session persists across page refreshes via localStorage. A Logout button in the header allows users to sign out and return to the login overlay.
