# Cougar MFD layout

## Status

Planning. Branch `feature/cougar-mfd`. Nothing implemented yet.

## Goal

A third layout, beside CLASSIC and F-35, for players who mount the browser behind a physical
OSB frame: the Thrustmaster Cougar MFD (the reference hardware) or a WinWing MFD. The glass is
sized by the player to fit the frame's window, every on-screen label sits beside the physical button
that presses it, and the frame's buttons drive the display 1:1 instead of through SOI Nav Up/Down/Select.

CLASSIC and F-35 are unchanged by this work, apart from the shared-code extraction in Stage 1.

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

1. **Shared relay.** Both shells forward live data to their page iframes, each its own way: `mfd.js`
   through ~61 hand-written `forward*` functions plus `RELAY_MESSAGES`, `f35.js` through the
   `PAGE_FEEDS` table and `forwardSlice`. Extract one table-driven relay (from the F-35's model) into
   `shell/shared/`, move both shells onto it with no behaviour change. Candidate for upstream on
   its own.
2. **`/cougar` full view.** New shell page, the rotated key map as data (one table, not per-page
   branches), shell keys, rocker corners, profiles, sticky-layout redirects in all three shells' head
   guards, LYT card.
3. **Stacked splits and paging.** H_SPLIT plus top-wide/bottom-wide; per-pane 7-key placement;
   rocker paging.
4. **WPN, SYS, AFM.** These lay their content out against the side keys (WPN's weapon rows beside
   their select keys). They need row-oriented arrangements here.
5. **OSB binding.** Plugin store + capture + runtime dispatch, the wizard UI.

## Open questions

- Order of SP1-SP3. Proposed: top-wide, 50/50, bottom-wide (matches where the larger pane sits).
- Base for the `/cougar` shell: CLASSIC's bezel model or the F-35's portal model. The F-35 already
  draws labels on the glass and fits label columns to their contents (`--osb-w`), which is closer
  to this layout; CLASSIC already has stacked splits.
- Where profiles live: on the game PC like saved layouts (shared by every browser), or per browser.
  Game PC is the working assumption, since bindings live in the plugin.
- Which page keys go where per page (the rotated key map). Drafted in Stage 2, reviewed in-browser.

## Live-game verification

Stage 5 needs an in-game check that cannot run in the web harness: two identical frames bound and
kept apart across a game restart and a USB replug, press/hold delivery to the right window, and
binds surviving a NOXMFD update.
