#!/usr/bin/env python3
"""Generate the Survivor 51 site pages from one shell + nav so nothing drifts."""
import pathlib

OUT = pathlib.Path(__file__).parent

NAV = [
    ("index.html", "Leader Board", "Board"),
    ("standings.html", "Standings", "Standings"),
    ("episodes.html", "Episodes", "Episodes"),
    ("cast.html", "Cast", "Cast"),
    ("scale.html", "Points Scale", "Scale"),
]


def nav_html(active):
    items = []
    for href, label, short in NAV:
        cls = ' class="on"' if href == active else ""
        items.append(f'<a href="{href}"{cls}><span class="lg">{label}</span><span class="sm">{short}</span></a>')
    return '<nav class="topnav"><a class="brand" href="index.html">Survivor 51</a>' \
           '<div class="links">' + "".join(items) + "</div></nav>"


def page(name, title, page_id, body, home=False):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="Survivor 51: pool standings, player race, episodes, cast and point scale.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&family=Oswald:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>
<body class="page-{page_id}">
<canvas id="reef" aria-hidden="true"></canvas>
<div class="grain" aria-hidden="true"></div>
{nav_html(name)}
<div class="brandband" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
<header class="masthead">
  <div class="mast-left">
    <img class="wordmark" src="logo.png" alt="Survivor 51">
  </div>
  <div class="mast-right">
    <p class="era">The Open Era</p>
    <p class="era-note">Two tribes. Everything from fifty seasons back in play, no warning, any order.</p>
    <dl class="meta" id="meta"></dl>
  </div>
</header>
<main>
{body}
</main>
<footer>
  <p>Data pulled from Anne-Marie's Notion · built <span id="built"></span></p>
</footer>
<script src="data.js"></script>
<script src="app.js"></script>
<script src="fish-art.js"></script>
<script src="fish.js" defer></script>
</body>
</html>
"""


def block(head, lede, inner, bid=None):
    i = f' id="{bid}"' if bid else ""
    return f"""  <section class="block"{i}>
    <div class="block-head"><h2>{head}</h2><p class="lede">{lede}</p></div>
    {inner}
  </section>"""


HOME = "\n".join([
    block("Leader Board", "The pool. Four of us drafted players, and each roster's points are the sum of its players.",
          '<div class="pool" id="pool"></div><p class="callout" id="poolnote"></p>'),
    block("Tribe Face-Off", "Points per starting tribe. Savu never went to Tribal Council.",
          '<div class="tribes" id="tribes"></div>'),
])

STANDINGS = "\n".join([
    block("The Race", "Points banked after episode one. One for every episode survived, plus whatever the game handed out.",
          '<div class="race" id="race"></div>'),
    block("Where The Points Come From", "The same players, split into the categories that paid them.",
          '<div class="legend" id="legend"></div><div class="stacks" id="stacks"></div>'),
])

EPISODES = "\n".join([
    block("Episode Log", "Each episode, its votes, its points, and the write-up. Aired broadcast only.",
          '<div class="eps" id="episode"></div>'),
])

CAST = "\n".join([
    block("The Cast", "Twenty-one new players. Notes cover the aired episodes only, nothing unaired.",
          '<div class="cast" id="cast"></div>'),
])

SCALE = "\n".join([
    block("What Everything Is Worth", "The full scale as it stands today. Any event not listed pays nothing.",
          '<div class="scale" id="scale"></div>'),
])

PAGES = [
    ("index.html", "Survivor 51 · Leader Board", "home", HOME, True),
    ("standings.html", "Standings · Survivor 51", "standings", STANDINGS, False),
    ("episodes.html", "Episodes · Survivor 51", "episodes", EPISODES, False),
    ("cast.html", "Cast · Survivor 51", "cast", CAST, False),
    ("scale.html", "Points Scale · Survivor 51", "scale", SCALE, False),
]

for name, title, pid, body, home in PAGES:
    (OUT / name).write_text(page(name, title, pid, body, home))
    print("wrote", name)
