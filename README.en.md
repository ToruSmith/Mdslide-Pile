# Mdslide Pile

English · [繁體中文](README.md)

**Turn a folder into a moving deck.** The website is the console; your folder is the game.

Write slides in Markdown, group them into sections with folders, and play them as a 3D pile in the browser. Your files stay on your computer or USB drive; the website only plays them. Nothing to install, nothing to upload.

**Use it online:** https://torusmith.github.io/Mdslide-Pile/

## Features

**Playing**
- **Six 3D stages**: pile (shuffles when you change sections), cover flow, carousel, helix, sphere and overview.
- **Side by side** (`V`): a large slide with a thumbnail strip, like a slide editor. The default on phones.
- **Reading view** (`M`): the whole deck as one scrolling page, with speaker notes under each slide. The link ends in `/read`, so you can send it to people who missed the talk.
- **Click to enlarge**: when a chart is cropped or shrunk by the layout, click it to see the whole image.
- **Three themes**: paper, ink (dark) and slate.

**Presenting**
- **Pen and laser pointer** (`D`): laser strokes fade out together once you stop drawing; there is also a pen, a highlighter, an eraser and undo. You can draw in the presenter view too, and it appears on the audience screen.
- **Presenter view** (`S`): notes, next slide and a timer.
- **Step-by-step reveal, black screen, full screen and clicker support.**

**Sharing and output**
- **Print / PDF** (`P`): one slide per page. In reading view, "Print handout" gives an A4 handout with slides and notes. Drawings are printed too.
- **Export to a single HTML file**: double-click it to present offline. Handy for sending a deck or presenting on a computer without internet.
- **Install as an app**: on Chrome, Edge and phones. Once installed it opens without a network.

**Making decks**
- **Folders are the structure**: library → topic → deck → section → slide. Every config file is optional.
- **Over a dozen layouts**: split, full-bleed, quote, big number, stat cards, timeline, columns, automatic agenda, bar and line charts, and more; footnotes and code highlighting too.
- **Editing** (`E`): Markdown on the left, live preview on the right, `Ctrl+S` saves back to the file in your folder; the toolbar picks layouts and inserts images and columns, so you don't need to remember the syntax; `‹` `›` switch slides; add slides, archive (never delete) and edit notes from the presenter view.
- **Live reload**: folders opened in Chrome / Edge update on screen as soon as you save a Markdown file (or press `R`).
- **Checker**: the "Check" button on the site, or double-click the checker in your library, to find anything that breaks the rules.
- **Media**: local images and video; YouTube, Bilibili, Google Drive and Vimeo embeds.
- **Interactive pages**: `.html` files in the deck folder, GitHub Pages pages and CodePen pens run right on the zoomed slide, in an isolated frame.

**Design principles**
- **Local first**: open folders on your computer or a USB drive directly; nothing is uploaded. Chrome / Edge remember your libraries for one-click reconnects.
- **Reads only what it needs**: the catalog first, covers as you scroll, content when you open a deck, media just before it is shown. Large libraries stay fast.
- **English and Traditional Chinese**: switch with the `中 / EN` button. Transitions are simplified when the system asks for reduced motion.
- **Zero dependencies**: no third-party packages and no build step.

## Three-minute start

1. Make a folder:

   ```
   my-talk/
   ├─ 01-opening/
   │  └─ 01-hello.md
   └─ 02-key-points/
      ├─ 01-first.md
      └─ 02-second.md
   ```

2. Write one slide per `.md` file:

   ```markdown
   # The heading is the conclusion

   - First point
   - Second point

   Note:
   Only the presenter sees this line.
   ```

3. Open the website, press "Open a local folder" or drag the folder in. Press `Enter` to zoom, and use the arrow keys or a clicker to advance.

Want a ready-made library to try? Download `Mdslide-library-v….zip` from [Releases](https://github.com/ToruSmith/Mdslide-Pile/releases/latest) and open the unzipped "Mdslide書庫" folder on the site.

The full rules are in **[docs/GUIDE.en.md](docs/GUIDE.en.md)**. The guide is written for AI too; ready-made prompts are below in "[Ask an AI to make a deck](#ask-an-ai-to-make-a-deck)".

## Ask an AI to make a deck

Copy one of these prompts to any AI and replace the `<angle brackets>`. The AI reads [docs/GUIDE.en.md](docs/GUIDE.en.md) first and delivers a deck folder you can drop into your library.

### Case 1: let the AI read the news

```text
Please read these rules in full first: https://raw.githubusercontent.com/ToruSmith/Mdslide-Pile/main/docs/GUIDE.en.md

Make a Mdslide Pile deck following the rules:
- Topic: <for example: highlights of the latest TSMC earnings call>
- News to use: <paste 2–5 article URLs; or write "search the news from the past week yourself">
- Audience: <for example: colleagues>
- Length: <15> minutes
- Folder: <01-markets>
- Language: English (set lang: en in deck.yml)

Requirements:
1. Numbers may only come from articles you actually read. Every slide with numbers needs a "Source:" line, and the last slide lists every source as a link.
2. Every slide needs speaker notes.
3. Deliver a zip that unpacks into the deck folder (including deck.yml). If you cannot create a zip, list every file as "file path + code block".
```

### Case 2: attach documents and images

```text
Please read these rules in full first: https://raw.githubusercontent.com/ToruSmith/Mdslide-Pile/main/docs/GUIDE.en.md

Make a Mdslide Pile deck from the files I attached, following the rules:
- Topic: <for example: Q3 project results>
- Audience: <for example: department heads>
- Length: <10> minutes
- Folder: <02-work>
- Language: English (set lang: en in deck.yml)

Requirements:
1. Content may only come from the attached files; do not add numbers that are not in them. Flag anything uncertain in the speaker notes.
2. Put images in media/ and reference them by their original names; use full-bleed or split layouts for key images.
3. Every slide needs speaker notes.
4. Deliver a zip that unpacks into the deck folder (including deck.yml and media/). If you cannot create a zip, list every text file as "file path + code block"; I will put the images into media/ myself.
```

### Tips

- If the AI cannot open the URL, attach `docs/GUIDE.en.md` directly.
- When you get the result, open the folder on the website and press "✓ Check" (see "Checking decks" below).
- When reviewing, look at four things: do the numbers have sources, do the layouts vary (at least 4), are notes complete, and can the delivery be used as is.

## Checking decks

After making a deck (by hand or with AI), check it with any of these. All three use the same rules and give the same result.

| Method | Install | How |
|---|---|---|
| "✓ Check" on the website | Nothing | Open the folder, then press "Check" on the library page or in the player |
| Single-file tool in your library | Node.js | Copy the three files in `dist/` to your library root and double-click "檢查書庫" |
| Repository script | Node.js + the repository | `node scripts/check.mjs <folder> --slides --lang en` |

It checks config syntax, unknown layouts, missing images and videos, chart values, undefined footnotes, too many slides, and each deck's layout count and speaker-note coverage. Command-line output follows your system language; add `--lang en` or `--lang zh-Hant` to choose.

The single-file tool ([`dist/`](dist/)):

- `mdslide-check.mjs`: one dependency-free file that checks the folder it sits in
- `檢查書庫.cmd`: double-click on Windows
- `檢查書庫.command`: double-click on Mac

Want a ready-made library? Download `Mdslide-library-v….zip` from [Releases](https://github.com/ToruSmith/Mdslide-Pile/releases/latest). The unzipped "Mdslide書庫" folder contains three topics, two example decks and the check tools above.

## Shortcuts

| Key | Action | Key | Action |
|---|---|---|---|
| `←` `→` | Previous / next slide | `O` | Overview |
| `↑` `↓` | Previous / next section | `V` | Side by side |
| `Enter` | Zoom in / out | `M` | Reading view |
| `Esc` | Zoom out, back to library | `L` | Switch stage |
| `1`–`9` | Jump to section | `T` | Switch theme |
| `G` | Type a slide number to jump | `Home` `End` | First / last slide |
| `D` | Pen and laser pointer | `E` | Edit this slide's source |
| `X` | Clear drawings on this slide | `S` | Presenter view |
| `B` | Black screen | `P` | Print / save as PDF |
| `K` | Play / pause local video when zoomed | `F` | Full screen |
| `?` | Help | `R` | Reload the deck |

Phones and tablets: swipe left/right for slides and up/down for sections; tap an image to enlarge it; a hint suggests turning the phone sideways.

## Browser support

| | Open a local folder | Remember folders | Drag a folder in |
|---|---|---|---|
| Chrome / Edge (desktop) | ✓ | ✓ | ✓ |
| Firefox / Safari (desktop) | ✓ (choose a folder) | Choose again each time | ✓ |
| Mobile | Best for viewing the built-in decks | | |

## Using it offline

The site itself needs no network: no third-party packages, no web fonts, no external calls. There are three ways to work offline.

**1. Install it as an app (easiest)**
Open the [site](https://torusmith.github.io/Mdslide-Pile/) once while online and click "Install" at the right of Chrome / Edge's address bar. After that it opens without a connection and plays folders from your computer or a USB drive.

**2. Export a single HTML file**
Click "Export" in the player for an `.html` file that presents with a double-click — handy for sending a deck or for a venue with no internet.

**3. Download the project and run it yourself**
After downloading the source, **do not open `index.html` by double-clicking it**: browsers block module loading from disk for security (the page stops at "Loading…" and explains what to do). Serve it with any static server instead:

```bash
python3 -m http.server 8000     # run in the project folder, then open http://localhost:8000
```

No network is needed at any point. To play the built-in `content/` library, first run `node scripts/build-catalog.mjs` to generate `catalog.json` (needs Node); playing your own folders needs neither.

Online video (YouTube and friends) and CodePen embeds need a connection by nature; everything else — the pile, pen, reading view, presenter view, printing, export and editing — works offline.

## What is in the repository

- `app/`: the website (the console)
- `content/`: the built-in library. `00-官方範例` demonstrates every feature and is the acceptance baseline; `04-Feature-Tour` is the English version
- `docs/GUIDE.en.md` / `製作專案指南.md`: rules for making decks (for people and AI)
- `AGENTS.md`: how to maintain the tool itself (architecture, principles, extension points)
- `scripts/`: command-line tools such as the checker (`check.mjs`) and the deck scaffold (`new-deck.mjs`)
- `dist/`: the single-file checker you can copy into a library (generated)
- `starter/`: the readme for the sample library in Releases
- `tests/`: unit tests, browser tests and screenshot comparison

Public decks can go into `content/<topic>/` and are deployed with the site; keep private or company decks on your own computer and use local mode. Note that a GitHub Pages site is always public.

The finance decks in `content/01-財經市場/` are example content with figures as of 2026-11-08 and are not updated.

## Development

All you need is Node 18 or later and any static server; no `npm install`:

```bash
node --test tests/*.test.mjs
node scripts/build-catalog.mjs
python3 -m http.server 8000
node scripts/new-deck.mjs content/02-work/2026-11-Q4-update   # create a new deck skeleton
```

See [AGENTS.md](AGENTS.md) for details. Pushing to `main` deploys to GitHub Pages automatically once all tests pass (including browser tests in Chromium, Firefox and WebKit) (the first time, set Settings → Pages → Source to **GitHub Actions**).

## Feedback and contributing

Open an issue for bugs and ideas (templates provided). To change code, see [CONTRIBUTING.md](CONTRIBUTING.md). Report security problems privately as described in [SECURITY.md](SECURITY.md).
