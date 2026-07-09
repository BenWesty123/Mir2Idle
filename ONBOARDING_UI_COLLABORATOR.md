# Welcome — setup guide (UI / visual collaborator)

Hey! You're joining the **LOM Idle** project to work on the **UI and visual side**
of the game. This guide walks you through setup from scratch, assuming you've
never used GitHub before. Take it one step at a time — you can't break anything
by following this.

There are two of us:
- **Ben** — handles gameplay logic, data, combat, drops, saves.
- **You** — handle how the game LOOKS: UI panels, layout, colors, icons, art.

We both work with an AI assistant in an editor called **Cursor**. The rules for
who-changes-what are already built into the project, so your AI will
automatically know to stay on the visual side. More on that below.

---

## Part 1 — Install the tools (one time)

Install these four things:

1. **Git** — the version-control tool. Download: https://git-scm.com/downloads
   (accept all the default options in the installer).
2. **Node.js version 24** — runs the game and its checks. Download the "24.x"
   version: https://nodejs.org/  (again, defaults are fine).
3. **Cursor** — the AI code editor. Download: https://cursor.com/
4. **A GitHub account** — sign up free at https://github.com/ and tell Ben your
   username so he can invite you to the project.

After installing, restart your computer once so everything is recognized.

---

## Part 2 — Accept the invite

Ben will add you as a "collaborator." You'll get an email from GitHub titled
something like *"[BenWesty123] invited you to collaborate."* Click the link and
press **Accept invitation**. Now you have access to the project.

---

## Part 3 — Get the project onto your PC (one time)

You'll do this with your AI's help, but here's what happens. Open Cursor, and
open a terminal inside it (top menu: **Terminal → New Terminal**). Then type
these commands one at a time, pressing Enter after each:

```powershell
git clone https://github.com/BenWesty123/Mir2Idle.git
cd Mir2Idle
npm install
```

- The first line downloads the whole project (it's a few hundred MB with all the
  art, so give it a minute).
- The third line installs the tools the project needs.

Then set your name so your changes are labeled as yours (use your real name and
the email tied to your GitHub):

```powershell
git config user.name "Your Name"
git config user.email "you@example.com"
```

Finally, in Cursor choose **File → Open Folder** and open the `Mir2Idle` folder
you just downloaded. **Important:** open that exact folder (its root), not a
parent folder — that's how your AI loads the project's rules.

---

## Part 4 — How to work with your AI

Your AI in Cursor has already been given the project's rules (they live in a file
called `.cursor/rules/collaboration-boundaries.mdc`, and it reads them
automatically). Those rules tell it:

- ✅ You CAN change: how the game looks — UI panels and windows, layout,
  spacing, fonts, colors, buttons, tooltips, icons, art, visual effects, and the
  drawing/rendering code.
- ❌ You should NOT change: combat, enemy/drop/loot logic, prices/numbers,
  saved-game code, or the data files (`src/data/*.json`). Those are Ben's side.

If you ask your AI to do something on Ben's side by accident, it should stop and
tell you *"that's outside the UI/visual area"* and suggest a visual-only way to
do it instead. That's expected — it's protecting the project. If that happens
and you think the change is really needed, message Ben rather than overriding it.

**Good things to say to your AI:**
- "I want to work on the UI. Read the collaboration rules first and confirm what
  I'm allowed to change."
- "Before we start, help me create a new branch for this work" (see Part 5).
- "Restyle the inventory panel: more spacing between slots and a darker
  background. Stay within the UI/visual area."
- "Run `npm run check` and tell me if it passed before I push."

You don't need to memorize git commands — you can literally ask your AI:
*"walk me through pushing this and opening a pull request,"* and it will.

---

## Part 5 — The everyday routine

The project's shared master copy is called **`main`**. Nobody edits `main`
directly. Instead, every piece of work goes on its own **branch**, then gets
merged back through a **pull request (PR)** that Ben (and an automatic checker)
can see. This is what keeps our work from clashing.

Here's the loop for each new task. Ask your AI to run these with you:

**1. Start fresh from the latest shared code:**
```powershell
git checkout main
git pull
git checkout -b ui/short-description
```
(name it like `ui/inventory-panel` — the `ui/` prefix marks it as yours.)

**2. Do your work** with your AI (edit the visual stuff).

**3. Save your progress** as you go:
```powershell
git add -A
git commit -m "Short description of what you changed"
```

**4. Check nothing is broken BEFORE sharing:**
```powershell
npm run check
```
If it prints errors, ask your AI to fix them before continuing. Don't share
broken code.

**5. Send it up and open a pull request:**
```powershell
git push -u origin ui/short-description
```
The terminal prints a link — open it, click **Create pull request**. An
automatic check runs on GitHub (takes a minute). **Green check = safe to merge**
(click **Merge pull request**, then **Delete branch**). Red X = ask your AI to
help fix it.

**6. After merging, get back in sync:**
```powershell
git checkout main
git pull
```

That's the whole cycle. The golden rule: **keep each branch small and merge it
soon.** Lots of tiny changes merged often = almost no conflicts. One giant branch
worked on for two weeks = painful conflicts.

---

## Part 6 — If you see a "merge conflict"

Occasionally you and Ben will have edited the same lines, and git will say there's
a conflict. Don't panic — this is normal and fixable. Just tell your AI:
*"there's a merge conflict, please help me resolve it,"* and it will walk you
through picking the right result. Then run `npm run check` again.

---

## Quick reference — the 6 commands you'll use most

```powershell
git checkout main            # go to the shared copy
git pull                     # download everyone's latest
git checkout -b ui/thing     # start a new branch for your work
git add -A                   # stage your changes
git commit -m "message"      # save them with a note
git push -u origin ui/thing  # send them up + get a PR link
```

Anything you're unsure about — ask your AI, or ask Ben. Welcome aboard!
