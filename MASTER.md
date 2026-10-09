# Pactset dark operations system

Status: authoritative visual system from 2026-10-09. This replaces the earlier light-theme and pavilion directions.

## Visual thesis

Pactset is an event blueprint in motion. Deep teal is the working field, fine structural lines express dependencies, and a restrained gold signal marks the next accountable decision. Public pages may be cinematic; authenticated and financial work remains dense, calm, and exact.

Allowed patterns: dark teal and green layers; selective translucent framing; off-white text; gold decisions and italic editorial emphasis; architectural SVG line signals; compact role-specific operations layouts; stable tactile controls.

Forbidden patterns: light mode; theme toggles; pavilion or 3D-building scenes; purple crypto gradients; glowing orbs; floating browser mockups; card grids without information hierarchy; decorative motion behind forms or financial decisions; demo entry points competing with real signup and workspace actions.

## Interaction thesis

Routine actions respond within 160–220ms using `cubic-bezier(.22, 1, .36, 1)`. Hover may lift a non-financial surface by at most 2px and move a directional arrow by 4px. Pressed controls settle without changing layout. Financial confirmation controls keep stable dimensions. Reduced motion removes positional movement, entrances, smooth scrolling, and traveling line signals while preserving state color and borders.

## Tokens

- Background: `#061f1e`; deep background: `#031716`.
- Structural surface: `#103f3c`; dense surface: `rgba(8, 42, 40, .96)`.
- Foreground: `#f3f5ef`; secondary foreground: `#b7c9c4`; faint foreground: `#829e98`.
- Decision gold: `#dfa12d`; hover gold: `#edb64e`; focus gold: `#f2c66d`.
- Success: `#73d6ad`; warning: `#f0c46f`; failure/destructive foreground: `#ff91a8`.
- Fine border: `rgba(209, 231, 224, .15)`; strong border: `rgba(209, 231, 224, .28)`.
- Font: Inter, `ui-sans-serif`, system UI fallbacks. Georgia/Times italic is used only for selected public editorial emphasis.
- Radius: 4px controls, 10–16px menus and panels, 20–28px only for major architectural containers.
- Duration: 160ms quick, 200ms standard, 700ms slow/ambient. Linear motion is limited to progress and the tiny SVG path signal.

## Component states

- Primary: gold surface, dark-teal text, clear focus, pending cursor, disabled opacity, stable size.
- Secondary: dense dark surface and readable structural border.
- Quiet: off-white or gold text with an always-visible directional icon when directional.
- Success: green surface/edge and explicit label; never color alone.
- Failure/destructive: rose text/edge and explicit label; destructive actions are never the visual default.
- Inputs and native controls always use dark color scheme, dense backgrounds, visible labels, and error text linked to the field or form.

## Product trust rules

Account sign-in, saved wallet ownership, wallet availability in the current browser, transaction signature, submission, confirmation, and finality are separate states. A verified database address must never be labelled connected until the current provider, address, and Testnet network are rechecked. Test assets have no monetary value. Simulation, estimate, pending, confirmed, disputed, refunded, and released states remain explicit.
