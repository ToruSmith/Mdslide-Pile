# Mdslide Pile

English · [繁體中文](README.md)

**Turn a folder into a moving deck.** The website is the console; your folder is the game.

Write slides in Markdown, group them into sections with folders, and play them as a 3D pile in the browser. Your files stay on your computer or USB drive; the website only plays them. Nothing to install, nothing to upload.

**Use it online:** https://torusmith.github.io/Mdslide-Pile/

## Features

- **Folders are the structure**: library → topic → deck → section → slide. Every config file is optional.
- **Local first**: open folders on your computer or a USB drive directly. Chrome / Edge remember your libraries for one-click reconnects.
- **Reads only what it needs**: the catalog first, covers as you scroll, content when you open a deck, media just before it is shown. Large libraries stay fast.
- **Six 3D stages**: pile (shuffles when you change sections), cover flow, carousel, helix, sphere and overview.
- **Three themes**: paper, ink (dark) and slate.
- **Over a dozen layouts**: split, full-bleed, quote, big number, stat cards, timeline, columns, automatic agenda, bar and line charts, and more.
- **Presenting tools**: step-by-step reveal, presenter view (notes, next slide, timer), black screen, full screen, clicker support, PDF export.
- **Live reload**: folders opened in Chrome / Edge update on screen as soon as you save a Markdown file (or press `R`).
- **Motion preference**: reduced transitions when the system asks for reduced motion; switch between "Full" and "Reduced" in the help panel (`?`).
- **Media**: local images and video; YouTube, Bilibili, Google Drive and Vimeo embeds.
- **Works offline**: after one visit, the site plays local decks without a network.
- **English and Traditional Chinese**: switch the interface with the `中 / EN` button; each deck's generated text follows its own `lang`.
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

## Shortcuts

| Key | Action | Key | Action |
|---|---|---|---|
| `←` `→` | Previous / next slide | `O` | Overview |
| `↑` `↓` | Previous / next section | `L` | Switch stage |
| `Enter` | Zoom in / out | `T` | Switch theme |
| `Esc` | Zoom out, back to library | `S` | Presenter view |
| `1`–`9` | Jump to section | `P` | Print / save as PDF |
| `B` | Black screen | `F` | Full screen |
| `K` | Play / pause video | `R` | Reload the deck |
| `?` | Help | | |

## Browser support

| | Open a local folder | Remember folders | Drag a folder in |
|---|---|---|---|
| Chrome / Edge (desktop) | ✓ | ✓ | ✓ |
| Firefox / Safari (desktop) | ✓ (choose a folder) | Choose again each time | ✓ |
| Mobile | Best for viewing the built-in decks | | |

## What is in the repository

- `app/`: the website (the console)
- `content/`: the built-in library. `00-官方範例` demonstrates every feature and is the acceptance baseline; `04-Feature-Tour` is the English version
- `docs/GUIDE.en.md` / `製作專案指南.md`: rules for making decks (for people and AI)
- `AGENTS.md`: how to maintain the tool itself (architecture, principles, extension points)
- `scripts/check.mjs`: checks whether a folder follows the rules
- `dist/`: the single-file checker you can copy into a library (generated)

Public decks can go into `content/<topic>/` and are deployed with the site; keep private or company decks on your own computer and use local mode. Note that a GitHub Pages site is always public.

The finance decks in `content/01-財經市場/` are example content with figures as of 2026-11-08 and are not updated.

## Development

All you need is Node 18 or later and any static server; no `npm install`:

```bash
node --test tests/*.test.mjs
node scripts/build-catalog.mjs
python3 -m http.server 8000
```

See [AGENTS.md](AGENTS.md) for details. Pushing to `main` deploys to GitHub Pages automatically (the first time, set Settings → Pages → Source to **GitHub Actions**).
