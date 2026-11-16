# Research: mflight.base44.app

## Source
- URL: https://mflight.base44.app — a Base44-hosted app named "MFlight"
- The app is gated behind authentication; only the login page is publicly visible.

## Observed Login Page (exact, must be faithfully reproduced)
- Full-viewport light gray background (#f7f8fa range), a single centered white card (~440px wide, large radius, soft shadow, subtle top edge highlight).
- Top of card: circular emblem logo reading "BMW CAR CLUB EUROPE" — a dark navy/black roundel with gold laurel detail and a light-blue/white quartered center (BMW-style roundel).
- Heading: "Welcome to MFlight" — large, bold, near-black, centered.
- Subtitle: "Sign in to continue" — small gray, centered.
- Two full-width outlined social buttons, rounded-xl, light border, white bg:
  - "Continue with Google" (Google "G" logo)
  - "Continue with Facebook" (blue "f" logo)
- Divider: horizontal line with "OR" centered in small gray caps.
- Form labels centered above inputs: "Email", "Password".
- Inputs: rounded-xl, light border, with left icons (envelope for email "you@example.com" placeholder; lock for password).
- Primary button: full-width, very dark navy (#0a0f1e-ish), white text, "Sign in", rounded-xl.
- Footer row: left "Forgot password?" (muted gray link), right "Need an account? Sign up" (gray text + darker "Sign up" link).

## Product interpretation
- Name "MFlight" + BMW Car Club Europe branding ⇒ a members-only travel/flight platform for a BMW car club: members search and book flights & travel to club events (M Festivals, rallies, European tours, track days), manage bookings, and view club travel perks.
- Build frontend-only with mock auth: any email/password "signs in" to the member area; social buttons also enter the app.

## Expected app areas (clone target is gated, so expand plausibly and richly)
- Login / auth screens (faithful to the observed design above)
- Member dashboard (upcoming trips, booking stats, club event calendar)
- Flight search & results (European routes between major cities / event venues)
- Flight booking flow (select fare, passenger details, confirmation)
- My bookings / trips management
- Club events page (BMW Car Club Europe events with travel packages)
- Profile / membership page
