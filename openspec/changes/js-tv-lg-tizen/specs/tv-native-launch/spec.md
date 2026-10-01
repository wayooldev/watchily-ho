## Purpose

Defines Watch now behavior on packaged TV apps: open the installed streaming provider app and deep-link to the title when the platform and provider allow it, with a safe fallback when they do not.

## ADDED Requirements

### Requirement: Prefer native provider app on packaged TV
On packaged LG webOS and Samsung Tizen apps, Watch now / streaming actions SHALL attempt to launch the installed native provider application rather than only navigating inside the Watchily WebView.

#### Scenario: Netflix launch on webOS
- **WHEN** the user activates a Netflix Watch now action on a packaged webOS app and Netflix is installed
- **THEN** the system attempts to launch the Netflix native app

#### Scenario: Netflix launch on Tizen
- **WHEN** the user activates a Netflix Watch now action on a packaged Tizen app and Netflix is installed
- **THEN** the system attempts to launch the Netflix native app via the Tizen application launch API

### Requirement: Title deep-link when supported
When the OEM platform and provider accept content targeting parameters (URL, content id, or documented ApplicationControl data), Watch now SHALL pass those parameters so the provider opens the specific title. When they do not, the system SHALL still launch the provider app (or fall back per the next requirement) and MUST NOT leave the user on a black or broken Watchily screen.

#### Scenario: Deep-link accepted
- **WHEN** Watch now runs with a provider URL/content id that the platform launch API accepts
- **THEN** the provider app opens focused on that title or its documented content target

#### Scenario: Deep-link not accepted
- **WHEN** the provider or platform rejects or ignores content parameters
- **THEN** the native provider app still opens if install/launch succeeds, or the documented fallback runs

### Requirement: Browser or URL fallback
If native launch is unavailable (not packaged privileges, API missing, app not installed, or launch failure), Watch now SHALL fall back to opening the streaming URL in the system browser or an equivalent documented path without crashing the Watchily app.

#### Scenario: Provider app missing
- **WHEN** the user activates Watch now for a provider that is not installed
- **THEN** Watchily falls back to the streaming URL path and remains usable after returning

### Requirement: Desktop TV mode does not require OEM APIs
In desktop browser testing with `?device=tv`, Watch now SHALL remain usable via normal link/browser behavior when webOS/Tizen APIs are absent.

#### Scenario: Desktop device=tv click
- **WHEN** a developer clicks a streaming action in a desktop browser with `?device=tv`
- **THEN** the action opens the streaming URL without throwing on missing OEM APIs
