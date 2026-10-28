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
| `flyers` | Flyer filenames, see above |

Peak hotel-demand dates (gold ★ days) are set in `assets/app.js` under `highDemand`.

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
