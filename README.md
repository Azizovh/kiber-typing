# KiberTyping

A typing trainer for people who live in the terminal. Instead of ordinary
prose you type what a security engineer actually types: Kali Linux command
lines, shell symbols (`/ ~ > | $ & \`), and the vocabulary of the field —
with a one-line explanation of every command, symbol and term while you type
it.

The goal: someone who types fast here is fast in a real terminal.

## Features

- **Four kinds of content** — symbols, commands (12 topics: files, text
  processing, permissions, networking, recon, web, passwords, exploitation,
  privilege escalation, wireless, forensics…), security terms, or a mix.
- **Test modes** — time (15 / 30 / 60 / 120 s) or word count (10 / 25 / 50 /
  100), like monkeytype.
- **Real command lines** — every command starts with a prompt and must be
  finished with <kbd>Enter</kbd>, exactly like a shell.
- **Work on mistakes** — every keystroke is analysed. The app tracks error
  rate and speed per key, what you press instead, and which words you mistype,
  shows it as a keyboard heatmap, and generates drills from exactly those weak
  spots. After any run you can practice just that run's mistakes.
- **Strict mode** — a wrong key is not accepted until you press the right one.
- **On-screen keyboard** — shows the next key, which finger to use and which
  Shift to hold (ten-finger touch typing).
- **Lessons** — 45 lessons from the home row to full Kali command lines, with
  stars awarded for accuracy.
- **Statistics** — history, personal bests, progress chart.
- **Accounts and a global leaderboard** — optional, via Supabase. Without it
  the app works fully in the browser (guest mode).
- Five themes, adjustable text size.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173.

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | development server                    |
| `npm run build`     | type-check and build into `dist/`     |
| `npm run preview`   | serve the production build locally    |
| `npm test`          | unit tests for the engine and content |
| `npm run typecheck` | TypeScript only                       |

## Enabling accounts and the leaderboard

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon
   key (Project Settings → API).
4. Restart `npm run dev`.

Results typed as a guest are attached to the account on first sign-in.

> The leaderboard trusts the scores the browser sends (the database only
> rejects impossible values). Server-side replay validation is a planned
> improvement.

## Architecture

```
src/
  engine/        Pure TypeScript, no React, fully unit-tested
    session.ts     the typing state machine (keys in, new state out)
    metrics.ts     WPM, raw, accuracy, consistency, result building
    profile.ts     long-term mistake analysis and drill generation
  content/
    data/*.txt     the library: `text ## explanation`, grouped by @topic
    library.ts     parses the library into items and tokens
    generate.ts    endless shuffled text for each category
    lessons.ts     the lesson path
  keyboard/      US QWERTY layout and finger map
  hooks/         useTypingSession — keyboard events, timer, sampling
  components/    Runner (one full typing experience), TypingArea,
                 Keyboard, Results, Chart
  pages/         type, lessons, mistakes, stats, leaderboard, account, settings
  store/         zustand stores, persisted to localStorage
  services/      Supabase client and cloud sync
  i18n/          interface strings (English now; structured for more languages)
supabase/
  schema.sql     tables, row-level security, leaderboard view
```

Design decisions worth knowing:

- **The engine is pure.** `typeChar(state, key, time)` returns a new state.
  That makes every rule (what counts as a mistake, when a run ends) testable
  without a browser.
- **Content is plain text.** Shell syntax is full of quotes and backslashes;
  keeping commands in `.txt` files means adding one is a single line with no
  escaping. A test checks that every character is typable on a US keyboard.
- **Local first.** Everything is saved in the browser; the cloud is a sync
  target, not a requirement.
- **Hash routing and a relative base path**, so the build runs on any static
  host (GitHub Pages included) without rewrite rules.

## Adding content

Add a line to a file in `src/content/data/`:

```
nmap -sV -p 22,80 10.10.10.5 ## detect service versions on two ports
```

Use lab-style targets only (`10.10.10.x`, `target.htb`, `example.com`).

## Responsible use

The commands here are standard material from public cheat sheets and
certification prep. Run offensive tools only against systems you own or are
explicitly authorised to test.
