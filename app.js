(function () {
  var D = window.SURVIVOR51;
  var CAT_COLOR = {
    Immunity: "#4A90E2", Reward: "#2E7D4F", Idols: "#FF8C00", Advantages: "#7FA650",
    Shots: "#C0574F", Survival: "#8FB3F5", Journeys: "#D98E4A", Twists: "#A52A2A",
    Endgame: "#FFF8E7"
  };
  var TRIBE_COLOR = { Toka: "#E8B430", Savu: "#8B5FBF" };
  var PICKERS = {};
  D.viewers.forEach(function (v) {
    (v.picks || []).forEach(function (n) { (PICKERS[n] = PICKERS[n] || []).push(v.name); });
  });
  var el = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };

  var rows = D.contestants.slice().sort(function (a, b) {
    return b.points - a.points || a.name.localeCompare(b.name);
  });
  var top = Math.max.apply(null, rows.map(function (r) { return r.points; })) || 1;
  var usedCats = D.cats.filter(function (c) {
    return D.contestants.some(function (p) { return p.breakdown[c]; });
  });

  // ---- masthead meta
  if (el("meta")) {
    var s = D.season;
    el("meta").innerHTML = [
      ["Premiered", s.premiere],
      ["Filmed", s.location],
      ["Castaways", s.players + " new players"],
      ["Episodes logged", D.episodes.length]
    ].map(function (r) {
      return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>";
    }).join("");
  }

  // ---- race
  if (el("race")) {
    var lim = parseInt(el("race").dataset.limit || "0", 10) || rows.length;
    el("race").innerHTML = rows.slice(0, lim).map(function (p, i) {
      var t = p.tribe1 || "";
      var st = p.status === "Eliminated"
        ? '<span class="tag out">Voted out</span>'
        : '<span class="tag">' + esc(p.status || "") + '</span>';
      var who = (PICKERS[p.name] || []).map(function (w) {
        return '<span class="who-pick">' + esc(w) + '</span>';
      }).join("");
      return '<div class="row ' + t.toLowerCase() + '">' +
        '<span class="rank">' + (i + 1) + '</span>' +
        '<span class="dot" style="background:' + (TRIBE_COLOR[t] || "#666") + '"></span>' +
        '<span class="name">' + esc(p.name) + st + who + '</span>' +
        '<span class="pts">' + p.points + '</span>' +
        '<span class="bar"><i data-w="' + Math.round((p.points / top) * 100) + '"></i></span>' +
        '</div>';
    }).join("");
  }

  // ---- legend + stacks
  if (el("legend")) {
    el("legend").innerHTML = usedCats.map(function (c) {
      return '<span><i style="background:' + CAT_COLOR[c] + '"></i>' + esc(c) + '</span>';
    }).join("");
  }
  if (el("stacks")) {
    el("stacks").innerHTML = rows.map(function (p) {
      var segs = usedCats.map(function (c) {
        var v = p.breakdown[c] || 0;
        if (!v) return "";
        return '<i title="' + esc(c + ": " + v) + '" style="width:' + ((v / top) * 100) +
          "%;background:" + CAT_COLOR[c] + '"></i>';
      }).join("");
      return '<div class="stack"><span class="pname" title="' + esc(p.name) + '">' + esc(p.name) +
        '</span><span class="sbar">' + segs + '</span><span class="ptot">' + p.points + '</span></div>';
    }).join("");
  }

  var evKey = function (n) {
    var m = /^E(\d+)([A-Z]+)$/.exec(n || "");
    return m ? [parseInt(m[1], 10), m[2]] : [9999, n || ""];
  };
  var byEvNum = function (a, b) {
    var ka = evKey(a.num), kb = evKey(b.num);
    return ka[0] - kb[0] || (ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0);
  };

  // ---- episodes
  if (el("episode")) {
    el("episode").innerHTML = D.episodes.map(function (e) {
      var evs = D.events.filter(function (x) { return x.episode && x.episode.indexOf(e.id) > -1; })
        .sort(byEvNum);
      var facts = [
        ["Voted out", (e.votedOff && e.votedOff[0]) || "none", e.elim || ""],
        ["Vote", e.voteCount || "n/a", ""],
        ["Immunity", e.immunityType || "n/a", "won by Savu"],
        ["Points paid", String(e.points), evs.length + " events"]
      ].map(function (f) {
        return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) +
          (f[2] ? "<small>" + esc(f[2]) + "</small>" : "") + "</dd></div>";
      }).join("");
      var list = evs.map(function (x) {
        return '<div class="ev"><b>' + esc(x.num) + '</b><span>' + esc(x.type) +
          ' <span class="cnt">' + x.players.length +
          (x.players.length === 1 ? " player" : " players") + '</span></span>' +
          '<span class="v">+' + x.points + '</span></div>';
      }).join("");
      return '<article class="episode">' +
        '<div class="ep-top"><div><h3 class="ep-title">' + esc(e.epTitle || e.title) + '</h3>' +
        '<p class="ep-sub">' + esc(e.title) + ' · aired ' + esc(e.air) + ' · recap ' +
        esc(String(e.recapStatus || "").toLowerCase()) + '</p></div></div>' +
        '<dl class="facts">' + facts + '</dl>' +
        '<div class="evlist">' + list + '</div>' +
        (e.recap ? '<div class="recap"><h4>The Write-Up</h4><p>' + esc(e.recap) + '</p></div>' : "") +
        '</article>';
    }).join("");
  }

  // ---- tribes
  if (el("tribes")) {
    el("tribes").innerHTML = ["Toka", "Savu"].map(function (t) {
      var mem = D.contestants.filter(function (p) { return p.tribe1 === t; })
        .sort(function (a, b) { return b.points - a.points; });
      return '<div class="tribe ' + t.toLowerCase() + '"><h3>' + t + '</h3>' +
        '<p class="tot">' + (D.tribeTotals[t] || 0) + '</p><p class="lede">' + mem.length + ' players</p>' +
        '<ul>' + mem.map(function (m) {
          var out = m.status === "Eliminated" ? ' class="out"' : "";
          return '<li' + out + '>' + esc(m.name) + ' <b>' + m.points + '</b></li>';
        }).join("") + '</ul></div>';
    }).join("");
  }

  // ---- cast
  if (el("cast")) {
    var cast = D.cast.slice().sort(function (a, b) {
      var t = (a.tribe[0] || "").localeCompare(b.tribe[0] || "");
      return t !== 0 ? t : a.name.localeCompare(b.name);
    });
    el("cast").innerHTML = cast.map(function (c) {
      var p = D.contestants.filter(function (x) { return x.name === c.name; })[0];
      var out = p && p.status === "Eliminated";
      var t = c.tribe[0] || "";
      return '<article class="card' + (out ? " out" : "") + '">' +
        '<div class="who"><h3>' + esc(c.name) + '</h3><span class="age">' + esc(c.age) + '</span></div>' +
        '<span class="chip ' + t.toLowerCase() + '">' + esc(t) + '</span>' +
        '<p class="job">' + esc(c.occupation) + '</p>' +
        '<p class="where">' + esc(c.residence) + '</p>' +
        (c.notes ? '<p class="note">' + esc(c.notes) + '</p>' : "") +
        '</article>';
    }).join("");
  }

  // ---- pool
  if (el("pool")) {
    el("pool").innerHTML = D.viewers.map(function (v) {
      var picks = (v.picks && v.picks.length)
        ? '<ul class="picks">' + v.picks.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>"
        : '<p class="pend">picks pending</p>';
      return '<div class="viewer"><h3>' + esc(v.name) + '</h3>' +
        '<p class="v-tot">' + v.total + '</p>' + picks + '</div>';
    }).join("");
  }
  if (el("poolnote")) {
    var drafted = D.viewers.filter(function (v) { return v.picks && v.picks.length; }).length;
    el("poolnote").textContent = drafted
      ? drafted + " of " + D.viewers.length + " rosters locked in. Points are live."
      : "No rosters locked in yet, so every total reads zero. Once the draft is set, each roster's points are the sum of its players.";
  }

  // ---- scale
  if (el("scale")) {
    var byCat = {};
    D.scale.forEach(function (r) { (byCat[r.cat] = byCat[r.cat] || []).push(r); });
    el("scale").innerHTML = Object.keys(byCat).map(function (k) {
      return '<div class="sgroup"><h3>' + esc(k) + '</h3><ul>' + byCat[k].map(function (r) {
        return '<li><span>' + esc(r.name) + '</span><b>' + r.pts + '</b></li>';
      }).join("") + '</ul></div>';
    }).join("");
  }

  if (el("built")) el("built").textContent = new Date().toISOString().slice(0, 10);

  requestAnimationFrame(function () {
    setTimeout(function () {
      document.querySelectorAll(".bar i").forEach(function (b) { b.style.width = b.dataset.w + "%"; });
    }, 90);
  });

  // ?measure=1 reports wrapping so layout can be checked headlessly
  if (/[?&]measure/.test(location.search)) {
    var report = function () {
      var out = [], tops = {}, i = 1;
      document.querySelectorAll(".topnav .links a").forEach(function (a) {
        (tops[a.offsetTop] = tops[a.offsetTop] || []).push(a.textContent.trim());
      });
      out.push("NAV_ROWS=" + Object.keys(tops).length);
      Object.keys(tops).forEach(function (k) { out.push("  navrow" + (i++) + ": " + tops[k].join(" | ")); });
      out.push("NAV_W=" + document.querySelector(".topnav .links").getBoundingClientRect().width +
               " SCROLL_W=" + document.querySelector(".topnav .links").scrollWidth);
      out.push("WIN=" + window.innerWidth + " DOC_W=" + document.documentElement.scrollWidth +
               " BODY_W=" + document.body.scrollWidth);
      var mn = document.querySelector("main"), sc = document.querySelector(".scale");
      if (mn) out.push("MAIN_W=" + Math.round(mn.getBoundingClientRect().width));
      if (sc) out.push("SCALE_W=" + Math.round(sc.getBoundingClientRect().width));
      document.querySelectorAll("h2, .lede, .sgroup li, .tribe, .facts").forEach(function (b) {
        var r = b.getBoundingClientRect();
        if (r.right > window.innerWidth + 1) out.push("OVERFLOW " + b.className + " right=" + Math.round(r.right));
      });
      var legend = document.querySelectorAll(".legend span"), lrows = {}, ln = 1;
      legend.forEach(function (x) {
        var k = Math.round(x.getBoundingClientRect().top);
        (lrows[k] = lrows[k] || []).push(x.textContent.trim());
      });
      out.push("LEGEND_ROWS=" + Object.keys(lrows).length);
      Object.keys(lrows).forEach(function (k) { out.push("  legendrow" + (ln++) + ": " + lrows[k].join(" | ")); });
      document.querySelectorAll(".sgroup h3").forEach(function (h) {
        var r = h.getBoundingClientRect();
        out.push("GROUP " + h.textContent + " x=" + Math.round(r.left) + " y=" + Math.round(r.top) +
                 " boxW=" + Math.round(h.parentElement.getBoundingClientRect().width));
      });
      var lineCount = function (elm) {
        var t = elm.firstChild;
        if (!t || t.nodeType !== 3 || !t.length) return 1;
        try { var r = document.createRange(); r.setStart(t, 0); r.setEnd(t, t.length); return r.getClientRects().length; }
        catch (e) { return -1; }
      };
      document.querySelectorAll(".sgroup li span").forEach(function (s) {
        var n = lineCount(s); if (n > 1) out.push("WRAP li (" + n + "): " + s.textContent);
      });
      document.querySelectorAll(".name").forEach(function (s) {
        var n = lineCount(s); if (n > 1) out.push("WRAP name (" + n + "): " + s.textContent.replace(/\s+/g, " ").slice(0, 40));
      });
      document.querySelectorAll(".meta dd, .viewer h3, .sgroup h3").forEach(function (s) {
        var n = lineCount(s); if (n > 1) out.push("WRAP other (" + n + "): " + s.textContent.replace(/\s+/g, " ").slice(0, 40));
      });
      var pre = document.createElement("pre");
      pre.id = "measure";
      pre.textContent = out.join("\n");
      document.body.appendChild(pre);
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(report, 250); });
    else setTimeout(report, 500);
  }
})();
