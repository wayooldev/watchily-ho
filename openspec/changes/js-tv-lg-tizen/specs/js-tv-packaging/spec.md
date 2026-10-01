## Purpose

Defines hosted web-app packages for LG webOS and Samsung Tizen that load the production Watchily TV surface, support local sideload testing, and support store publish and versioned updates.

## ADDED Requirements

### Requirement: Shared hosted TV entry URL
Both platform packages SHALL load the production Watchily TV entry `https://watchily.wayool.com/tv` (or an equivalent documented staging URL for QA) as the primary content surface. The packages MUST NOT embed a separate TV UI framework.

#### Scenario: LG package opens hosted TV
- **WHEN** the user launches the installed LG Watchily app
- **THEN** the app navigates to the hosted TV entry and the React TV shell is usable with the remote

#### Scenario: Tizen package opens hosted TV
- **WHEN** the user launches the installed Samsung Watchily app
- **THEN** the app navigates to the hosted TV entry and the React TV shell is usable with the remote

### Requirement: Local package and install
The project SHALL provide documented commands to build and sideload packages on developer-mode TVs for LG (IPK via ares) and Samsung (WGT via Tizen tooling).

#### Scenario: Developer packages LG IPK
- **WHEN** a developer runs the documented LG package command
- **THEN** an installable IPK is produced and can be installed on a Dev Mode webOS TV

#### Scenario: Developer packages Tizen WGT
- **WHEN** a developer runs the documented Tizen package command
- **THEN** an installable WGT is produced and can be installed on a developer-registered Tizen TV

### Requirement: Store publish and update path
Documentation SHALL describe how to submit and update each package in the respective store (LG Content Store and Samsung Seller Office), including version bumps in platform manifests and certificate/signing requirements.

#### Scenario: Version bump for store update
- **WHEN** a store update is prepared for either platform
- **THEN** the package version in the platform manifest is incremented and the store update checklist documents the required signing and upload steps

### Requirement: Platform differences documented
Documentation SHALL cover remote-key differences, network/CSP or access-origin requirements, Dev Mode setup, certificates, and store checklists for LG versus Samsung.

#### Scenario: Engineer prepares first Samsung install
- **WHEN** an engineer follows the Tizen section of the packaging docs
- **THEN** they can complete certificate setup, package, install, and verify the hosted URL without undocumented steps
