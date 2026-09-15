## Purpose

Defines the React-based TV experience served to hosted webOS clients so browsing, library, search, and settings align with the web app’s information architecture and visual language while remaining operable with a TV remote.

## ADDED Requirements

### Requirement: TV clients receive React TV UI by default
After cutover, when a request is identified as a TV client (User-Agent or explicit TV device flag), the system SHALL serve the React TV experience for core browsing routes and MUST NOT require the HTML `*-standalone` document tree for those routes.

#### Scenario: Hosted app opens library-aligned home
- **WHEN** an authenticated TV client opens the hosted app entry URL (`/tv` or `/`)
- **THEN** the user lands on the Library hub experience (or a redirect to `/library`) using the React TV shell

#### Scenario: Escape hatch during migration
- **WHEN** an explicit standalone fallback flag or env mode is enabled
- **THEN** the system MAY serve the legacy standalone HTML routes for rollback

### Requirement: TV information architecture matches web
On TV, authenticated navigation SHALL expose Search and My Library as primary destinations. Legacy TV hubs that only exist as “Popular home”, “Listas index”, and “Ver todo” MUST NOT be the primary IA after cutover; those URLs SHALL redirect or map to Library/Search consistently with web `library-ia` behavior.

#### Scenario: Lists index on TV
- **WHEN** an authenticated TV user navigates to `/lists` or `/lists/all`
- **THEN** they are taken to My Library (same redirect contract as web)

### Requirement: Visual language parity
The TV React UI SHALL use the same design tokens and shared title presentation patterns as the web app (typography scale adapted for 10-foot viewing, shared poster tile look). Decorative motion libraries MUST NOT be required for core usability on TV.

#### Scenario: Title tile resemblance
- **WHEN** a TV user views a grid of titles on Library or Search
- **THEN** posters, badges, and titles are recognizably consistent with the web `TitleTile` presentation

### Requirement: Remote control operability
Every primary interactive control on TV React screens SHALL be reachable with directional navigation, SHALL show a clear focus state, and SHALL activate with the OK/Enter control. The entry screen SHALL set an initial focus target without requiring a pointer.

#### Scenario: Initial focus
- **WHEN** a TV React screen finishes loading
- **THEN** a focusable control receives focus so the remote can navigate without a mouse

#### Scenario: Activate focused control
- **WHEN** a control is focused and the user presses OK/Enter
- **THEN** the control’s primary action runs (navigate, submit, or open)

### Requirement: Core screens available on TV React
Authenticated TV users SHALL be able to use My Library (browse lists/titles with filter/find adequate for remote), Search (empty = popular discovery; query = results), Title detail (metadata and streaming actions), and Settings at least to view account region/providers (edit when remote-feasible). Unauthenticated users SHALL reach a TV login path that supports the existing pairing flow.

#### Scenario: Search empty state
- **WHEN** an authenticated TV user opens Search with no query
- **THEN** popular discovery content is shown

#### Scenario: Open title from library
- **WHEN** an authenticated TV user activates a title in Library
- **THEN** Title detail opens for that title

### Requirement: Standalone URL continuity
Until standalone routes are removed, requests to legacy `*-standalone` paths SHALL redirect or rewrite to the equivalent React TV routes so bookmarks and old IPK deep links continue to work.

#### Scenario: Old standalone home
- **WHEN** a client requests `/tv-standalone`
- **THEN** they are sent to the React TV entry/Library path
