# Contributing / working together

Two people work on this project, each with their own AI assistant:

- **Westy** - owns gameplay logic, data, and systems (the default role).
- **UI contributor** - owns UI and visual presentation ONLY.

Who edits what is defined in `.cursor/rules/collaboration-boundaries.mdc`. Your
AI reads that automatically when you open this repo's folder in Cursor. The short
version: the UI contributor's AI stays in rendering / panel / icon code and does
NOT touch combat, drops, saves, or any `src/data/*.json` or logic modules.

The whole live game is one file, `src/app.monolith.js`. Because we both edit it,
the golden rule is **small branches merged often** - that keeps our changes in
different parts of the file so they merge cleanly.

---

## One-time setup (each person, once)

Clone the repo and install dependencies:

```powershell
git clone https://github.com/BenWesty123/Mir2Idle.git
cd Mir2Idle
npm install
```

Set your git identity so it's clear who made each commit:

```powershell
git config user.name "Your Name"
git config user.email "you@example.com"
```

Open the repo's **root folder** in Cursor (not a copy of it) so the rules in
`.cursor/rules/` are picked up by your AI.

---

## The everyday workflow

### 1. Start from an up-to-date `main`

```powershell
git checkout main
git pull
git checkout -b your-name/short-description   # e.g. westy/xp-tuning or ui/inventory-panel
```

### 2. Do your work and commit as you go

```powershell
git add -A
git commit -m "Describe what you changed"
```

### 3. Verify BEFORE you share it

```powershell
npm.cmd run check
```

For changes to `src/app.monolith.js`, also boot the game and smoke-test it
(in a second terminal run `npm.cmd run dev` first, then):

```powershell
npm.cmd run smoke
```

Do not open a pull request if `check` is red.

### 4. Push your branch and open a Pull Request

```powershell
git push -u origin your-name/short-description
```

Then on GitHub click **"Compare & pull request"**, review the diff (it shows
exactly which lines changed), and merge it into `main`. CI runs `npm run check`
automatically on the PR - a green check means it's safe; a red X means fix it
first.

### 5. After it merges, everyone re-syncs

```powershell
git checkout main
git pull
```

---

## When your changes overlap (merge conflicts)

If you both edited the same lines, git stops and marks the spot:

```
<<<<<<< HEAD
your version
=======
their version
>>>>>>> their-branch
```

Open the file, keep the correct combined result, delete the `<<<`, `===`, `>>>`
marker lines, then `git add` + `git commit`. Cursor shows Accept Current /
Incoming / Both buttons, and your AI can resolve conflicts for you if you ask.
After resolving, run `npm.cmd run check` again before merging.

Conflicts are normal and recoverable. They only get painful when branches live
for a long time - so merge often.

---

## House rules (see `AGENTS.md` for the full list)

- Never commit straight to `main`; always go through a branch + PR.
- Run `npm.cmd run check` before pushing; add `npm.cmd run smoke` for monolith changes.
- Preserve player saves; changing save structure needs migration logic.
- Don't edit generated `dist/` output as source.
