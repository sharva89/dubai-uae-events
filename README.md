# Dubai & UAE Events 2026–27

A shareable calendar of the conferences, festivals, sports fixtures, concerts and cultural events that bring visitors to Dubai and the UAE, November 2026 to October 2027. Curated by Experiential Tales.

It is a static site with no build step, so it runs on GitHub Pages as is.

## What's here

| Path | What it is |
|---|---|
| `index.html` | The page |
| `assets/style.css`, `assets/app.js` | Styling and the calendar / list logic |
| `data/events.csv` | **The event list.** Edit this to add, change or remove events |
| `flyers/` | Flyer images and PDFs |
| `partners.html`, `assets/partners.js` | The agent partner list and the form for adding one |
| `studio.html`, `assets/studio.js` | The Co-brand Studio |
| `assets/cobrand.js`, `assets/cobrand.css` | Shared code and styling for those two pages |
| `partners/` | **One `.json` file and one logo per partner** |
| `data/designs.json` | The designs the studio can co-brand, with their header and footer zones |
| `cobrand/bases/`, `cobrand/logos/` | Clean design art (no logo or contacts) and our logo in each tint |

## Add a flyer to an event

1. Export the flyer from Canva as JPG, PNG or PDF. Keep images under about 1 MB.
2. Name the file after the event's `id` from `events.csv`, for example `gitex-global.jpg`.
3. Upload it to the `flyers/` folder (on GitHub: open the folder → **Add file** → **Upload files** → **Commit changes**).
4. Open `data/events.csv` → pencil icon → write the filename in that event's last column, `flyers`. For several flyers, separate them with `;`, e.g. `gitex-global.jpg;gitex-global-2.jpg`.
5. Commit. The site updates within a minute or two.

A full `https://` link to an image hosted elsewhere also works in the `flyers` column.

## Edit events

Each row of `data/events.csv` is one event:

| Column | Notes |
|---|---|
| `id` | Short unique name, lowercase with dashes. Also the share link: `…/#gitex-global` |
| `start`, `end` | Dates as `YYYY-MM-DD`. If you edit the file in Excel, make sure it doesn't change this format |
| `event` | Event name |
| `type` | One of `Conference`, `Festival`, `Sports`, `Art & Culture`, `Concert`, `Holiday` |
| `city`, `venue` | Where it happens |
| `status` | Free text. Start it with `Dates TBC` when only the month is known; the event then shows under "Running this month" instead of on specific days |
| `link` | Official website |
| `link_kind` | `official`, `venue` or `guide` (sets the button label) |
| `about` | One or two sentences |
| `details` | Practical info shown under "Good to know": times, tickets, entry rules |
| `part_of` | The `id` of a bigger event this belongs to (e.g. a concert night `part_of` the Grand Prix). The two events then link to each other |
| `flyers` | Flyer filenames, see above |
| `designs` | Links to the editable source designs, as `Label\|URL`, several separated by `;` — e.g. `Canva\|https://www.canva.com/design/…/edit;Adobe Express\|https://new.express.adobe.com/id/…`. Shown under "Editable designs"; a flyer whose filename contains the label's last word (`canva`, `express`) is captioned with that source |

Peak hotel-demand dates (gold ★ days) are set in `assets/app.js` under `highDemand`.

## Agent partners and the Co-brand Studio

**Partners** (`partners.html`) lists every agent partner. **Co-brand Studio** (`studio.html`) takes one of our posters or brochures and a partner. It replaces the header with *[partner logo] × Experiential Tales*, and writes the partnership line and the chosen contacts into the footer. It downloads PNG, JPG or a 300 dpi PDF. Event pages with editable designs link to the studio.

### Add or edit a partner

1. Open **Partners → + Add partner**, choose the logo and fill in the details. A PNG with a transparent background works best; the page trims and resizes it.
2. **Save partner files** downloads `<id>.json` and `<id>-logo.png`.
3. Click **Open GitHub upload page**. Drag both files in and click **Commit changes**. The partner shows up within about a minute.

To edit, click **Edit** on the partner's card and upload the two new files the same way. GitHub replaces the old ones. To remove a partner, delete both files from the `partners/` folder on GitHub.

Partner file fields: `id`, `name`, `tagline`, `contact_name`, `phone`, `email`, `website`, `city`, `logo`, `added`. The pages list partners through GitHub's API. If that API is unavailable or rate-limited, they fall back to the ids in `partners/index.json`.

### Add a design to the studio

1. Make a clean copy of the design without our logo and contact footer, and export each page as JPG into `cobrand/bases/`. Use 1080 px wide for posters and 1240 × 1754 for A4 at 150 dpi.
2. Add an entry to `data/designs.json`. It needs:
   - `id`, `title`, `subtitle`
   - `event` (the events.csv `id` it belongs to)
   - `width`, `height`
   - `logo`: a tint from `cobrand/logos/`
   - `palette`: `accent`, `text` and `soft` colours
   - `pages`
   - a `header` zone and a `footer` zone in page pixels
3. Each zone takes these settings:
   - `align`: `left`, `center` or `right`
   - `plate`, header zones only: a translucent backing for bright photos
   - `layout`, footer zones only: `stack` (one-liners), `columns` (side-by-side contacts) or `line` (single line)
   - `panel`, optional: draws a coloured box behind the footer
4. A page can override `header`, `footer`, `palette` or `logo`.

Clean versions of the current designs live as working copies in Canva and as `--clean` renders of the Express/ADIPEC generator scripts. The originals are untouched.

## Publish on GitHub Pages

1. Create a new repository on GitHub, for example `dubai-uae-events`. On a free account it must be public for Pages to work.
2. Upload the contents of this folder, or push it with git.
3. In the repository, go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
4. The site is live at `https://<your-username>.github.io/dubai-uae-events/` after a minute or two.

To use your own domain (e.g. `events.experientialtales.com`), add it under **Settings → Pages → Custom domain** and create the CNAME record GitHub shows you.

## Preview locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. Opening `index.html` directly from disk won't load the event list; browsers block that.
