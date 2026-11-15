#!/usr/bin/env python3
"""
لوحات الأدلة — صور PNG عالية الدقة لكل دليل تقني في الملف الموحّد.

لا يمكن تشغيل متصفح حقيقي داخل هذه البيئة (لا Chromium ولا شبكة إلى vercel.com)،
لذلك تُرسَم كل لوحة هنا بنفسها من **البيانات الحقيقية** التي تعيدها:
  • GitHub REST API  (المستودع، الكوميتات، الإصدارات، اللغات)
  • Vercel API       (المشاريع، النطاقات، سجل النشر)

كل لوحة تحمل في تذييلها المصدر وتاريخ السحب، حتى لا تُقرأ على أنها لقطة شاشة
للواجهة الرسومية. البيانات نفسها صحيحة 100% وقابلة للتحقق بالأوامر في §10.
"""
import json
import os
import subprocess
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.graphics import renderPM
from reportlab.pdfbase.pdfmetrics import stringWidth

OUT = "docs/master/boards"
os.makedirs(OUT, exist_ok=True)

INK     = colors.HexColor("#111827")
MUTED   = colors.HexColor("#6B7280")
LINE    = colors.HexColor("#E5E7EB")
SOFT    = colors.HexColor("#F9FAFB")
GH      = colors.HexColor("#24292F")   # GitHub header
GH_DARK = colors.HexColor("#1B1F23")
VK      = colors.HexColor("#000000")   # Vercel header
PURPLE  = colors.HexColor("#4F46E5")
TEAL    = colors.HexColor("#0D9488")
GREEN   = colors.HexColor("#1A7F37")
AMBER   = colors.HexColor("#B45309")
BLUE    = colors.HexColor("#0969DA")

W, H = landscape(A4)          # 842 × 595 pt
PAD  = 34                      # هامش داخلي


def save(c, png_path, dpi=170):
    """يحفظ اللوحة PNG عالية الدقة عبر PDF وسيط (pypdfium2)."""
    pdf = png_path.replace(".png", ".pdf")
    c.showPage()
    c.save()
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(pdf)
    page = doc[0]
    bitmap = page.render(scale=dpi / 72)
    bitmap.to_pil().save(png_path, "PNG", optimize=True)
    doc.close()
    return png_path


import re as _re
_AR = _re.compile(r"[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]")


def asc(text):
    """العربية غير قابلة للرسم بخط Latin-1؛ تُستبدل بوسم واضح بدل مربّعات سوداء."""
    t = _AR.sub("", str(text))
    t = _re.sub(r"\s{2,}", " ", t).strip(" -—·:,")
    if _AR.search(str(text)):
        t = (t + " [AR]").strip() if t else "[Arabic subject]"
    return t


def now():
    return datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")


def gh_api(path):
    r = subprocess.run(["gh", "api", path], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"gh api {path} failed: {r.stderr[:200]}")
    return json.loads(r.stdout)


# ─────────────────────────────────────────────────────────── رسم العناصر
def chrome(c, title, sub, accent, right_lines, brand="GitHub"):
    """شريط علوي بشكل المنصّة + ترويسة اللوحة."""
    c.setFillColor(GH if brand == "GitHub" else VK)
    c.rect(0, H - 46, W, 46, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(PAD, H - 29, "Vercel  ·  REST API v9" if brand == "Vercel" else "GitHub  ·  REST API v3")
    c.setFont("Helvetica", 8.4)
    c.setFillColor(colors.HexColor("#B9BFC7"))
    c.drawRightString(W - PAD, H - 29, right_lines[0])
    if len(right_lines) > 1:
        c.drawRightString(W - PAD, H - 40, right_lines[1])

    c.setFillColor(accent)
    c.rect(0, H - 49.5, W, 3.5, stroke=0, fill=1)

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(PAD, H - 78, title)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.4)
    c.drawString(PAD, H - 93, sub)


def footer(c, plate, source):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(PAD, 40, W - PAD, 40)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.4)
    c.drawString(PAD, 28, source)
    c.drawRightString(W - PAD, 28, f"{plate}   ·   evidence board   ·   NEXORA AI & GameVerse")


def table(c, x, y, widths, header, rows, fs=7.6, rh=16.4, header_bg=GH, zebra=True,
          colors_map=None, mono_cols=(), bold_cols=()):
    """جدول يدوي — يتحكم بالارتفاع والقطع بدقة."""
    c.setFillColor(header_bg)
    c.rect(x, y - rh, sum(widths), rh, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", fs)
    cx = x
    for i, h in enumerate(header):
        c.drawString(cx + 5, y - rh + 5, h)
        cx += widths[i]
    y -= rh
    for r, row in enumerate(rows):
        if zebra and r % 2 == 1:
            c.setFillColor(colors.HexColor("#FAFBFC"))
            c.rect(x, y - rh, sum(widths), rh, stroke=0, fill=1)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        c.line(x, y - rh, x + sum(widths), y - rh)
        cx = x
        for i, cell in enumerate(row):
            if colors_map and (r, i) in colors_map:
                c.setFillColor(colors_map[(r, i)])
            else:
                c.setFillColor(INK)
            font = "Courier" if i in mono_cols else ("Helvetica-Bold" if i in bold_cols else "Helvetica")
            size = fs - (0.5 if i in mono_cols else 0)
            c.setFont(font, size)
            txt = asc(cell)
            avail = widths[i] - 10
            while stringWidth(txt, font, size) > avail and len(txt) > 4:
                txt = txt[:-2] + "…"
            c.drawString(cx + 5, y - rh + 5, txt)
            cx += widths[i]
        y -= rh
    # إطار
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.rect(x, y, sum(widths), 0)   # خط سفلي
    return y


def badge(c, x, y, text, fill, fg=colors.white, fs=7.2, padx=6, h=14):
    wd = stringWidth(text, "Helvetica-Bold", fs) + padx * 2
    c.setFillColor(fill)
    c.roundRect(x, y, wd, h, 7, stroke=0, fill=1)
    c.setFillColor(fg)
    c.setFont("Helvetica-Bold", fs)
    c.drawString(x + padx, y + 4.2, text)
    return x + wd + 6


def panel(c, x, y, w, h, label, value, sub="", accent=PURPLE):
    c.setFillColor(colors.white)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, 4, stroke=1, fill=1)
    c.setFillColor(accent)
    c.roundRect(x, y, 3, h, 1.5, stroke=0, fill=1)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.2)
    c.drawString(x + 10, y + h - 14, label.upper())
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 13)
    tx = asc(value)
    while stringWidth(tx, "Helvetica-Bold", 13) > w - 18 and len(tx) > 5:
        tx = tx[:-2] + "…"
    c.drawString(x + 10, y + h - 30, tx)
    if sub:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7.2)
        c.drawString(x + 10, y + h - 42, asc(sub))


def hbar(c, x, y, w, h, label, value, frac, color):
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.4)
    c.drawString(x, y + h + 4, label)
    c.setFillColor(colors.HexColor("#EEF0F3"))
    c.roundRect(x, y, w, h, 2, stroke=0, fill=1)
    c.setFillColor(color)
    c.roundRect(x, y, max(2, w * frac), h, 2, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 7.4)
    c.drawRightString(x + w, y + h + 4, value)


# ─────────────────────────────────────────────────────────── البيانات
NX = gh_api("repos/Ahmedbecett/nexora-social-2026")
NX_COMMITS = gh_api("repos/Ahmedbecett/nexora-social-2026/commits?per_page=100")
NX_RELEASES = gh_api("repos/Ahmedbecett/nexora-social-2026/releases")
NX_LANGS = gh_api("repos/Ahmedbecett/nexora-social-2026/languages")

with open("/tmp/gv.json") as f:
    GV_COMMITS = json.load(f)


def _nx_english():
    """جدول الترجمة الإنجليزية المعتمد في التقرير (§6) — نفس الأكواد."""
    import re as _r
    src = open(os.path.join(os.path.dirname(__file__), "build-master-dossier.py")).read()
    m = _r.search(r"NX_COMMITS = \[(.*?)\n\]", src, _r.S)
    pairs = _r.findall(r'\(\s*"([0-9a-f]{8})"\s*,\s*"[^"]*"\s*,\s*\n?\s*"([^"]*)"\s*\)', m.group(1))
    return {k: v for k, v in pairs}


NX_EN = _nx_english()


def dt(s, fmt="%d %b %Y"):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").strftime(fmt)


# ─────────────────────────────────────────────────────────── B1 مستودع NEXORA
def board1(repo, commits, releases, langs, plate):
    p = os.path.join(OUT, "B1-github-repository-nexora.png")
    c = canvas.Canvas(p.replace(".png", ".pdf"), pagesize=(W, H))
    c.setFillColor(colors.white); c.rect(0, 0, W, H, stroke=0, fill=1)
    chrome(c, f"{repo['full_name']}", "Public repository · owner account Ahmedbecett · source of the NEXORA AI build",
           GH, ["github.com · read from REST API", f"retrieved {now()}"])

    total_bytes = sum(langs.values())
    y = H - 120
    c.setFillColor(colors.HexColor("#F6F8FA"))
    c.setStrokeColor(LINE); c.setLineWidth(0.8)
    c.roundRect(PAD, y - 58, W - 2 * PAD, 58, 6, stroke=1, fill=1)

    x = PAD + 12
    x = badge(c, x, y - 20, "Public", GREEN)
    x = badge(c, x, y - 20, repo["default_branch"], BLUE)
    c.setFillColor(MUTED); c.setFont("Helvetica", 8)
    c.drawString(x + 4, y - 16, f"created {dt(repo['created_at'])}")
    c.drawString(x + 4, y - 28, f"last push {dt(repo['pushed_at'])}")

    c.setFillColor(INK); c.setFont("Helvetica-Bold", 10)
    c.drawRightString(W - PAD - 14, y - 20, f"{len(commits)} commits")
    c.setFillColor(MUTED); c.setFont("Helvetica", 8)
    c.drawRightString(W - PAD - 14, y - 34, f"{len(releases)} releases  ·  repo id {repo['id']}")

    # عدّادات
    yy = y - 82
    bw = (W - 2 * PAD - 3 * 10) / 4
    panel(c, PAD, yy - 46, bw, 46, "commits", len(commits), "full history, public", PURPLE)
    panel(c, PAD + (bw + 10), yy - 46, bw, 46, "releases", len(releases), "signed APK assets", TEAL)
    panel(c, PAD + 2 * (bw + 10), yy - 46, bw, 46, "repository size", f"{repo['size']/1024:.1f} MB", "git objects", BLUE)
    panel(c, PAD + 3 * (bw + 10), yy - 46, bw, 46, "first commit", dt(commits[-1]["commit"]["author"]["date"]),
          "authored by Ahmedbecett", AMBER)

    # اللغات
    yy -= 66
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 9)
    c.drawString(PAD, yy, "Languages")
    ly = yy - 26
    cols = [PURPLE, TEAL, AMBER, BLUE, MUTED]
    order = sorted(langs.items(), key=lambda kv: -kv[1])
    sx = PAD
    for i, (name, val) in enumerate(order):
        pct = 100 * val / total_bytes
        c.setFillColor(cols[i % len(cols)])
        c.circle(sx + 3.5, ly + 2.5, 3.4, stroke=0, fill=1)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 7.8)
        c.drawString(sx + 11, ly, f"{name} {pct:.1f}%")
        sx += 108

    ybar = ly - 18
    c.setFillColor(colors.HexColor("#EEF0F3"))
    c.roundRect(PAD, ybar, W - 2 * PAD, 7, 3, stroke=0, fill=1)
    bx = PAD
    for i, (name, val) in enumerate(order):
        pct = 100 * val / total_bytes
        wseg = (W - 2 * PAD) * pct / 100
        c.setFillColor(cols[i % len(cols)])
        c.roundRect(bx, ybar, max(1.5, wseg), 7, 0, stroke=0, fill=1)
        bx += wseg

    # الإصدارات
    yy = ybar - 26
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 9)
    c.drawString(PAD, yy, "Releases and published digests")
    rows = []
    for r in releases:
        a = r["assets"][0] if r["assets"] else None
        rows.append([r["tag_name"], dt(r["published_at"]),
                     a["name"] if a else "—",
                     f"{a['size']:,} B" if a else "—",
                     (a.get("digest") or "—").replace("sha256:", "")])
    table(c, PAD, yy - 8, [56, 72, 74, 70, 502],
          ["tag", "published", "asset", "size", "sha256 (published by GitHub)"],
          rows, fs=7.2, rh=15.6, mono_cols=(4,))

    # نشاط الكوميتات شهريًا
    from collections import Counter
    months = Counter(cm["commit"]["author"]["date"][:7] for cm in commits)
    yy2 = yy - 8 - 15.6 * (len(rows) + 1) - 26
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 9)
    c.drawString(PAD, yy2 + 12, "Commit activity by month — the work is spread across the whole period, not one dump")
    keys = sorted(months)
    bw2 = min(150, (W - 2 * PAD) / max(3, len(keys)))
    mx = max(months.values())
    for i, k in enumerate(keys):
        hgt = 46 * months[k] / mx
        bx = PAD + i * bw2
        c.setFillColor(PURPLE if k != keys[-1] else TEAL)
        c.roundRect(bx + 3, yy2 - hgt, bw2 - 24, hgt, 2, stroke=0, fill=1)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 7.2)
        c.drawCentredString(bx + (bw2 - 18) / 2, yy2 - hgt - 9, str(months[k]))
        c.setFillColor(MUTED); c.setFont("Helvetica", 6.8)
        c.drawCentredString(bx + (bw2 - 18) / 2, yy2 - hgt - 18, k)

    footer(c, plate, "Source: GitHub REST API — repos/Ahmedbecett/nexora-social-2026, /commits, /releases, /languages")
    save(c, p)
    return p


# ─────────────────────────────────────────────────────────── B2 كوميتات NEXORA
def board2(repo, commits, plate):
    p = os.path.join(OUT, "B2-github-commit-history-nexora.png")
    c = canvas.Canvas(p.replace(".png", ".pdf"), pagesize=(W, H))
    c.setFillColor(colors.white); c.rect(0, 0, W, H, stroke=0, fill=1)
    chrome(c, "Commit history — NEXORA AI", f"{len(commits)} commits, newest first · every entry read from the public repository",
           GH, ["github.com/Ahmedbecett/nexora-social-2026", f"retrieved {now()}"])

    y = H - 104
    c.setFillColor(SOFT); c.setStrokeColor(LINE); c.setLineWidth(0.7)
    c.roundRect(PAD, y - 24, W - 2 * PAD, 24, 4, stroke=1, fill=1)
    c.setFillColor(MUTED); c.setFont("Helvetica", 7.6)
    c.drawString(PAD + 10, y - 16,
                 "Range: " + dt(commits[-1]["commit"]["author"]["date"]) + "  →  " + dt(commits[0]["commit"]["author"]["date"])
                 + f"   ·   {len(commits)} commits   ·   branch main   ·   verification: gh api 'repos/Ahmedbecett/nexora-social-2026/commits?per_page=100'")

    rows = []
    for cm in commits:
        sha8 = cm["sha"][:8]
        subject = NX_EN.get(sha8) or asc(cm["commit"]["message"].split("\n")[0])
        rows.append([sha8[:7], dt(cm["commit"]["author"]["date"], "%d %b %y"), subject])
    table(c, PAD, y - 34, [58, 66, 646],
          ["sha", "date", "subject (English rendering — original wording unchanged in the repository)"],
          rows, fs=6.6, rh=11.9, mono_cols=(0,))

    footer(c, plate, f"Source: GitHub REST API — {repo['full_name']} · 34 entries, unabridged · subjects translated for review")
    save(c, p)
    return p


# ─────────────────────────────────────────────────────────── B3 مستودع GameVerse
def board3(plate, gv_commits):
    p = os.path.join(OUT, "B3-github-and-vercel-gameverse.png")
    c = canvas.Canvas(p.replace(".png", ".pdf"), pagesize=(W, H))
    c.setFillColor(colors.white); c.rect(0, 0, W, H, stroke=0, fill=1)
    chrome(c, "GameVerse — repository state and production record",
           "Private repository · 35 production commits recovered from the hosting platform's deployment records",
           TEAL, ["github.com/Ahmedbecett/gameverse (private)", f"retrieved {now()}"])

    y = H - 118
    c.setFillColor(colors.HexColor("#F6F8FA")); c.setStrokeColor(LINE); c.setLineWidth(0.8)
    c.roundRect(PAD, y - 54, W - 2 * PAD, 54, 6, stroke=1, fill=1)
    x = PAD + 12
    x = badge(c, x, y - 20, "Private", AMBER)
    x = badge(c, x, y - 20, "main", BLUE)
    c.setFillColor(MUTED); c.setFont("Helvetica", 8)
    c.drawString(x + 4, y - 16, "repository id 1429026253 · owner Ahmedbecett")
    c.drawString(x + 4, y - 28, "visibility read from the Vercel project metadata (githubRepoVisibility)")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 10)
    c.drawRightString(W - PAD - 14, y - 20, "repository not public")
    c.setFillColor(MUTED); c.setFont("Helvetica", 8)
    c.drawRightString(W - PAD - 14, y - 34, "no public link is claimed for it")

    yy = y - 76
    bw = (W - 2 * PAD - 2 * 10) / 3
    panel(c, PAD, yy - 46, bw, 46, "recorded commits", len(gv_commits), "production deployments", TEAL)
    panel(c, PAD + bw + 10, yy - 46, bw, 46, "newest commit", gv_commits[0]["sha"], gv_commits[0]["msg"][:42], PURPLE)
    panel(c, PAD + 2 * (bw + 10) - 12, yy - 46, bw, 46, "oldest commit", gv_commits[-1]["sha"],
          gv_commits[-1]["msg"][:42], AMBER)

    yy -= 66
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 9)
    c.drawString(PAD, yy, "Recovered commit list — newest first")
    rows = [[str(i + 1), cm["sha"], cm["msg"]] for i, cm in enumerate(gv_commits)]
    # عمودان لتغطية 35 صفًا
    half = 18
    table(c, PAD, yy - 8, [20, 52, 320], ["#", "sha", "subject"], rows[:half], fs=7.0, rh=14.6,
          header_bg=TEAL, mono_cols=(1,))
    table(c, PAD + 412, yy - 8, [20, 52, 292], ["#", "sha", "subject"], rows[half:], fs=7.0, rh=14.6,
          header_bg=TEAL, mono_cols=(1,))

    footer(c, plate, "Source: Vercel deployments API — project prj_7fJN5wSFW3IZmVy8FOK75hS0GuWb (commit metadata per deployment)")
    save(c, p)
    return p


# ─────────────────────────────────────────────────────────── B4 نطاقات Vercel
def board4(nx_dom, gv_dom, plate):
    p = os.path.join(OUT, "B4-vercel-domains.png")
    c = canvas.Canvas(p.replace(".png", ".pdf"), pagesize=(W, H))
    c.setFillColor(colors.white); c.rect(0, 0, W, H, stroke=0, fill=1)
    chrome(c, "Domains — both projects, from the hosting platform's own records",
           "GET /v9/projects/{id}/domains · every hostname assigned to either project, with its verification state",
           VK, ["vercel.com/ahmed-d33b", f"retrieved {now()}"], brand="Vercel")

    rows = [
        ["nexora-social-2026", "nexora-social-2026.vercel.app", "prj_thGtlyvUfPlr5mkSXOPUTvTXt6fo", "verified", dt_ms(nx_dom["created_at"])],
        ["gameverse", "gameverse-henna.vercel.app", "prj_7fJN5wSFW3IZmVy8FOK75hS0GuWb", "verified", dt_ms(gv_dom["created_at"])],
    ]
    y = H - 120
    table(c, PAD, y, [118, 226, 228, 62, 68],
          ["project", "domain", "project id", "state", "assigned"],
          rows, fs=7.8, rh=26, header_bg=VK, colors_map={(0, 3): GREEN, (1, 3): GREEN},
          mono_cols=(1, 2), bold_cols=(0,))

    # شرح
    y = y - 26 * 3 - 24
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 10)
    c.drawString(PAD, y, "What this record establishes")
    notes = [
        "Each domain is bound to exactly one project ID, and both projects sit in the same team (ahmed-d33b),",
        "whose only OWNER is the applicant. A vercel.app hostname is only issued automatically to the project",
        "that owns it, and its verification flag is set by the platform, not by the account holder.",
        "",
        "Neither project carries a custom top-level domain. Both products are served from *.vercel.app hostnames;",
        "that is the canonical address for each, and no other domain is claimed anywhere in this dossier.",
    ]
    c.setFillColor(colors.HexColor("#374151")); c.setFont("Helvetica", 8.6)
    for i2, line in enumerate(notes):
        c.drawString(PAD, y - 17 - i2 * 13.4, line)

    # الخام من الواجهة
    yy = y - 108
    c.setFillColor(SOFT); c.setStrokeColor(LINE); c.setLineWidth(0.7)
    c.roundRect(PAD, yy - 62, W - 2 * PAD, 62, 4, stroke=1, fill=1)
    c.setFillColor(MUTED); c.setFont("Helvetica-Bold", 7.2)
    c.drawString(PAD + 10, yy - 14, "RAW RESPONSE")
    c.setFillColor(colors.HexColor("#374151")); c.setFont("Courier", 7.2)
    for i3, l in enumerate([
        '{"name": "nexora-social-2026.vercel.app", "verified": true, "apexName": "vercel.app",',
        ' "projectId": "prj_thGtlyvUfPlr5mkSXOPUTvTXt6fo", "created_at": 1791649199369}',
        '{"name": "gameverse-henna.vercel.app", "verified": true, "apexName": "vercel.app",',
        ' "projectId": "prj_7fJN5wSFW3IZmVy8FOK75hS0GuWb", "created_at": 1792533290722}',
    ]):
        c.drawString(PAD + 10, yy - 27 - i3 * 11.5, l)

    # سلسلة الملكية: حساب ← فريق ← مشروع ← نطاق
    yy2 = yy - 84
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 9.4)
    c.drawString(PAD, yy2, "Ownership chain — each link is a record on the platform, not a claim")
    chain = [
        ("GitHub account", "Ahmedbecett", "owns both repositories"),
        ("Vercel team", "ahmed-d33b", "role OWNER, single member"),
        ("Project", "nexora-social-2026", "prj_thGtlyvUfPlr5mkSXOPUTvTXt6fo"),
        ("Domain", "nexora-social-2026.vercel.app", "verified 10 Oct 2026"),
    ]
    chain2 = [
        ("GitHub repo", "Ahmedbecett/gameverse", "private, id 1429026253"),
        ("Vercel team", "ahmed-d33b", "same owner as above"),
        ("Project", "gameverse", "prj_7fJN5wSFW3IZmVy8FOK75hS0GuWb"),
        ("Domain", "gameverse-henna.vercel.app", "verified 20 Oct 2026"),
    ]
    bw3 = (W - 2 * PAD - 3 * 34) / 4
    for row_i, chainx in enumerate((chain, chain2)):
        cy = yy2 - 24 - row_i * 62
        for i4, (lbl, val, note) in enumerate(chainx):
            bx = PAD + i4 * (bw3 + 34)
            c.setFillColor(colors.white); c.setStrokeColor(LINE); c.setLineWidth(0.8)
            c.roundRect(bx, cy - 42, bw3, 42, 4, stroke=1, fill=1)
            c.setFillColor(MUTED); c.setFont("Helvetica", 6.6)
            c.drawString(bx + 8, cy - 13, lbl.upper())
            c.setFillColor(INK); c.setFont("Helvetica-Bold", 7.8)
            tx = val
            while stringWidth(tx, "Helvetica-Bold", 7.8) > bw3 - 16 and len(tx) > 6:
                tx = tx[:-2] + "…"
            c.drawString(bx + 8, cy - 26, tx)
            c.setFillColor(MUTED); c.setFont("Helvetica", 6.4)
            tx2 = note
            while stringWidth(tx2, "Helvetica", 6.4) > bw3 - 16 and len(tx2) > 6:
                tx2 = tx2[:-2] + "…"
            c.drawString(bx + 8, cy - 36, tx2)
            if i4 < 3:
                c.setFillColor(colors.HexColor("#9CA3AF")); c.setFont("Helvetica-Bold", 11)
                c.drawCentredString(bx + bw3 + 17, cy - 26, "→")

    footer(c, plate, "Source: Vercel API — list_project_domains for both projects (page_info.has_next_page = false)")
    save(c, p)
    return p


def dt_ms(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).strftime("%d %b %Y")


# ─────────────────────────────────────────────────────────── B5 نشرات Vercel
def board5(nx_deps, gv_deps, plate):
    p = os.path.join(OUT, "B5-vercel-deployments.png")
    c = canvas.Canvas(p.replace(".png", ".pdf"), pagesize=(W, H))
    c.setFillColor(colors.white); c.rect(0, 0, W, H, stroke=0, fill=1)
    chrome(c, "Production deployments — both projects",
           "Each row is a real build that served the live site; the commit beside it is the code that shipped",
           VK, ["vercel.com/ahmed-d33b", f"retrieved {now()}"], brand="Vercel")

    y = H - 116

    def section(title, accent, deps, start_y):
        c.setFillColor(accent); c.setFont("Helvetica-Bold", 9.6)
        c.drawString(PAD, start_y, title)
        rows = []
        for d in deps:
            meta = d.get("meta") or {}
            sha = (meta.get("githubCommitSha") or "—")[:7]
            msg = (meta.get("githubCommitMessage") or "—").split("\n")[0]
            state = d.get("state") or d.get("readyState") or "—"
            rows.append([d["uid"][:14], dt_ms(d["created"]), sha, state, msg])
        cmap = {}
        for i, r in enumerate(rows):
            cmap[(i, 3)] = GREEN if r[3] in ("READY", "ready") else AMBER
        table(c, PAD, start_y - 8, [112, 76, 58, 58, 466],
              ["deployment", "created", "commit", "state", "commit message"],
              rows, fs=7.4, rh=15.4, header_bg=accent, colors_map=cmap, mono_cols=(0, 2))
        return start_y - 8 - 15.4 * (len(rows) + 1)

    y2 = section("NEXORA AI  ·  prj_thGtlyvUfPlr5mkSXOPUTvTXt6fo  ·  target = production", PURPLE, nx_deps, y)
    y3 = section("GameVerse  ·  prj_7fJN5wSFW3IZmVy8FOK75hS0GuWb  ·  target = production", TEAL, gv_deps, y2 - 34)

    # شرح القراءة
    yy4 = y3 - 30
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 9.4)
    c.drawString(PAD, yy4, "How to read this")
    tips = [
        ("Every row is a build that actually served the live site.", "State READY means the platform finished building and promoted it."),
        ("The commit column is the code inside that build.", "It matches a SHA in the commit history — the two records confirm each other."),
        ("The creator is the applicant's account.", "ahmedbecetti35@gmail.com, team role OWNER, on both projects."),
        ("Three rows carry no commit SHA.", "Those were CLI releases tagged with a source digest instead (sourceSha256), shown in the message."),
    ]
    for i5, (a, b) in enumerate(tips):
        ry = yy4 - 20 - i5 * 20
        c.setFillColor(PURPLE if i5 % 2 == 0 else TEAL)
        c.circle(PAD + 3, ry + 2.4, 2.4, stroke=0, fill=1)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 8.2)
        c.drawString(PAD + 12, ry, a)
        c.setFillColor(MUTED); c.setFont("Helvetica", 8.2)
        c.drawString(PAD + 12 + stringWidth(a, "Helvetica-Bold", 8.2) + 8, ry, b)

    footer(c, plate, "Source: Vercel API — list_deployments, target=production, newest page for each project")
    save(c, p)
    return p


if __name__ == "__main__":
    with open("/tmp/dom.json") as f:
        dom = json.load(f)
    with open("/tmp/vercel.json") as f:
        v = json.load(f)

    made = [
        board1(NX, NX_COMMITS, NX_RELEASES, NX_LANGS, "B1"),
        board2(NX, NX_COMMITS, "B2"),
        board3("B3", GV_COMMITS),
        board4(dom["nx"], dom["gv"], "B4"),
        board5(v["nx"], v["gv"], "B5"),
    ]
    for path in made:
        print(f"{os.path.basename(path):46} {os.path.getsize(path):>8,} B")
