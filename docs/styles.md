# Styles

The app's visual language. Tokens live in `apps/web/app/globals.css`; classes
compose with `cn()` (`lib/cn.ts`). Tailwind v4, theme-switched via `data-theme`.
Extends [conventions.md](conventions.md) §Code — this is the visual layer.

## Theming & color
Light + dark under `:root[data-theme]`; every color is a CSS var surfaced as a
Tailwind token. **Never hardcode a color** — no `#hex`/`rgb()` in `className`.
Tune with `/NN` opacity (`text-ink/55`, `bg-ink/40`).
- Surfaces — `paper`, `paper-strong`, `surface`, `surface-strong`
- Text — `title` headings · `copy`/`copy-strong` body · `ink` UI · `muted` meta
- Action — `brand-fill`(+`-strong`, `brand-foreground`) primary ·
  `soft-fill`/`soft-tone-fill`/`soft-foreground` secondary
- Status `success`/`danger` · accents `plum`/`olive`/`sand` · dividers `line`/`line-strong` ·
  `highlight-*`(+`-inverse`)

## Type
| Utility | Font | Use |
| --- | --- | --- |
| `font-display` | Abhaya Libre | headings, hero numerals |
| `font-reader` | Noto Serif | reader body **and dialog titles** |
| `font-ui` | Inter | eyebrows, labels, meta |
| `font-sans` | Afacad | default body |

Always the utility — never `font-(--font-x)`. **Eyebrow/overline** (ubiquitous):
`font-ui text-xs uppercase tracking-[0.16em] text-muted`.

## Radius — tokens; map any ad-hoc value to the nearest
- `rounded-control` 14px — buttons, inputs, chips
- `rounded-card` 18px — cards, tiles, panels
- `rounded-modal` 28px — dialogs, overlays
- `rounded-shell` 32px — page shells
- `rounded-full` circles & icon-pills · `rounded-[3px]` book covers (special-case)

## Borders
No **decorative** borders — shape comes from fill + shadow. Keep only
**structural** hairline dividers: directional `border-t/b/x/y` in `border-line(/NN)`,
plus dashed drop-zones. Focus shows a **ring**, never a border.

## Shadow & motion
Shadows are theme-switched vars: `shadow-(--shadow-soft|--shadow-card|--shadow-nav)`
— use the `()` shorthand, not `[var(...)]`. Motion: `transition` +
`duration-200`/`300` + `ease-out`; skeletons `animate-pulse`; named keyframes in globals.css.

## Buttons → `components/ui/button.tsx`
`rounded-control`, fill-based, **no border**. Variants `primary` (brand-fill +
`shadow-(--shadow-card)`), `soft` (soft-fill), `ghost` (transparent → hover
`soft-fill`), `danger` (bg-danger — destructive confirms). Sizes `md` (default) ·
`sm` (compact, uppercase — modal/secondary actions). Reuse the primitive; don't
hand-roll `<button className>`.

## Inputs → `components/ui/text-input.tsx`
`rounded-control`, filled (`bg-paper`/`bg-paper-strong`), no border, `outline-none`
+ visible `focus-visible:ring-2 focus-visible:ring-line-strong`.

## Modals & overlays
Scrim `fixed inset-0 z-50 flex … bg-ink/40 backdrop-blur-sm`, click-to-close.
Panel `rounded-modal bg-paper`/`bg-surface` + `shadow-(--shadow-card)`,
`role="dialog" aria-modal`, Escape closes, title `font-reader`. Action row uses
`<Button size="sm">` (`rounded-control`, no border).

## Z-index & layout
`z-50` modals/overlays · `z-40` sticky nav/headers · `z-10` local poppers/menus.
Wrap screens in `<ScreenContainer>` (`max-w-6xl`, responsive px). Spacing rhythm:
`gap`/`space-y` in 2 / 3 / 4 / 6.
