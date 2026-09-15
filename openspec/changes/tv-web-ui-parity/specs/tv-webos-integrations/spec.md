## Purpose

Preserves webOS-specific behaviors for the hosted TV app: thin IPK shell loading production Watchily, and launching installed streaming apps from title detail when the platform allows.

## ADDED Requirements

### Requirement: Hosted shell remains a redirect package
The LG hosted package (`lg-tv-hosted`) SHALL continue to install as a web app whose main page redirects to the production Watchily TV entry URL. The package MUST NOT embed the full application UI.

#### Scenario: IPK launch
- **WHEN** the user launches the installed Watchily app on webOS
- **THEN** the device loads the remote Watchily TV entry URL over HTTPS

### Requirement: Native streaming app launch on webOS
On webOS, when the user activates a streaming source that maps to a known installed app id, the system SHALL attempt to launch that app with the appropriate content target. If launch is unavailable or fails, the system SHALL fall back to opening the streaming URL in the TV browser.

#### Scenario: Successful brand launch
- **WHEN** a TV user on webOS activates a Netflix (or other mapped) source with a playable URL
- **THEN** the system attempts `applicationManager` launch for the mapped app id

#### Scenario: Fallback
- **WHEN** webOS launch APIs are missing or the launch fails
- **THEN** the streaming URL opens via the browser fallback path

### Requirement: Pairing login remains available
TV authentication SHALL continue to support device pairing (code entered on another device) in addition to any other login methods exposed on TV.

#### Scenario: Pairing entry
- **WHEN** an unauthenticated TV user chooses pairing from the TV login flow
- **THEN** they can complete login using the existing `/tv/pair` pairing mechanism
