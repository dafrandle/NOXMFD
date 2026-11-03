# Cougar MFD layout

## Status

Branch `feature/cougar-mfd`. Stages 1-3 are in, checked in the `serve_web.py` harness only, not yet
in game:

- `/cougar` (`src/web/shell/cougar/`): the rotated OSB ring, shell keys, rocker corners, full view
  and the three stacked splits, PIN/SWAP, SAVE/LOAD layouts (`shell: 'cougar'`), SOI, the profile
  picker, and the LYT card. `cougar-osb.js` holds the key map as data and `cougar-osb.test.js`
  pins it.
- Profiles are kept in the browser (`localStorage`, `cougar-profile:<NAME>`), not on the game PC:
  enough while the OSB bindings don't exist yet. Moving them to the plugin comes with Stage 5.
- SP1-SP3 are top-wide, 50/50, bottom-wide, as proposed.
- WPN shows its rows in a pane with tap-to-select; selecting a weapon from a frame button is
  Stage 4.
- The LYT page's saved-layout thumbnails draw both wide splits as its plain top/bottom split.

## Goal

A third layout, beside CLASSIC and F-35, for players who mount the browser behind a physical
OSB frame: the Thrustmaster Cougar MFD (the reference hardware) or a WinWing MFD. The glass is
sized by the player to fit the frame's window, every on-screen label sits beside the physical button
that presses it, and the frame's buttons drive the display 1:1 instead of through SOI Nav Up/Down/Select.

**CLASSIC and F-35 are not modified.** Every change is additive, so the work stays mergeable
upstream: new files under `src/web/shell/cougar/`, plus three small additions to shared plumbing:

- `TelemetryHttpRouter.cs`: a `/cougar` route (new web files are embedded by the existing glob).
- `tools/serve_web.py`: the same route in the dev harness.
- `pages/lyt/`: a COUGAR card. It navigates the top window to `/cougar` itself, so neither existing
  shell has to learn a new LYT action. Hosted by Cougar as `/lyt?cougar`.

The Cougar shell does not write the shared `layout` sticky key the other two shells' head guards
read; a Cougar window is reached by its own URL (see Profiles).

## Hardware

Both frames are F-16 style: five OSBs per side (20) and four corner rockers (8 more inputs). Each
rocker half is an ordinary joystick button. The frames label the rockers differently (GAIN/SYM/BRT/CON
on the Cougar, other names on WinWing), so this layout names them by location only: **top-left,
top-right, bottom-left, bottom-right**.

Placement follows the Cougar, where each rocker sits at a corner of the window. WinWing's rockers sit
slightly differently, so corner labels read a little off there. That is accepted; a per-profile
offset can be added if WinWing owners ask for it.

## The glass

No bezel is drawn. Labels sit on the glass at the window's edge, in a fixed grid matching the frame:

```
[ ± ] [ c ][ c ][ c ][ c ][ c ] [< >]
[ c ]                           [ c ]
[FUL]                           [SP1]
[PIN]          screen           [SP2]
[SWP]                           [SP3]
[ c ]                           [ c ]
[ ± ] [ c ][ c ][ c ][ c ][ c ] [< >]
```

- **Shell keys**: the middle three of each side column.
  - Left: **FUL** (full view, one page), **PIN**, **SWP** (SWAP) — the same PIN/SWAP behaviour as
    CLASSIC.
  - Right: **SP1-SP3**, the three stacked split presets (see Splits).
  - CLASSIC's HIDE, FULL(screen) and WAKE have no place here: the player sizes the window to the
    frame, and the browser runs on the game PC.
- **Content keys** (`c`): the top and bottom rows (five each) plus the end key of each side column —
  14 in full view. Page labels move from CLASSIC's side columns to these rows.
- **Rocker labels**: drawn in the four corners, beside the physical rockers (see Rockers).

## Splits

Stacked (top/bottom) only. The pages read better wide, and the rotated key grid gives each stacked
pane a natural set of keys: **its row plus the end key of each side column on its side — 7 keys**.

```
top pane:    top row (5) + left[0] + right[0]
bottom pane: bottom row (5) + left[4] + right[4]
```

Presets: H_SPLIT (50/50) exists today; a top-wide and a bottom-wide variant are new.

## Rockers

Rockers are **required** bindings: the wizard does not let one be skipped. Pages can then rely on
+/- and paging always living on the rockers and never spend face keys on them, which is what keeps
seven keys per pane.

| Rocker | Split: top pane | Split: bottom pane | Full view |
|---|---|---|---|
| Top-left | page +/- | — | page +/- |
| Top-right | PREV / NEXT | — | PREV / NEXT |
| Bottom-left | — | page +/- | contrast |
| Bottom-right | — | PREV / NEXT | brightness |

- **Page +/-** is whatever the page's natural +/- is: MAP zoom (Z+/Z-), RDR/HSD range (R+/R-), manual
  TGP zoom, and scroll on list pages (TGT, AKF, DOC, KEY, ...). The corner label shows it (`Z+/Z-`,
  `R+/R-`, ...) and is blank on a page without one.
- **PREV / NEXT** pages a list that overflows its keys (MAIN, MAP, WPN). Blank when nothing overflows.
- **Brightness / contrast** are CSS filters on the whole window, saved in the profile. The browser
  cannot drive the monitor itself.
- Corner labels are clickable, the mouse fallback for every rocker function.

With every one of the 28 frame inputs bound to the layout, KEY-page binds (SOI Next/Prev, Next/Prev
Target, ...) belong on the stick or throttle.

## Profiles and window identity

- Choosing **COUGAR** on CFG → LYT switches to `/cougar` and asks to load or create a named Cougar
  profile (e.g. `LEFT MFD`). Cougar profiles are their own list, separate from CLASSIC's and F-35's
  saved layouts.
- A profile holds the arrangement (split, pages, PIN), brightness/contrast, and the OSB bindings
  (Stage 5).
- Each window knows its profile from its URL: `/cougar?mfd=LEFT`. `localStorage` is shared by every
  window on one origin, so it cannot hold a per-window "current profile"; the URL can, and a bookmark
  or a browser session restore brings the right MFD back. The load/create prompt appears only when
  the URL names no profile.

## OSB binding

- The plugin does the reading: Rewired already sees each frame as a joystick, and `JoystickIdentity`
  tells two identical frames apart by instance GUID. The browser Gamepad API cannot reliably do that.
- **Wizard**: started from the Cougar layout for its profile. An arrow is drawn at the next key or
  rocker half; the player presses the frame button for it; the wizard moves on. Undo and redo per
  key. A button already bound elsewhere is flagged. Rockers cannot be skipped.
- At runtime the plugin watches the bound buttons and sends press and release, separately, to the
  window(s) holding that profile, so hold actions (combat-mode hold, W- hold) work.
- Clicking a label stays a full fallback.

## Implementation plan

The shell is built on the F-35's **portal** model, not CLASSIC's bezel. An F-35 portal
(`f35.js makePortal`) is one self-contained MFD screen: labels drawn on the glass in a cell grid
around the page window, page feeds through the `PAGE_FEEDS` table, WPN rows derived from that grid
instead of physical keys, TGP marks, PAD cursor, SOI. A Cougar screen is one portal in full view and
two stacked portals in a split, with a different label grid. Since `f35.js` is not modified, the
Cougar shell carries its own adapted copy of the portal code rather than an extracted shared one;
the duplication is the price of keeping the change additive.

1. **Cougar portal.** `shell/cougar/` with its own portal, adapted from `makePortal`: the rotated
   OSB label grid as data (one table, not per-page branches), page feeds, WPN rows on the grid.
2. **`/cougar` full view.** The shell page around one portal: shell keys, rocker corners, profiles,
   route, LYT card.
3. **Stacked splits and paging.** H_SPLIT plus top-wide/bottom-wide; per-pane 7-key placement;
   rocker paging.
4. **WPN, SYS, AFM.** These lay their content out against the side keys (WPN's weapon rows beside
   their select keys). They need row-oriented arrangements here.
5. **OSB binding.** Plugin store + capture + runtime dispatch, the wizard UI.

## Open questions

- Where profiles live long term: on the game PC like saved layouts (shared by every browser), or per
  browser. Game PC is the working assumption, since bindings live in the plugin.
- Which page keys go where per page (the rotated key map, `CougarOsb.FULL_PINS` and the flow order).
  Drafted; needs review on real hardware. Known rough spot: a split MAP pane puts R+ on L1 and R- on
  R1, either side of the pane.
- Rocker orientation: each rocker is drawn as a left/right pair (minus, plus). Which physical half
  is which is up to the binding wizard.

## Live-game verification

Stage 5 needs an in-game check that cannot run in the web harness: two identical frames bound and
kept apart across a game restart and a USB replug, press/hold delivery to the right window, and
binds surviving a NOXMFD update.
