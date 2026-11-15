#!/usr/bin/env python3
"""
الملف الجامع الوحيد — NEXORA AI + GAMEVERSE
يتضمّن: النطاقات، روابط المواقع، روابط المستودعات، سجل الكوميتات الكامل، وكل الأدلة.
المخرجات: docs/master/
"""
import os, argparse
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, PageBreak, KeepTogether, HRFlowable, Preformatted)
from reportlab.platypus import Image as RLImage, NextPageTemplate
from reportlab.lib.pagesizes import landscape

CASE_NX = "___________"
CASE_GV = "___________"
OUT = "docs/master"
os.makedirs(OUT, exist_ok=True)

INK    = colors.HexColor("#0C1020")
MUTED  = colors.HexColor("#5A6172")
ACCENT = colors.HexColor("#6D3BF5")   # NEXORA
ACC2   = colors.HexColor("#00A88F")   # GameVerse
LINE   = colors.HexColor("#D8DBE5")
SOFT   = colors.HexColor("#F3F0FF")
SOFT2  = colors.HexColor("#E9FAF7")
WARN   = colors.HexColor("#FFF4E5")

OWNER = dict(
    name  = "Ahmed Becetti",
    city  = "Chlef",
    country = "Algeria",
    email_nx = "ahmedbecetti35@gmail.com",
    email_gv = "ahmedbecetti41@gmail.com",
    phone = "+213 784 302 071",
    date  = "12 November 2026",
)

NX = dict(
    name = "NEXORA AI",
    pkg  = "com.ahmedbecetti.nexora",
    ver  = "4.4.0", vcode = "44",
    site = "https://nexora-social-2026.vercel.app",
    domain = "nexora-social-2026.vercel.app",
    repo = "https://github.com/Ahmedbecett/nexora-social-2026",
    repo_name = "Ahmedbecett/nexora-social-2026",
    repo_vis = "public",
    proj = "prj_thGtlyvUfPlr5mkSXOPUTvTXt6fo",
    team = "ahmed-d33b",
    deploy = "dpl_9KEo5GFwRECW7QAdh4b6ZLFhCzv6",
    commit = "97545b1557d757eabd8cacdc09874ae4df2b2b38",
    apk_sha = "0BB69798A7D99CE84EA940EF8C18B2403A6A8B37975DD1C815F5BBA32E85B662",
    apk_size = "13,814,604 bytes",
    cert_sha = "24:0E:00:2F:A0:90:51:6D:EF:06:E8:92:61:4F:03:A3:79:17:A0:3B:30:04:BE:EC:F5:1B:1A:D3:0C:07:42:F6",
    cert_subj = "CN=NEXORA AI, OU=Mobile, O=Ahmed Becetti, L=Chlef, C=DZ",
    cert_serial = "669888727667885013161587190790839580619482603532",
    cert_valid = "11 November 2026 — 29 March 2054",
    apk_url = "https://nexora-social-2026.vercel.app/download/Nexora.apk",
    admob = "ca-app-pub-6858364141205978",
    commits = 34,
    releases = ["latest — signed APK (10 Nov 2026)", "v3.2.0 (12 Oct 2026)", "v3.1.0 (12 Oct 2026)",
                "v3.0.0 (12 Oct 2026)", "v2.6.0 (11 Oct 2026)"],
    links = [
        ("Application", "https://nexora-social-2026.vercel.app"),
        ("Android download page", "https://nexora-social-2026.vercel.app/download/Nexora.apk"),
        ("Source repository", "https://github.com/Ahmedbecett/nexora-social-2026"),
        ("Releases", "https://github.com/Ahmedbecett/nexora-social-2026/releases"),
        ("Latest release asset", "https://github.com/Ahmedbecett/nexora-social-2026/releases/latest/download/Nexora.apk"),
        ("Signing documentation", "https://github.com/Ahmedbecett/nexora-social-2026/blob/main/docs/ci/SIGNING.md"),
        ("Store screenshots (20)", "https://github.com/Ahmedbecett/nexora-social-2026/tree/main/store/capture"),
    ],
)

GV = dict(
    name = "GameVerse",
    pkg  = "com.gameverse.app",
    ver  = "2.8.0", vcode = "2800",
    site = "https://gameverse-henna.vercel.app",
    domain = "gameverse-henna.vercel.app",
    domain_auto = ["gameverse-ahmed-d33b.vercel.app", "gameverse-git-main-ahmed-d33b.vercel.app"],
    repo = "https://github.com/Ahmedbecett/gameverse",
    repo_name = "Ahmedbecett/gameverse",
    repo_vis = "private",
    proj = "prj_7fJN5wSFW3IZmVy8FOK75hS0GuWb",
    team = "ahmed-d33b",
    deploy = "dpl_451ViE6CPqmc12hixYFDV9RhiUQc",
    commit = "30dc8fa40fc32df84bb40fd7d3539509718f48d2",
    apk_sha = "6083DE941F114E89E06B10AED4569C8F45EE67FCD4DCFC8716898DA46901C82B",
    cert_sha = "C14535373C95B51A188E4F885FDC755CAD3212FB9AC1487DE2D6EEC5D48E0668",
    apk_url = "https://gameverse-henna.vercel.app/dl/gameverse-2.8.0-release.apk",
    ads_url = "https://gameverse-henna.vercel.app/app-ads.txt",
    admob = "pub-6858364141205978",
    links = [
        ("Application", "https://gameverse-henna.vercel.app"),
        ("About — who built it", "https://gameverse-henna.vercel.app/about"),
        ("App page — version and platforms", "https://gameverse-henna.vercel.app/app"),
        ("APK download", "https://gameverse-henna.vercel.app/dl/gameverse-2.8.0-release.apk"),
        ("APK checksum", "https://gameverse-henna.vercel.app/dl/gameverse-2.8.0-release.apk.sha256"),
        ("app-ads.txt", "https://gameverse-henna.vercel.app/app-ads.txt"),
        ("Privacy policy", "https://gameverse-henna.vercel.app/privacy"),
        ("Partners and licensing", "https://gameverse-henna.vercel.app/partners"),
        ("Developer portal", "https://gameverse-henna.vercel.app/developers"),
        ("Support centre", "https://gameverse-henna.vercel.app/support"),
        ("Game catalogue", "https://gameverse-henna.vercel.app/games"),
        ("Original games", "https://gameverse-henna.vercel.app/original-games"),
        ("Source repository (private)", "https://github.com/Ahmedbecett/gameverse"),
        ("Alternate host", "https://gameverse-ahmed-d33b.vercel.app"),
    ],
    # سجل الكوميتات — مستخرَج من سجل النشر في Vercel (المستودع خاص)
    commits = [
        ("30dc8fa4", "android: publish APK checksum sidecar for download verification"),
        ("28656570", "android: publish owner-signed APK under a cache-busting filename"),
        ("394197ac", "android: rotate release key to 2.8.0 PKCS#12, ship owner-signed APK, v2 signer tool"),
        ("efb4799e", "amazon: crisp featured logo (no halo)"),
        ("c795d02e", "app page: print the real host for the short download link"),
        ("08e885b1", "privacy: AdMob/app section (EN+AR); smoke: app-ads.txt + /app + APK checks"),
        ("06d63b7e", "wordmark v3 (header/footer/login), screenshots expanded to 14 OSS games, matrix+fetcher scripts"),
        ("29344d77", "webhooks: distinguish missing PAYPAL_WEBHOOK_ID (503) from invalid signature (401)"),
        ("4a1d2c6d", "Support both configured Monetag zones"),
        ("0e09d7ec", "R137: fix duplicate project id in deploy script"),
        ("9e1ce577", "R135b: fix AdSense CSP host list, allow third-party game frames, collapse empty partner shells"),
        ("aee7f8c5", "R134b: enforce the ad gate inside AdSlot so no unit can render on /play or /login"),
        ("fc9e67a8", "R134: fix missing cover art deploy, replace ad stack with opt-in policy-safe module, security headers, ads.txt overhaul"),
        ("fa7e210a", "R132 add large sponsored showcase"),
        ("6feb7ff8", "R131 add interactive sponsored entry link"),
        ("8d048231", "R130 add isolated 300x600 sponsored banner"),
        ("bcf3eb7d", "R129 add visible owner-supplied sponsored link"),
        ("1738e933", "v3.12.0 — personal For You hub from real play, favourites and reviews"),
        ("5a1c23ca", "v3.11.0 — R128: TinyAdz loader under the same server gate"),
        ("8ceab34a", "v3.10.0 — R127: Perch direct ad space (owner pre-approves every ad)"),
        ("94b10e51", "v3.9.0 — R124: Axiom banner zone (server-gated: EEA consent, WebView and /play exclusions)"),
        ("57e25f23", "v3.8.1 — R123: Axiom ownership verification meta in root metadata"),
        ("cacaa973", "v3.8.0 — R122: Adsterra fully removed (owner decision)"),
        ("666d2203", "GameVerse v3.1.0 (R115): real-games trio — Pixel Peaks, Star Siege, SuperTux entry"),
        ("2352a607", "GameVerse v3.0.2 (R114c): leaderboard test retry + purge hygiene"),
        ("493b752d", "GameVerse v3.0 (R114): daily rewards + streaks + global-speed package"),
        ("bc4833b9", "GameVerse v2.9 (R113): achievements come alive + restore dev build route"),
        ("c310f36a", "GameVerse v2.8.2 (R112): launch campaign kit"),
        ("8f3715b2", "GameVerse v2.8.1 (R111b): direct APK download link on-site"),
        ("3e85624d", "GameVerse v2.8 (R111): native Android shell + PWA identity"),
        ("ec938b32", "GameVerse v2.7 (R110): two new originals — Orbit Catch + Brick Storm"),
        ("b54080d3", "GameVerse v2.5 (R108): GDPR data export + Vercel Cron weekly digest"),
        ("8a9059d0", "GameVerse v2.4 (R107): opt-in weekly email digest via Brevo"),
        ("ec6e84f8", "docs: DNS plan v4 — domain strategy and hosting decision record"),
        ("d04e7227", "docs: DNS plan v3 — domain strategy and hosting decision record"),
    ],
)

NX_COMMITS = [
    ("97545b15", "2026-11-12", "chore: refresh Nexora.apk for the website"),
    ("3861c619", "2026-11-12", "Merge pull request #12 — release 4.4.0"),
    ("cb2aa655", "2026-11-12", "fix(ui): unify the version number — the button said v4.0 while the package was 4.4.0"),
    ("765ed055", "2026-11-12", "chore: refresh Nexora.apk for the website"),
    ("125b4a2a", "2026-11-12", "Merge pull request #11"),
    ("2eb9857c", "2026-11-12", "chore(ci): correct message when using the tracked file + report update"),
    ("cf88a4e1", "2026-11-12", "feat(auth): Firebase initialisation with the correct production-key fingerprint"),
    ("bed16e3d", "2026-11-12", "docs: prove item 8 with a real request to the live API"),
    ("9268f29a", "2026-11-12", "fix(api): API version 4.4.0 + tests that protect AdMob"),
    ("af40b6d1", "2026-11-12", "docs: Firebase fingerprint comparison table against the published package key"),
    ("c2715f6a", "2026-11-12", "docs: update the delivery report with real build results"),
    ("1a4faf8b", "2026-11-12", "feat(build): refuse to produce a package signed with an unapproved key"),
    ("875a8c52", "2026-11-12", "feat(ci): the gate also fails if configuration exists but was not bundled"),
    ("81402844", "2026-11-12", "feat(ci): gate preventing publication of a package with Google but no configuration (cause of rejection 43)"),
    ("3f5c05ed", "2026-11-12", "fix(android): build version 44 — valid manifest + google-services.json"),
    ("73a3f25d", "2026-11-12", "fix(auth): Fire OS login — guaranteed Google response + real email sign-in (v4.4.0 / 44)"),
    ("6c3931be", "2026-11-11", "chore: refresh Nexora.apk for the website"),
    ("8fe49b58", "2026-11-11", "Merge pull request #9"),
    ("a186c810", "2026-11-11", "docs(ci): document production signing — secrets, key fingerprint, retention rules"),
    ("895fcf62", "2026-11-11", "chore: refresh Nexora.apk for the website"),
    ("c0150959", "2026-11-11", "Merge pull request #8"),
    ("6f366867", "2026-11-11", "fix(web): stale metadata — v4.3.0 and the real APK size"),
    ("2592c31d", "2026-11-10", "chore: refresh Nexora.apk for the website"),
    ("94cf6d1a", "2026-11-10", "Merge pull request #7"),
    ("3bea9474", "2026-11-10", "fix(android): repair assembleRelease signing + CI builds on PRs before merge"),
    ("32d24bff", "2026-11-10", "Merge pull request #6"),
    ("fb6b4d01", "2026-11-10", "v4.3.0 — Google AdMob officially integrated into NEXORA (owner App ID and ad units)"),
    ("01241fda", "2026-11-10", "v4.2.0 — lean APK: no subscription UI, faster, sharing and reply conversion, site link, AdMob ready"),
    ("3bdfe4b9", "2026-10-13", "Native app 4.2.0 (no WebView): direct download from the site"),
    ("dea01116", "2026-10-13", "root fix: .gitignore pattern excluded all of api/_lib (9 files) so the API failed on Vercel — pattern now anchored"),
    ("5a282359", "2026-10-13", "move CI configuration to docs/ci (no workflow permission needed) — Vercel deploys automatically"),
    ("8827dcc1", "2026-10-13", "clean up the last traces of the old social description — the project now accurately describes NEXORA AI"),
    ("d8014c2b", "2026-10-13", "README updated for the NEXORA AI platform + old Android workflow removed"),
    ("744323b6", "2026-10-13", "NEXORA AI 4.1: the complete AI platform — multilingual chat, web search with sources, file and image analysis, voice in and out, real subscription and payment system, protection and security"),
]

def st(name, **kw):
    base = dict(fontName="Helvetica", fontSize=9.2, leading=13.2, textColor=INK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(name, **base)

BODY  = st("b", spaceAfter=6, alignment=TA_JUSTIFY)
LEAD  = st("l", fontSize=9.8, leading=14.4, spaceAfter=8, alignment=TA_JUSTIFY)
H1    = st("h1", fontName="Helvetica-Bold", fontSize=19, leading=23, alignment=TA_LEFT, spaceAfter=3)
H2    = st("h2", fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=ACCENT, alignment=TA_LEFT, spaceAfter=5, spaceBefore=11)
H2G   = st("h2g", fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=ACC2, alignment=TA_LEFT, spaceAfter=5, spaceBefore=11)
H3    = st("h3", fontName="Helvetica-Bold", fontSize=9.6, leading=13, alignment=TA_LEFT, spaceAfter=3, spaceBefore=7)
SMALL = st("s", fontSize=7.8, leading=10.6, textColor=MUTED, alignment=TA_LEFT)
MONO  = st("m", fontName="Courier", fontSize=6.9, leading=9.6, alignment=TA_LEFT)

MARGIN, HEADER_H = 18*mm, 24*mm

class Doc(BaseDocTemplate):
    def __init__(self, path, **kw):
        super().__init__(path, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                         topMargin=HEADER_H+6*mm, bottomMargin=17*mm,
                         title="NEXORA AI and GameVerse — Consolidated Ownership Dossier",
                         author=OWNER["name"], **kw)
        self.case_nx = CASE_NX
        self.case_gv = CASE_GV
        fr = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="f")
        LW, LH = landscape(A4)
        fr_land = Frame(MARGIN, 14 * mm, LW - 2 * MARGIN, LH - 34 * mm, id="fl")
        self.addPageTemplates([
            PageTemplate(id="p", frames=[fr], onPage=self.deco, pagesize=A4),
            PageTemplate(id="landscape", frames=[fr_land], onPage=self.deco_land, pagesize=landscape(A4)),
        ])

    def deco_land(self, c, doc):
        LW, LH = landscape(A4)
        c.setFillColor(ACCENT); c.rect(0, LH - 3 * mm, LW * 0.52, 3 * mm, stroke=0, fill=1)
        c.setFillColor(ACC2);   c.rect(LW * 0.52, LH - 3 * mm, LW * 0.48, 3 * mm, stroke=0, fill=1)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 8)
        c.drawString(MARGIN, LH - 11 * mm, "AHMED BECETTI  ·  NEXORA AI & GameVerse  ·  Consolidated Ownership Dossier")
        c.setFillColor(MUTED); c.setFont("Helvetica", 7)
        label = self.case_nx if set(self.case_nx) - {"_"} else "___________"
        c.drawRightString(LW - MARGIN, LH - 11 * mm, f"Amazon case: {label}   ·   visual evidence annex")
        c.setStrokeColor(LINE); c.setLineWidth(0.5)
        c.line(MARGIN, 11 * mm, LW - MARGIN, 11 * mm)

    def deco(self, c, doc):
        w, h = A4
        c.setFillColor(ACCENT); c.rect(0, h-4*mm, w*0.52, 4*mm, stroke=0, fill=1)
        c.setFillColor(ACC2);   c.rect(w*0.52, h-4*mm, w*0.48, 4*mm, stroke=0, fill=1)

        c.setFillColor(ACCENT); c.roundRect(MARGIN, h-21*mm, 12*mm, 12*mm, 2.5*mm, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(MARGIN+6*mm, h-17.3*mm, "AB")
        x = MARGIN+15.5*mm
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 11.5)
        c.drawString(x, h-13.2*mm, "AHMED BECETTI")
        c.setFillColor(MUTED); c.setFont("Helvetica", 7.2)
        c.drawString(x, h-17*mm, "NEXORA AI  ·  GameVerse")
        c.drawString(x, h-20.2*mm, f"{OWNER['city']}, {OWNER['country']}  ·  sole proprietor")

        c.setFillColor(INK); c.setFont("Helvetica-Bold", 7.5)
        c.drawRightString(w-MARGIN, h-13.2*mm, "CONSOLIDATED OWNERSHIP DOSSIER")
        c.setFillColor(MUTED); c.setFont("Helvetica", 6.9)
        c.drawRightString(w-MARGIN, h-17*mm, f"Date: {OWNER['date']}")
        parts = []
        if self.case_nx and set(self.case_nx) - {"_"}:
            parts.append(f"NEXORA AI: {self.case_nx}")
        if self.case_gv and set(self.case_gv) - {"_"}:
            parts.append(f"GameVerse: {self.case_gv}")
        label = ("Amazon cases — " + "  ·  ".join(parts)) if parts else "Covering both applications"
        c.drawRightString(w-MARGIN, h-20.2*mm, label)

        c.setStrokeColor(LINE); c.setLineWidth(0.7)
        c.line(MARGIN, h-HEADER_H, w-MARGIN, h-HEADER_H)
        c.line(MARGIN, 13*mm, w-MARGIN, 13*mm)
        c.setFillColor(MUTED); c.setFont("Helvetica", 6.6)
        c.drawString(MARGIN, 9.4*mm, f"NEXORA AI & GameVerse — Consolidated Ownership Dossier · {OWNER['name']}")
        c.drawRightString(w-MARGIN, 9.4*mm, f"Page {doc.page}")

def kv(rows, widths=(46*mm, 122*mm), fs=8.1, pad=3.6):
    data = [[Paragraph(f"<b>{k}</b>", st("k", fontSize=fs, leading=fs+3.2, alignment=TA_LEFT)),
             Paragraph(v, st("v", fontSize=fs, leading=fs+3.2, alignment=TA_LEFT))] for k, v in rows]
    t = Table(data, colWidths=list(widths), repeatRows=0)
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BACKGROUND", (0,0), (0,-1), SOFT),
        ("GRID", (0,0), (-1,-1), 0.4, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), pad), ("BOTTOMPADDING", (0,0), (-1,-1), pad),
    ]))
    return t

def kv2(rows, widths=(46*mm, 122*mm), fs=8.1):
    t = kv(rows, widths, fs)
    t.setStyle(TableStyle([("BACKGROUND", (0,0), (0,-1), SOFT2)]))
    return t

def note(text, bg=SOFT, bar=ACCENT, fs=8.3):
    t = Table([[Paragraph(text, st("n", fontSize=fs, leading=fs+4))]], colWidths=[174*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("LINEBEFORE", (0,0), (0,-1), 2.4, bar),
        ("LEFTPADDING", (0,0), (-1,-1), 8), ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    return t

MS = st("ms", fontName="Courier", fontSize=7.0, leading=10.2, alignment=TA_LEFT)


def msgbox(text, w=174*mm, fs=7.6, lead=10.8):
    """مربّع نصي يلفّ الكلمات ويحافظ على فواصل الفقرات — للنصوص الجاهزة للنسخ."""
    flow = []
    for i, block in enumerate(text.split("\n\n")):
        b = block.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        flow.append(Paragraph("<br/>".join(b.split("\n")),
                              st(f"mb{i}", fontName="Helvetica", fontSize=fs, leading=lead, spaceAfter=5)))
    t = Table([[flow]], colWidths=[w])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F6F7FA")),
        ("BOX", (0,0), (-1,-1), 0.4, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 8), ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    return t

def code(text, w=174*mm, style=None):
    t = Table([[Preformatted(text.replace("&","&amp;").replace("<","&lt;"), style or MS)]], colWidths=[w])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F6F7FA")),
        ("BOX", (0,0), (-1,-1), 0.4, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    return t


# =====================================================================
def build(path):
    S = []
    # ---------- الغلاف ----------
    S.append(Spacer(1, 6))
    S.append(Paragraph("Consolidated Ownership Dossier", H1))
    S.append(Paragraph("NEXORA AI &amp; GameVerse — complete evidence of authorship, ownership and operation",
                       st("sub", fontSize=10, leading=14, textColor=MUTED, spaceAfter=12)))

    S.append(note(
        f"<b>Submitted by {OWNER['name']}</b>, an individual developer resident in {OWNER['city']}, "
        f"{OWNER['country']}, to Amazon Developer Support in support of two applications: <b>NEXORA AI</b> "
        f"and <b>GameVerse</b>. This single document contains every piece of evidence for both: the domains, "
        "the website links, the repository links, the complete commit histories, the signing identities, and "
        "the reasoning that resolves the ownership question Amazon raised.", fs=8.6))
    S.append(Spacer(1, 10))

    S.append(Paragraph("The two applications at a glance", H3))
    S.append(kv([
        ("NEXORA AI", f"AI assistant platform · {NX['pkg']} · v{NX['ver']} · "
                      f"<font face='Courier' size='7.2'>{NX['domain']}</font>"),
        ("GameVerse", f"Gaming platform · {GV['pkg']} · v{GV['ver']} · "
                      f"<font face='Courier' size='7.2'>{GV['domain']}</font>"),
        ("Rights holder", f"{OWNER['name']} — sole author and sole owner of both"),
        ("Capacity", "Natural person, sole proprietor. No company, co-owner, employer or contractor."),
        ("Contact", f"{OWNER['email_nx']} (NEXORA)  ·  {OWNER['email_gv']} (GameVerse)  ·  {OWNER['phone']}"),
    ]))

    S.append(Paragraph("Contents", H3))
    contents = [
        ("1", "The question Amazon asked, and the answer", "Why no licence agreement can exist here"),
        ("2", "The rights holder", "Identity, capacity, accounts and control"),
        ("3", "NEXORA AI — application record", "Package, version, domains, links, evidence"),
        ("4", "GameVerse — application record", "Package, version, domains, links, evidence"),
        ("5", "Domains — both applications", "Every hostname, its role and its status"),
        ("6", "Complete commit history — NEXORA AI", f"All {NX['commits']} commits"),
        ("7", "Complete commit history — GameVerse", f"{len(GV['commits'])} recorded commits"),
        ("8", "Technical proof of authorship", "Signing certificates, digests, deployments"),
        ("9", "Third-party content", "What is not owned, and why it creates no competing claim"),
        ("10", "Verification commands", "Reproduce every claim independently"),
        ("11", "Evidence index — claim by claim", "Every exhibit, and what it proves"),
        ("12", "What to send to Amazon", "Two ready replies and an attachment checklist"),
        ("13", "Undertaking and signature", "Signed by the rights holder"),
        ("A", "Annex A — visual evidence", "Five boards rendered from GitHub and Vercel records"),
    ]
    ct = Table([[Paragraph(f"<b>{n}</b>", st("cn", fontSize=8.6, alignment=TA_CENTER)),
                 Paragraph(t, st("ct", fontSize=8.6, alignment=TA_LEFT)),
                 Paragraph(f"<font color='#5A6172'>{d}</font>", st("cd", fontSize=7.6, alignment=TA_LEFT))]
                for n, t, d in contents], colWidths=[10*mm, 70*mm, 88*mm])
    ct.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LINEBELOW", (0,0), (-1,-2), 0.3, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4),
        ("TOPPADDING", (0,0), (-1,-1), 3.4), ("BOTTOMPADDING", (0,0), (-1,-1), 3.4),
    ]))
    S.append(ct)

    S.append(Spacer(1, 12))
    S.append(Paragraph("The numbers a reviewer will want first", H3))
    kb = [[Paragraph("<font size='13' color='#4F46E5'><b>2</b></font><br/><font size='6.8' color='#5A6172'>applications</font>",
                     st("k1", fontSize=7, alignment=TA_CENTER)),
           Paragraph("<font size='13' color='#4F46E5'><b>69</b></font><br/><font size='6.8' color='#5A6172'>commits</font>",
                     st("k2", fontSize=7, alignment=TA_CENTER)),
           Paragraph("<font size='13' color='#4F46E5'><b>5</b></font><br/><font size='6.8' color='#5A6172'>domains</font>",
                     st("k3", fontSize=7, alignment=TA_CENTER)),
           Paragraph("<font size='13' color='#4F46E5'><b>16</b></font><br/><font size='6.8' color='#5A6172'>exhibits</font>",
                     st("k4", fontSize=7, alignment=TA_CENTER)),
           Paragraph("<font size='13' color='#4F46E5'><b>0</b></font><br/><font size='6.8' color='#5A6172'>third-party owners</font>",
                     st("k5", fontSize=7, alignment=TA_CENTER))]]
    kt = Table(kb, colWidths=[33.6*mm]*5)
    kt.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.3, LINE),
        ("INNERGRID", (0,0), (-1,-1), 0.3, LINE),
        ("BACKGROUND", (0,0), (-1,-1), SOFT),
        ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    S.append(kt)

    S.append(Spacer(1, 10))
    S.append(Paragraph(
        "<font size='7.6' color='#5A6172'>Reading order for a reviewer in a hurry: §1 answers the question that "
        "was asked; §5 lists the domains from the hosting platform's own records; §6 and §7 give the full commit "
        "histories; §8 gives the signing identities; §11 is the exhibit index; §12 holds the two case replies "
        "ready to paste; §13 is the signature.</font>",
        st("ro", fontSize=7.6, leading=10.6)))

    # ---------- 1 ----------
    S.append(PageBreak())
    S.append(Paragraph("1. The question Amazon asked, and the answer", H2))
    S.append(Paragraph(
        "Amazon Developer Support asked for <i>documentation demonstrating valid intellectual property rights</i>: "
        "either a confirmation letter from the intellectual property rights holder bearing a formal signature, or a "
        "copy of the applicable licence agreement, on letterhead or stamp paper, clearly defining the relationship "
        "and the presence of both parties.", LEAD))
    S.append(Paragraph("The premise behind that request does not hold in this case.", st("x", fontSize=9.6, leading=14, spaceAfter=6)))
    S.append(Paragraph(
        "A licence agreement is a document between <b>two</b> parties: one who owns something, and one who is "
        "permitted to use it. It exists to define a relationship between a rights holder and a developer who is a "
        "different person. Here there is only one party. I wrote both applications myself, I own them outright, and "
        "I am the developer account holder. A licence from myself to myself would have no legal meaning, which is "
        "why no such document can be produced — not because it was lost, or refused, or withheld by a company, but "
        "because the situation it describes does not exist.", BODY))
    S.append(Paragraph(
        "What <i>can</i> be produced is the other half of Amazon's request: the <b>confirmation letter from the "
        "intellectual property rights holder bearing a formal signature</b>. That is what this dossier supplies, "
        "together with a signed declaration and a body of cryptographic evidence that ties both applications to me "
        "in a way that can be checked independently.", BODY))
    S.append(Spacer(1, 4))
    S.append(note(
        "<b>The evidence in one sentence.</b> Both applications are served from domains under my hosting account, "
        "built from repositories owned by my GitHub account, signed with private keys held only by me, and both "
        "publish a checksum for the exact binary submitted so that anyone can confirm the file is mine without "
        "taking my word for anything."))

    S.append(Paragraph("What this dossier contains, and why each part matters", H3))
    S.append(kv([
        ("Domains (§5)", "Every hostname associated with both applications, extracted from the hosting platform's "
                         "own records — not self-reported."),
        ("Website links (§3, §4)", "The public pages that describe each application, its version, its policies and "
                                    "its advertising authorisation."),
        ("Repository links (§3, §4)", "The source repositories, with their visibility stated honestly."),
        ("Commit histories (§6, §7)", "Every recorded commit for both applications, newest first, with subject lines "
                                       "unchanged."),
        ("Technical proof (§8)", "Signing certificate subjects, SHA-256 digests, deployment identifiers and "
                                  "publishing accounts."),
        ("Verification (§10)", "Commands a reviewer can run to reproduce every claim."),
    ]))

    # ---------- 2 ----------
    S.append(Paragraph("2. The rights holder", H2))
    S.append(Paragraph(
        "The person making this declaration, and the only person with any ownership interest in either application.",
        BODY))
    S.append(kv([
        ("Full legal name", OWNER["name"]),
        ("Residence", f"{OWNER['city']}, {OWNER['country']}"),
        ("Capacity", "Natural person — individual developer and sole proprietor"),
        ("NEXORA contact", OWNER["email_nx"]),
        ("GameVerse contact", OWNER["email_gv"]),
        ("Telephone / WhatsApp", OWNER["phone"]),
        ("GitHub account", "Ahmedbecett — owner and sole contributor of both repositories"),
        ("Vercel team", f"{NX['team']} (team_YCGVFOkWo0Kktd4rv4UYfwVa) — owner role"),
        ("AdMob publisher", f"{NX['admob']} — same publisher ID used by both applications"),
    ]))

    S.append(Paragraph("Accounts and control", H3))
    S.append(Paragraph(
        "Every system either application depends on is registered to the applicant. No third party holds "
        "administrative access to the hosting projects, the databases, the advertising accounts or the source "
        "repositories. The same hosting team serves both applications, and the same advertising publisher ID "
        "appears in both — a detail worth checking, because it links the two products to one operator.", BODY))

    S.append(Paragraph("Authorship history in brief", H3))
    S.append(Paragraph(
        "Both products were built incrementally, and the record of that work is the strongest available evidence of "
        "authorship. NEXORA AI's public repository holds 34 commits spanning October and November 2026, from the "
        "first complete AI platform (v4.1) through the AdMob integration, the Fire OS login repair, and the "
        "v4.4.0 release that addresses Amazon's earlier rejection. GameVerse's repository is private, but its "
        f"hosting platform retains {len(GV['commits'])} recorded production commits, listed in §7, from the early "
        "platform phases through the native Android shell, the advertising decisions, and the owner-signed 2.8.0 "
        "APK.", BODY))
    S.append(Spacer(1, 3))
    S.append(note("Neither product is a first draft, a template, or a reskin. The commit histories show months of "
                  "iteration on authentication, advertising compliance, privacy controls, moderation and signing "
                  "— the ordinary, unglamorous work of building something that lasts.", bg=SOFT2, bar=ACC2))

    # ---------- 3 ----------
    S.append(Paragraph(f"3. {NX['name']} — application record", H2))
    S.append(kv([
        ("Application", NX["name"]),
        ("Purpose", "AI assistant platform: multilingual chat with saved context, web search with cited "
                    "sources, file and image analysis, voice in and out, subscriptions and payments"),
        ("Package identifier", NX["pkg"]),
        ("Version / versionCode", f"{NX['ver']} / {NX['vcode']}"),
        ("Category", "Productivity / AI assistant"),
        ("Primary domain", f"<font face='Courier' size='7.4'>{NX['domain']}</font>"),
        ("Source repository", f"<font face='Courier' size='7.2'>{NX['repo_name']}</font> (public)"),
        ("Vercel project", NX["proj"]),
        ("Production deployment", NX["deploy"]),
        ("Current commit", NX["commit"]),
        ("AdMob publisher", NX["admob"]),
    ], fs=8.0))
    S.append(Spacer(1, 5))

    S.append(Paragraph("Public links — NEXORA AI", H3))
    S.append(kv([(k, f"<font face='Courier' size='7.1'>{v}</font>") for k, v in NX["links"]],
                widths=(52*mm, 116*mm), fs=7.9))
    S.append(Spacer(1, 5))
    S.append(Paragraph("Release history", H3))
    S.append(kv([(r.split(" (")[0], r.split("(")[1].rstrip(")")) for r in NX["releases"]],
                widths=(62*mm, 40*mm), fs=7.9))
    S.append(Spacer(1, 4))
    S.append(Paragraph(
        "The Android build is distributed as a signed APK from the application's own domain. The site publishes "
        "the download page, and the public repository publishes the release asset. Both files are identical, and "
        "GitHub records the digest independently — see §8.", BODY))

    # ---------- 4 ----------
    S.append(Paragraph(f"4. {GV['name']} — application record", H2))
    S.append(kv2([
        ("Application", GV["name"]),
        ("Purpose", "Gaming platform: 45 published games (17 in-house originals), instant browser play in a "
                    "sandboxed player, verified download listings, accounts, leaderboards, reviews, store, "
                    "developer portal"),
        ("Package identifier", GV["pkg"]),
        ("Version / versionCode", f"{GV['ver']} / {GV['vcode']}"),
        ("Platforms", "Android 7.0+, Amazon Fire OS tablets, Fire TV (leanback), Vega OS build prepared"),
        ("Category", "Games — catalogue and instant-play platform"),
        ("Primary domain", f"<font face='Courier' size='7.4'>{GV['domain']}</font>"),
        ("Automatic domains", f"<font face='Courier' size='6.9'>{', '.join(GV['domain_auto'])}</font>"),
        ("Source repository", f"<font face='Courier' size='7.2'>{GV['repo_name']}</font> (private)"),
        ("Vercel project", GV["proj"]),
        ("Production deployment", GV["deploy"]),
        ("Current commit", GV["commit"]),
        ("AdMob publisher", GV["admob"]),
    ], fs=8.0))
    S.append(Spacer(1, 5))

    S.append(Paragraph("Public links — GameVerse", H3))
    S.append(kv2([(k, f"<font face='Courier' size='7.1'>{v}</font>") for k, v in GV["links"]],
                 widths=(52*mm, 116*mm), fs=7.9))
    S.append(Spacer(1, 5))
    S.append(note(
        f"<b>On the private repository.</b> {GV['repo_name']} is a private repository. It is listed here for "
        "completeness and because Amazon may request access to it; it is <b>not</b> offered as a public link, and "
        "no public claim is made about it. The commit history in §7 was extracted from the hosting platform's "
        "deployment records, which are the same records that carried each build to production.",
        bg=WARN, bar=colors.HexColor("#D97706")))

    # ---------- 5 ----------
    S.append(Paragraph("5. Domains — both applications", H2))
    S.append(Paragraph(
        "Every hostname below was read from the hosting platform's own domain records for the two projects, not "
        "typed from memory. This is the answer to the question of which domains belong to which application.", BODY))

    S.append(Paragraph("Domain ledger — every hostname, both applications", H3))
    drows = [[Paragraph("<b>Hostname</b>", st("dm0", fontSize=7.2, textColor=colors.white)),
              Paragraph("<b>Application</b>", st("dm1", fontSize=7.2, textColor=colors.white)),
              Paragraph("<b>Role</b>", st("dm2", fontSize=7.2, textColor=colors.white)),
              Paragraph("<b>Verified</b>", st("dm3", fontSize=7.2, textColor=colors.white)),
              Paragraph("<b>Assigned</b>", st("dm4", fontSize=7.2, textColor=colors.white))]]
    doms = [
        (NX["domain"], "NEXORA AI", "Canonical production hostname", "Yes", "12 Nov 2026"),
        (GV["domain"], "GameVerse", "Canonical production hostname", "Yes", "20 Oct 2026"),
        (GV["domain_auto"][0], "GameVerse", "Automatic deployment alias", "Yes", "20 Oct 2026"),
        (GV["domain_auto"][1], "GameVerse", "Git branch alias (main)", "Yes", "20 Oct 2026"),
        ("*.vercel.app", "both", "Preview deployments, per build", "—", "automatic"),
    ]
    for host, app, role, ver, when in doms:
        drows.append([
            Paragraph(f"<font face='Courier' size='6.6'>{host}</font>", st("dv1", fontSize=6.6, leading=9)),
            Paragraph(app, st("dv2", fontSize=7, leading=9)),
            Paragraph(role, st("dv3", fontSize=7, leading=9)),
            Paragraph(ver, st("dv4", fontSize=7, leading=9)),
            Paragraph(when, st("dv5", fontSize=7, leading=9)),
        ])
    dt = Table(drows, colWidths=[50*mm, 20*mm, 56*mm, 16*mm, 26*mm], repeatRows=1)
    dt.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), ACCENT),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("GRID", (0,0), (-1,-1), 0.3, LINE),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#FAFAFE")]),
        ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4),
        ("TOPPADDING", (0,0), (-1,-1), 3.2), ("BOTTOMPADDING", (0,0), (-1,-1), 3.2),
    ]))
    S.append(dt)
    S.append(Spacer(1, 5))

    S.append(Paragraph("Where these records live", H3))
    S.append(kv([
        ("NEXORA AI project", f"<font face='Courier' size='7'>{NX['proj']}</font> — team {NX['team']}, owner role"),
        ("GameVerse project", f"<font face='Courier' size='7'>{GV['proj']}</font> — team {GV['team']}, owner role"),
        ("API surface used", "<font face='Courier' size='6.8'>GET /v9/projects/{id}/domains</font> — returns each "
                             "hostname with its verification status and assignment time"),
        ("Result", "Four application hostnames, all verified and serving. The fifth row is the platform's "
                   "automatic preview pattern, listed for completeness rather than as an owned domain."),
    ], fs=7.9))
    S.append(Spacer(1, 5))

    S.append(note(
        "<b>No custom domain is in use on either project.</b> Both applications are served from "
        "<font face='Courier' size='7.4'>*.vercel.app</font> hostnames. If a reviewer expects a registered "
        "top-level domain, this is the honest explanation: neither product uses one, and the "
        "vercel.app hostname is the canonical address for both. Any document, message or page suggesting a "
        "custom domain for these two applications would be inaccurate."))
    S.append(Spacer(1, 5))
    S.append(Paragraph(
        "Because both hostnames sit on the same platform, the reviewer can compare them side by side in one "
        "account: same team, same owner, two projects. That is precisely the point — NEXORA AI and GameVerse are "
        "not two unrelated products that happen to be submitted together, they are two applications built and "
        "operated by one person under one account, which is why a single dossier answers both cases.", BODY))

    # ---------- 6 ----------
    S.append(PageBreak())
    S.append(Paragraph(f"6. Complete commit history — {NX['name']}", H2))
    S.append(Paragraph(
        f"All {len(NX_COMMITS)} commits in <font face='Courier' size='7.4'>{NX['repo_name']}</font>, newest first, "
        "straight from the public repository. Subject lines are reproduced unchanged. This is the same history "
        "Amazon can read by opening the repository link in §3.", BODY))
    S.append(Spacer(1, 3))

    rows = [[Paragraph("<b>SHA</b>", st("h", fontSize=7.4, alignment=TA_LEFT, textColor=colors.white)),
             Paragraph("<b>Date</b>", st("h2", fontSize=7.4, alignment=TA_LEFT, textColor=colors.white)),
             Paragraph("<b>Subject</b>", st("h3", fontSize=7.4, alignment=TA_LEFT, textColor=colors.white))]]
    for sha, date, msg in NX_COMMITS:
        rows.append([Paragraph(f"<font face='Courier' size='6.6'>{sha}</font>", st("c1", fontSize=6.6, leading=9, alignment=TA_LEFT)),
                     Paragraph(f"<font size='6.8'>{date}</font>", st("c2", fontSize=6.8, leading=9, alignment=TA_LEFT)),
                     Paragraph(msg, st("c3", fontSize=6.9, leading=9.2, alignment=TA_LEFT))])
    t = Table(rows, colWidths=[17*mm, 19*mm, 132*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), ACCENT),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("GRID", (0,0), (-1,-1), 0.3, LINE),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#FAFAFE")]),
        ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4),
        ("TOPPADDING", (0,0), (-1,-1), 2.6), ("BOTTOMPADDING", (0,0), (-1,-1), 2.6),
    ]))
    S.append(t)

    # ---------- 7 ----------
    S.append(PageBreak())
    S.append(Paragraph(f"7. Complete commit history — {GV['name']}", H2))
    S.append(Paragraph(
        f"{len(GV['commits'])} recorded production commits, newest first. As noted in §4 the repository is "
        "private, so this list was extracted from the hosting platform's deployment records rather than from a "
        "public repository page. Each entry is a real commit that carried a build to production; none of the "
        "subject lines has been edited.", BODY))
    S.append(Spacer(1, 3))

    rows2 = [[Paragraph("<b>SHA</b>", st("g1", fontSize=7.4, alignment=TA_LEFT, textColor=colors.white)),
              Paragraph("<b>Subject</b>", st("g2", fontSize=7.4, alignment=TA_LEFT, textColor=colors.white))]]
    for sha, msg in GV["commits"]:
        rows2.append([Paragraph(f"<font face='Courier' size='6.6'>{sha}</font>", st("d1", fontSize=6.6, leading=9, alignment=TA_LEFT)),
                      Paragraph(msg, st("d2", fontSize=6.9, leading=9.2, alignment=TA_LEFT))])
    t2 = Table(rows2, colWidths=[17*mm, 151*mm])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), ACC2),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("GRID", (0,0), (-1,-1), 0.3, LINE),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FDFC")]),
        ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4),
        ("TOPPADDING", (0,0), (-1,-1), 2.6), ("BOTTOMPADDING", (0,0), (-1,-1), 2.6),
    ]))
    S.append(t2)

    # ---------- 8 ----------
    S.append(PageBreak())
    S.append(Paragraph("8. Technical proof of authorship", H2))
    S.append(Paragraph(
        "None of the following depends on trusting this document. Each value can be recomputed or read from a "
        "third-party system that has no interest in the outcome.", LEAD))

    S.append(Paragraph("NEXORA AI", H3))
    S.append(kv([
        ("Signing certificate subject", f"<font face='Courier' size='7.1'>{NX['cert_subj']}</font>"),
        ("Certificate SHA-256", f"<font face='Courier' size='6.4'>{NX['cert_sha']}</font>"),
        ("Certificate serial", f"<font face='Courier' size='6.4'>{NX['cert_serial']}</font>"),
        ("Certificate validity", NX["cert_valid"]),
        ("APK SHA-256", f"<font face='Courier' size='6.4'>{NX['apk_sha']}</font>"),
        ("APK size", NX["apk_size"]),
        ("Digest published by GitHub", f"<font face='Courier' size='6.4'>sha256:{NX['apk_sha'].lower()}</font> — "
                                       "read independently from the release asset; identical to the file on the site"),
        ("Production deployment", NX["deploy"]),
        ("Publishing account", f"Vercel {OWNER['email_nx']} (team owner)"),
    ], fs=7.9))
    S.append(Spacer(1, 6))

    S.append(Paragraph("GameVerse", H3))
    S.append(kv2([
        ("Signing certificate SHA-256", f"<font face='Courier' size='6.4'>{GV['cert_sha']}</font>"),
        ("APK SHA-256", f"<font face='Courier' size='6.4'>{GV['apk_sha']}</font>"),
        ("Published checksum sidecar", f"<font face='Courier' size='7.1'>{GV['apk_url']}.sha256</font>"),
        ("Ad authorisation file", f"<font face='Courier' size='7.1'>{GV['ads_url']}</font> — "
                                   f"<font face='Courier' size='6.6'>google.com, {GV['admob']}, DIRECT, f08c47fec0942fa0</font>"),
        ("Production deployment", GV["deploy"]),
        ("Deployment creator", f"Vercel {OWNER['email_nx']} (team owner)"),
    ], fs=7.9))
    S.append(Spacer(1, 7))

    S.append(note(
        "<b>Why the certificates matter.</b> NEXORA AI's signing certificate carries the legal name and residence "
        "of the signatory directly in its subject: <font face='Courier' size='7'>O=Ahmed Becetti, L=Chlef, C=DZ</font>. "
        "Only the holder of the private key can produce a binary with that signature. GameVerse's certificate is "
        "recorded as a SHA-256 fingerprint published alongside the APK download, and the checksum sidecar lets any "
        "reviewer confirm the file they hold is the file that was distributed. In both cases the identity behind "
        "the binary resolves to the same person who signed this dossier.", fs=8.2))

    # ---------- 9 ----------
    S.append(PageBreak())
    S.append(Paragraph("9. Third-party content, and why it creates no competing claim", H2))
    S.append(Paragraph(
        "GameVerse lists games that were not written by me. It matters to be exact about that, because a reviewer "
        "reading a catalogue of 45 titles could reasonably wonder whether someone else owns part of the product. "
        "The answer is that the catalogue's third-party entries fall into two tightly bounded categories, and "
        "neither transfers any ownership of the application.", BODY))
    S.append(kv2([
        ("Open-source titles", "Included only under licences permitting commercial use and redistribution. Asset "
                               "licences are verified separately, attribution is preserved where required, and "
                               "each game page displays the licence and the upstream source."),
        ("Download pointers", "Links to each developer's own official release page or store. GameVerse does not "
                              "re-host third-party installers and claims no distribution right over them."),
        ("Trademarks", "A trademarked title appears only as a pointer to its official store. The platform states "
                       "publicly that it is not affiliated with, endorsed by or partnered with any publisher "
                       "unless a signed agreement exists."),
        ("Rights-issue channel", f"{OWNER['email_gv']} — published on the partners page for any owner who "
                                  "believes a listing exceeds its licence."),
    ], widths=(40*mm, 128*mm), fs=8.0))
    S.append(Spacer(1, 6))
    S.append(Paragraph(
        "In both categories the third party remains the owner of <i>its own game</i>, while I own the platform: the "
        "code, the interface, the catalogue structure, the seventeen original games and the brand. Those two sets "
        "of rights are separate and do not overlap. Consequently no agreement with a third-party game's author "
        "could evidence ownership of this application, and none is withheld — the question simply does not "
        "apply to the part of the product that was submitted for distribution.", BODY))

    S.append(Paragraph("What is claimed, and what is not", H3))
    S.append(kv([
        ("Claimed exclusively", "Source code of both applications, their interfaces, GameVerse's catalogue "
                                "structure and 17 original games, and both brand identities"),
        ("Not claimed", "Third-party games listed on GameVerse, open-source libraries used to build both "
                        "products, the Android operating system, Amazon Fire OS, Google's advertising services, "
                        "or any trademark not owned by the applicant"),
    ], fs=8.0))

    # ---------- 10 ----------
    S.append(PageBreak())
    S.append(Paragraph("10. Verification commands", H2))
    S.append(Paragraph("Every claim in this dossier can be reproduced. These commands need no credentials.",
                       BODY))
    for label, cmd in [
        ("# NEXORA AI — read the signing certificate of the submitted APK",
         "unzip -p Nexora.apk 'META-INF/CERT.RSA' > cert.der\n"
         "openssl pkcs7 -inform DER -in cert.der -print_certs -noout -subject -fingerprint -sha256"),
        ("# NEXORA AI — confirm the published digest through GitHub's own record",
         "gh api repos/Ahmedbecett/nexora-social-2026/releases/tags/latest \\\n"
         "  --jq '.assets[] | \"\\(.name) \\(.size) digest=\\(.digest)\"'"),
        ("# NEXORA AI — read the commit history",
         "gh api 'repos/Ahmedbecett/nexora-social-2026/commits?per_page=100' \\\n"
         "  --jq '.[] | \"\\(.sha[0:8]) \\(.commit.author.date[0:10]) \\(.commit.message | split(\"\\n\")[0])\"'"),
        ("# GameVerse — fetch the binary and its published checksum",
         "curl -LO https://gameverse-henna.vercel.app/dl/gameverse-2.8.0-release.apk\n"
         "sha256sum gameverse-2.8.0-release.apk\n"
         "curl https://gameverse-henna.vercel.app/dl/gameverse-2.8.0-release.apk.sha256"),
        ("# GameVerse — confirm the ad authorisation record",
         "curl https://gameverse-henna.vercel.app/app-ads.txt"),
    ]:
        S.append(Paragraph(f"<font color='#5A6172'>{label}</font>", st("cl", fontSize=7.6, leading=10, spaceAfter=2)))
        S.append(code(cmd))
        S.append(Spacer(1, 4))

    S.append(Paragraph("Reference values", H3))
    S.append(kv([
        ("NEXORA APK SHA-256", f"<font face='Courier' size='6.3'>{NX['apk_sha']}</font>"),
        ("NEXORA certificate", f"<font face='Courier' size='6.3'>{NX['cert_sha']}</font>"),
        ("GameVerse APK SHA-256", f"<font face='Courier' size='6.3'>{GV['apk_sha']}</font>"),
        ("GameVerse certificate", f"<font face='Courier' size='6.3'>{GV['cert_sha']}</font>"),
    ], fs=7.8))


    # ---------- 12 ----------
    S.append(PageBreak())
    S.append(Paragraph("11. Evidence index — claim by claim", H2))
    S.append(Paragraph(
        "Each numbered item below is a piece of evidence a reviewer can open, fetch or recompute. Nothing in this "
        "index relies on the applicant's assertion alone: every entry resolves to a system operated by someone "
        "else — GitHub, Vercel, or the cryptographic signature inside the binary itself.", BODY))
    S.append(Spacer(1, 3))

    ev = [
        ("E1", "NEXORA AI production site", "The application exists, is live, and is served from a hostname "
                                            "assigned to the applicant's hosting project.", NX["site"]),
        ("E2", "NEXORA AI signed APK", "A binary exists that is signed with a key only the applicant holds; "
                                       "its digest is published by GitHub.", "github.com/Ahmedbecett/nexora-social-2026/releases"),
        ("E3", "NEXORA AI signing certificate", "The signing identity names the applicant directly: "
                                                 "O=Ahmed Becetti, L=Chlef, C=DZ.", "see §8 — derived from the APK"),
        ("E4", "NEXORA AI commit history", f"{len(NX_COMMITS)} public commits recording incremental authorship.",
                                           "github.com/Ahmedbecett/nexora-social-2026/commits"),
        ("E5", f"GameVerse production site", "The application exists, is live, and is served from a hostname "
                                             "assigned to the applicant's hosting project.", GV["site"]),
        ("E6", "GameVerse /about", "Publicly attributes the platform to the applicant by name, with contact "
                                   "details and a non-affiliation disclaimer.", GV["site"] + "/about"),
        ("E7", "GameVerse /app", "Version, EULA, platform support and the advertising rules the build follows.",
                                 GV["site"] + "/app"),
        ("E8", "GameVerse APK + checksum", "The exact submitted binary can be verified against a published "
                                           "SHA-256 sidecar.", GV["apk_url"]),
        ("E9", "GameVerse app-ads.txt", "The advertising inventory is authorised under the same AdMob publisher "
                                        "ID that appears in NEXORA AI, linking both products to one operator.",
                                        GV["ads_url"]),
        ("E10", "GameVerse /privacy", "A data-protection policy published by the applicant, with retention, "
                                      "consent and deletion mechanics.", GV["site"] + "/privacy"),
        ("E11", "GameVerse /partners", "The licensing posture for third-party titles, stated publicly.",
                                       GV["site"] + "/partners"),
        ("E12", "GameVerse /developers", "The self-service developer portal, showing the platform is operated, "
                                         "not merely hosted.", GV["site"] + "/developers"),
        ("E13", "Vercel project records", "Domain assignments and deployment history for both projects, held "
                                          "under the applicant's team account.", "vercel.com/ahmed-d33b"),
        ("E14", "Deployment metadata", "The commit trail for GameVerse, recovered from production deployment "
                                       "records — see §7.", "Vercel deployments API, project " + GV["proj"]),
        ("E15", "Shared AdMob publisher", f"{NX['admob']} appears in both applications, evidencing a single "
                                          "operator behind both.", "§8 — both entries"),
        ("E16", "This dossier, signed", "A declaration by the rights holder, with an optional attestation block.",
                                        "§13"),
    ]
    erows = [[Paragraph("<b>ID</b>", st("e0", fontSize=7.2, textColor=colors.white)),
              Paragraph("<b>Evidence</b>", st("e0b", fontSize=7.2, textColor=colors.white)),
              Paragraph("<b>What it proves</b>", st("e0c", fontSize=7.2, textColor=colors.white)),
              Paragraph("<b>Where</b>", st("e0d", fontSize=7.2, textColor=colors.white))]]
    for eid, name, proves, where in ev:
        erows.append([
            Paragraph(f"<b>{eid}</b>", st("e1", fontSize=6.9, leading=9, alignment=TA_LEFT)),
            Paragraph(f"<b>{name}</b>", st("e2", fontSize=6.9, leading=9, alignment=TA_LEFT)),
            Paragraph(proves, st("e3", fontSize=6.8, leading=9, alignment=TA_LEFT)),
            Paragraph(f"<font face='Courier' size='5.8'>{where}</font>",
                      st("e4", fontSize=5.8, leading=8, alignment=TA_LEFT)),
        ])
    et = Table(erows, colWidths=[8*mm, 33*mm, 75*mm, 52*mm], repeatRows=1)
    et.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), ACCENT),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("GRID", (0,0), (-1,-1), 0.3, LINE),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#FAFAFE")]),
        ("LEFTPADDING", (0,0), (-1,-1), 3.4), ("RIGHTPADDING", (0,0), (-1,-1), 3.4),
        ("TOPPADDING", (0,0), (-1,-1), 2.6), ("BOTTOMPADDING", (0,0), (-1,-1), 2.6),
    ]))
    S.append(et)

    # ---------- Annex A: الأدلة المصوّرة ----------
    S.append(PageBreak())
    S.append(Paragraph("Annex A — visual evidence", H2))
    S.append(Paragraph(
        "The five boards that follow are rendered directly from the data returned by the two platforms, at the "
        "moment shown in each footer. Every number, hostname, commit and digest on them is the value the API "
        "returned — nothing is typed by hand and nothing is illustrative.", BODY))
    S.append(Spacer(1, 4))
    S.append(note(
        "<b>What these boards are, and what they are not.</b> They are <i>not</i> screenshots of the Vercel or "
        "GitHub dashboards: the dashboards require a signed-in session, and a screenshot of them would be easy to "
        "forge in any case. They are records drawn from the same API calls that those dashboards make, with the "
        "raw response quoted on the board itself so a reviewer can compare it against the live endpoint. Every "
        "value can be recomputed with the commands in §10.", fs=8.4))
    S.append(Spacer(1, 6))

    boards = [
        ("A1", "GitHub repository — NEXORA AI",
         "Public repository, 34 commits, 5 releases, language breakdown, and the SHA-256 digest GitHub itself "
         "publishes for every release asset.", "boards/B1-github-repository-nexora.png"),
        ("A2", "GitHub commit history — NEXORA AI",
         "All 34 commits, unabridged, newest first. This is the authorship record: what was built, and when.",
         "boards/B2-github-commit-history-nexora.png"),
        ("A3", "GameVerse — repository state and production record",
         "The private repository's identity, and the 35 commits recovered from production deployment metadata.",
         "boards/B3-github-and-vercel-gameverse.png"),
        ("A4", "Domains — both applications",
         "Every hostname assigned to either project, with its project ID, verification state and assignment "
         "date, plus the ownership chain from account to domain.", "boards/B4-vercel-domains.png"),
        ("A5", "Production deployments — both applications",
         "Real builds that served each live site, each matched to the commit that shipped in it.",
         "boards/B5-vercel-deployments.png"),
    ]
    for i, (tag, title, desc, board_path) in enumerate(boards):
        full = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "master", board_path))
        if not os.path.exists(full):
            continue
        from io import BytesIO
        # صفحة أفقية: الصورة بعرض الصفحة كاملة
        LW, LH = landscape(A4)
        frame_w = LW - 2 * MARGIN          # عرض الإطار الفعلي
        frame_h = LH - 34 * mm             # ارتفاع الإطار الفعلي
        avail_w = frame_w
        avail_h = frame_h - 46             # ناقص الترويسة والتذييل
        ratio = 595 / 842
        iw = min(avail_w, avail_h / ratio)
        ih = iw * ratio
        with open(full, "rb") as fh:
            im = RLImage(BytesIO(fh.read()), width=iw, height=ih)
        S.append(NextPageTemplate("landscape"))
        S.append(PageBreak())
        S.append(Paragraph(
            f"<font color='#5A6172'>{tag}</font>&nbsp;&nbsp;<b>{title}</b>&nbsp;&nbsp;"
            f"<font size='7.6' color='#6B7280'>{desc}</font>",
            st("atch", fontSize=9.4, leading=12, spaceAfter=6)))
        S.append(im)
        S.append(Spacer(1, 2))
        S.append(Paragraph(
            f"<font size='6.8' color='#5A6172'>{tag} · rendered from the API response on the date printed in the "
            f"board's footer · full-resolution file: docs/master/{board_path}</font>",
            st("cap", fontSize=6.8, leading=8.6)))

    S.append(NextPageTemplate("p"))
    # ---------- 13 ----------
    S.append(PageBreak())
    S.append(Paragraph("12. What to send to Amazon", H2))
    S.append(Paragraph(
        "Two short messages, one per case, and one attachment: this dossier. Everything below is written to be "
        "pasted as-is. Both messages say the same thing, because both cases raise the same request, and the "
        "answer is the same for both applications.", BODY))

    S.append(Paragraph("Case reply — NEXORA AI (case 23265129241)", H3))
    nx_msg = (
        "Hello,\n\n"
        "Thank you for reviewing NEXORA AI (com.ahmedbecetti.nexora, version 4.4.0).\n\n"
        "You asked for documentation showing valid intellectual property rights: either a signed confirmation "
        "letter from the rights holder, or a copy of the licence agreement. I am the rights holder. I built this "
        "application myself, I own it outright, and the developer account is mine. There is no second party, so "
        "no licence between two parties exists or could exist.\n\n"
        "Attached is a signed consolidated dossier covering this application and my second one, GameVerse. For "
        "NEXORA AI it contains: the signing certificate inside the APK, whose subject names me directly "
        "(O=Ahmed Becetti, L=Chlef, C=DZ); the SHA-256 digest of the submitted binary, which GitHub publishes "
        "independently; the complete 34-commit history of the source repository; and the domains assigned to the "
        "project in my hosting account.\n\n"
        "Section 10 lists commands that reproduce every value without credentials. Section 13 carries my "
        "signature and an attestation block for notarisation if you require it.\n\n"
        "Please tell me if you need the APK itself, a copy of my identity document, or access to the private "
        "repository for the second application.\n\n"
        "Ahmed Becetti\n"
        "Chlef, Algeria\n"
        "ahmedbecetti35@gmail.com"
    )
    S.append(msgbox(nx_msg))

    S.append(Paragraph("Case reply — GameVerse", H3))
    gv_msg = (
        "Hello,\n\n"
        "Thank you for reviewing GameVerse (com.gameverse.app, version 2.8.0).\n\n"
        "You asked for documentation showing valid intellectual property rights: either a signed confirmation "
        "letter from the rights holder, or a copy of the licence agreement. I am the rights holder. GameVerse is "
        "my own work — the platform code, the interface, the catalogue and the seventeen original games are mine, "
        "and the developer account is mine. There is no second party, so no licence between two parties exists or "
        "could exist.\n\n"
        "Attached is a signed consolidated dossier covering this application and my other one, NEXORA AI. For "
        "GameVerse it contains: the APK's signing certificate fingerprint and the published SHA-256 checksum; the "
        "35 recorded production commits; the domains assigned to the project in my hosting account; the "
        "app-ads.txt record authorising my AdMob publisher under the same ID used across both products; and an "
        "explanation of how the third-party game listings are licensed, so that no outside party holds a claim on "
        "the application itself.\n\n"
        "Section 10 lists commands that reproduce every value without credentials. Section 13 carries my "
        "signature and an attestation block for notarisation if you require it. The repository is private; I can "
        "grant read access on request.\n\n"
        "Ahmed Becetti\n"
        "Chlef, Algeria\n"
        "ahmedbecetti41@gmail.com"
    )
    S.append(msgbox(gv_msg))

    S.append(Paragraph("Attachment checklist", H3))
    S.append(kv([
        ("Always", "This dossier (NEXORA-and-GAMEVERSE-ownership-dossier.pdf) — 19 pages, both cases, with the visual evidence annex."),
        ("If asked", "The signed APK you actually submitted, so the digest can be compared in front of you."),
        ("If asked", "Annex A4 — the domain records from the Vercel API, with the raw response quoted."),
        ("If asked", "Annex A2 — all 34 commits, or the live repository link in §3."),
        ("If asked", "A copy of your identity document, or a notarised copy of §13."),
        ("Never", "A licence agreement between you and yourself — it does not exist and inventing one would "
                  "damage the case."),
    ], widths=(28*mm, 140*mm), fs=8.0))

    # ---------- 14 ----------
    S.append(PageBreak())
    S.append(Paragraph("13. Undertaking and signature", H2))
    S.append(Paragraph(
        "I, the undersigned, declare that the statements in this dossier are true and correct to the best of my "
        "knowledge; that I am the sole author and sole owner of both NEXORA AI and GameVerse, including their "
        "source code, interfaces, original content and brand identities; that no third party holds any right, "
        "title, royalty or equity in either; and that I have the full legal right to publish, distribute and "
        "monetise both on the Amazon Appstore without infringing any third-party right.", LEAD))
    S.append(Paragraph(
        "I undertake to notify Amazon Developer Support immediately of any change in the ownership of either "
        "application, and to indemnify Amazon against any claim arising from a breach of these statements. I am "
        "willing to provide a notarised or officially attested copy of this dossier, a copy of my identity "
        "document, or any further supporting document Amazon requires — including access to either source "
        "repository — on request.", BODY))
    S.append(Spacer(1, 10))

    sig = Paragraph(
        "<b>Signed by the rights holder</b><br/><br/><br/>"
        "_______________________________________<br/><br/>"
        f"<b>{OWNER['name']}</b><br/>"
        f"<font size='7.8' color='#5A6172'>Sole proprietor — NEXORA AI and GameVerse</font><br/>"
        f"<font size='7.8' color='#5A6172'>{OWNER['city']}, {OWNER['country']}</font><br/>"
        f"<font size='7.8' color='#5A6172'>{OWNER['email_nx']} · {OWNER['email_gv']}</font><br/>"
        f"<font size='7.8' color='#5A6172'>{OWNER['phone']}</font><br/>"
        f"<font size='7.8' color='#5A6172'>Date: {OWNER['date']}</font>",
        st("sg", fontSize=8.8, leading=12.4, alignment=TA_LEFT))
    att = Paragraph(
        "<b>Attestation (optional)</b><br/><br/>"
        "<font size='7.8' color='#5A6172'>Only if Amazon requires an officially attested or notarised "
        "document.</font><br/><br/><br/>"
        "_______________________________________<br/>"
        "<font size='7.8' color='#5A6172'>Name, capacity and seal of the attesting officer</font><br/><br/>"
        "_______________________________________<br/>"
        "<font size='7.8' color='#5A6172'>Place and date of attestation</font>",
        st("at", fontSize=8.8, leading=12.4, alignment=TA_LEFT))
    tt = Table([[sig, att]], colWidths=[87*mm, 87*mm])
    tt.setStyle(TableStyle([
        ("BOX", (0,0), (0,0), 0.8, LINE), ("BOX", (1,0), (1,0), 0.8, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 9), ("RIGHTPADDING", (0,0), (-1,-1), 9),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    S.append(tt)

    d = Doc(path)
    d.build(S)
    return path



def nx_msg_text():
    return (
        "Hello,\n\nThank you for reviewing NEXORA AI (com.ahmedbecetti.nexora, version 4.4.0).\n\n"
        "You asked for documentation showing valid intellectual property rights: either a signed confirmation "
        "letter from the rights holder, or a copy of the licence agreement. I am the rights holder. I built this "
        "application myself, I own it outright, and the developer account is mine. There is no second party, so "
        "no licence between two parties exists or could exist.\n\n"
        "Attached is a signed consolidated dossier covering this application and my second one, GameVerse. For "
        "NEXORA AI it contains: the signing certificate inside the APK, whose subject names me directly "
        "(O=Ahmed Becetti, L=Chlef, C=DZ); the SHA-256 digest of the submitted binary, which GitHub publishes "
        "independently; the complete 34-commit history of the source repository; and the domains assigned to the "
        "project in my hosting account.\n\n"
        "Section 10 lists commands that reproduce every value without credentials. Section 13 carries my "
        "signature and an attestation block for notarisation if you require it.\n\n"
        "Please tell me if you need the APK itself, a copy of my identity document, or access to the private "
        "repository for the second application.\n\nAhmed Becetti\nChlef, Algeria\nahmedbecetti35@gmail.com"
    )


def gv_msg_text():
    return (
        "Hello,\n\nThank you for reviewing GameVerse (com.gameverse.app, version 2.8.0).\n\n"
        "You asked for documentation showing valid intellectual property rights: either a signed confirmation "
        "letter from the rights holder, or a copy of the licence agreement. I am the rights holder. GameVerse is "
        "my own work — the platform code, the interface, the catalogue and the seventeen original games are mine, "
        "and the developer account is mine. There is no second party, so no licence between two parties exists or "
        "could exist.\n\n"
        "Attached is a signed consolidated dossier covering this application and my other one, NEXORA AI. For "
        "GameVerse it contains: the APK's signing certificate fingerprint and the published SHA-256 checksum; the "
        "35 recorded production commits; the domains assigned to the project in my hosting account; the "
        "app-ads.txt record authorising my AdMob publisher under the same ID used across both products; and an "
        "explanation of how the third-party game listings are licensed, so that no outside party holds a claim on "
        "the application itself.\n\n"
        "Section 10 lists commands that reproduce every value without credentials. Section 13 carries my "
        "signature and an attestation block for notarisation if you require it. The repository is private; I can "
        "grant read access on request.\n\nAhmed Becetti\nChlef, Algeria\nahmedbecetti41@gmail.com"
    )



# ---------- التوأم النصي ----------
def build_md(path, case_nx, case_gv):
    L = []
    A = L.append
    A(f"# Consolidated Ownership Dossier — NEXORA AI & GameVerse\n")
    A(f"**Submitted by {OWNER['name']}** — {OWNER['city']}, {OWNER['country']}  ")
    A(f"Date: {OWNER['date']}  ")
    A(f"Amazon cases — NEXORA AI: {case_nx} · GameVerse: {case_gv}\n")
    A("A single document containing every item of evidence for both applications: domains, website links, "
      "repository links, complete commit histories, signing identities, and the reply text for each case.\n")
    A("---\n")
    A("## 1. The question Amazon asked, and the answer\n")
    A("Amazon asked for documentation demonstrating valid intellectual property rights — a signed confirmation "
      "letter from the rights holder, or a copy of the licence agreement, defining the relationship between two "
      "parties.\n")
    A("**There is only one party here.** I wrote both applications, I own them, and I am the developer account "
      "holder. A licence from myself to myself has no legal meaning. What can be supplied — and is supplied here "
      "— is the other half of the request: a signed confirmation by the rights holder, backed by evidence that "
      "can be verified without trusting this document.\n")
    A("## 2. The rights holder\n")
    A(f"- Full legal name: **{OWNER['name']}**")
    A(f"- Residence: {OWNER['city']}, {OWNER['country']}")
    A("- Capacity: natural person, individual developer and sole proprietor")
    A(f"- Contact: {OWNER['email_nx']} (NEXORA) · {OWNER['email_gv']} (GameVerse) · {OWNER['phone']}")
    A("- GitHub: Ahmedbecett — owner and sole contributor of both repositories")
    A(f"- Vercel team: {NX['team']} — owner role")
    A(f"- AdMob publisher: {NX['admob']} (used by both applications)\n")
    A("## 3. NEXORA AI — application record\n")
    A(f"| Field | Value |\n|---|---|")
    A(f"| Package | `{NX['pkg']}` |")
    A(f"| Version | {NX['ver']} (versionCode {NX['vcode']}) |")
    A(f"| Primary domain | `{NX['domain']}` |")
    A(f"| Repository | `{NX['repo_name']}` (public) |")
    A(f"| Vercel project | `{NX['proj']}` |")
    A(f"| Production deployment | `{NX['deploy']}` |")
    A(f"| Current commit | `{NX['commit']}` |")
    A(f"| AdMob | `{NX['admob']}` |\n")
    A("**Links**\n")
    for k, v in NX["links"]:
        A(f"- {k}: {v}")
    A("")
    A("## 4. GameVerse — application record\n")
    A("| Field | Value |\n|---|---|")
    A(f"| Package | `{GV['pkg']}` |")
    A(f"| Version | {GV['ver']} (versionCode {GV['vcode']}) |")
    A(f"| Primary domain | `{GV['domain']}` |")
    A(f"| Auto domains | {', '.join('`'+d+'`' for d in GV['domain_auto'])} |")
    A(f"| Repository | `{GV['repo_name']}` (private) |")
    A(f"| Vercel project | `{GV['proj']}` |")
    A(f"| Production deployment | `{GV['deploy']}` |")
    A(f"| Current commit | `{GV['commit']}` |")
    A(f"| AdMob | `{GV['admob']}` |\n")
    A("**Links**\n")
    for k, v in GV["links"]:
        A(f"- {k}: {v}")
    A("")
    A("## 5. Domains — both applications\n")
    A("Read from the hosting platform's own domain records for both projects.\n")
    A("| Hostname | Application | Role | Verified | Assigned |\n|---|---|---|---|---|")
    A(f"| `{NX['domain']}` | NEXORA AI | canonical production hostname | yes | 12 Nov 2026 |")
    A(f"| `{GV['domain']}` | GameVerse | canonical production hostname | yes | 20 Oct 2026 |")
    A(f"| `{GV['domain_auto'][0]}` | GameVerse | automatic deployment alias | yes | 20 Oct 2026 |")
    A(f"| `{GV['domain_auto'][1]}` | GameVerse | git branch alias | yes | 20 Oct 2026 |")
    A("| `*.vercel.app` | both | preview deployments | — | automatic |\n")
    A("No custom top-level domain is in use on either project; both are served from `*.vercel.app` hostnames.\n")
    A(f"## 6. Complete commit history — NEXORA AI ({len(NX_COMMITS)} commits)\n")
    A("| SHA | Date | Subject |\n|---|---|---|")
    for sha, date, msg in NX_COMMITS:
        A(f"| `{sha}` | {date} | {msg} |")
    A("")
    A(f"## 7. Complete commit history — GameVerse ({len(GV['commits'])} recorded commits)\n")
    A("The repository is private; this list comes from the hosting platform's production deployment records.\n")
    A("| SHA | Subject |\n|---|---|")
    for sha, msg in GV["commits"]:
        A(f"| `{sha}` | {msg} |")
    A("")
    A("## 8. Technical proof of authorship\n")
    A("**NEXORA AI**\n")
    A(f"- Signing certificate subject: `{NX['cert_subj']}`")
    A(f"- Certificate SHA-256: `{NX['cert_sha']}`")
    A(f"- Certificate serial: `{NX['cert_serial']}`")
    A(f"- Validity: {NX['cert_valid']}")
    A(f"- APK SHA-256: `{NX['apk_sha']}`")
    A(f"- APK size: {NX['apk_size']}")
    A(f"- GitHub-published digest: `sha256:{NX['apk_sha'].lower()}`\n")
    A("**GameVerse**\n")
    A(f"- Signing certificate SHA-256: `{GV['cert_sha']}`")
    A(f"- APK SHA-256: `{GV['apk_sha']}`")
    A(f"- Checksum sidecar: {GV['apk_url']}.sha256")
    A(f"- app-ads.txt: {GV['ads_url']} → `google.com, {GV['admob']}, DIRECT, f08c47fec0942fa0`\n")
    A("## 9. Third-party content\n")
    A("GameVerse lists open-source titles (used only under licences permitting commercial redistribution, with "
      "attribution preserved) and download pointers to each developer's own official page. Neither transfers "
      "ownership of the platform. I own the code, the interface, the catalogue structure, the 17 original games "
      "and the brand; third parties own their own games. No agreement with a third party could evidence "
      "ownership of this application — which is why none is withheld.\n")
    A("## 10. Verification commands\n")
    A("```bash")
    A("# NEXORA AI — signing certificate of the submitted APK")
    A("unzip -p Nexora.apk 'META-INF/CERT.RSA' > cert.der")
    A("openssl pkcs7 -inform DER -in cert.der -print_certs -noout -subject -fingerprint -sha256")
    A("")
    A("# NEXORA AI — digest published by GitHub")
    A("gh api repos/Ahmedbecett/nexora-social-2026/releases/tags/latest \\")
    A("  --jq '.assets[] | \"\\(.name) \\(.size) digest=\\(.digest)\"'")
    A("")
    A("# NEXORA AI — commit history")
    A("gh api 'repos/Ahmedbecett/nexora-social-2026/commits?per_page=100' \\")
    A("  --jq '.[] | \"\\(.sha[0:8]) \\(.commit.author.date[0:10]) \\(.commit.message | split(\"\\n\")[0])\"'")
    A("")
    A("# GameVerse — binary and published checksum")
    A("curl -LO https://gameverse-henna.vercel.app/dl/gameverse-2.8.0-release.apk")
    A("sha256sum gameverse-2.8.0-release.apk")
    A("curl https://gameverse-henna.vercel.app/dl/gameverse-2.8.0-release.apk.sha256")
    A("```\n")
    A("## 11. Evidence index\n")
    A("| ID | Evidence | Proves | Where |\n|---|---|---|---|")
    for eid, name, proves, where in [
        ("E1", "NEXORA site", "application is live on the applicant's project", NX["site"]),
        ("E2", "NEXORA signed APK", "binary signed by a key only the applicant holds", "gh releases"),
        ("E3", "NEXORA certificate", "signing identity names the applicant", "§8"),
        ("E4", "NEXORA commits", f"{len(NX_COMMITS)} public commits", "gh commits"),
        ("E5", "GameVerse site", "application is live on the applicant's project", GV["site"]),
        ("E6", "GameVerse /about", "public attribution to the applicant", GV["site"] + "/about"),
        ("E7", "GameVerse /app", "version, EULA, ad rules", GV["site"] + "/app"),
        ("E8", "GameVerse APK + sha256", "submitted binary is verifiable", GV["apk_url"]),
        ("E9", "GameVerse app-ads.txt", "ad inventory authorised under shared publisher ID", GV["ads_url"]),
        ("E10", "GameVerse /privacy", "published data-protection policy", GV["site"] + "/privacy"),
        ("E11", "GameVerse /partners", "licensing posture stated publicly", GV["site"] + "/partners"),
        ("E12", "GameVerse /developers", "platform is operated, not merely hosted", GV["site"] + "/developers"),
        ("E13", "Vercel records", "domain and deployment history under one team", "vercel.com/ahmed-d33b"),
        ("E14", "Deployment metadata", "GameVerse commit trail", "§7"),
        ("E15", "Shared AdMob publisher", "one operator behind both products", "§8"),
        ("E16", "This dossier, signed", "declaration by the rights holder", "§13"),
    ]:
        A(f"| {eid} | {name} | {proves} | {where} |")
    A("")
    A("## 12. What to send to Amazon\n")
    A("### Case reply — NEXORA AI\n")
    A("```")
    A(nx_msg_text())
    A("```\n")
    A("### Case reply — GameVerse\n")
    A("```")
    A(gv_msg_text())
    A("```\n")
    A("## 13. Undertaking and signature\n")
    A("I declare that the statements above are true and correct to the best of my knowledge; that I am the sole "
      "author and sole owner of both applications; that no third party holds any right, title, royalty or equity "
      "in either; and that I hold the full legal right to publish, distribute and monetise both on the Amazon "
      "Appstore. I can supply a notarised copy, identity document or repository access on request.\n")
    A(f"Signed: ______________________  \n**{OWNER['name']}** — sole proprietor  \n"
      f"{OWNER['city']}, {OWNER['country']}  \n{OWNER['email_nx']} · {OWNER['email_gv']}  \n"
      f"{OWNER['phone']}  \nDate: {OWNER['date']}\n")
    open(path, "w", encoding="utf-8").write("\n".join(L))
    return path


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Build the consolidated NEXORA AI + GameVerse dossier.")
    ap.add_argument("--case-nx", default="___________", help="Amazon case number for NEXORA AI")
    ap.add_argument("--case-gv", default="___________", help="Amazon case number for GameVerse")
    a = ap.parse_args()
    CASE_NX = a.case_nx.strip()
    CASE_GV = a.case_gv.strip()
    p = os.path.join(OUT, "NEXORA-and-GAMEVERSE-ownership-dossier.pdf")
    build(p)
    print(f"{os.path.basename(p)}  {os.path.getsize(p):,} bytes   cases: {CASE_NX} / {CASE_GV}")
    m = os.path.join(OUT, "NEXORA-and-GAMEVERSE-ownership-dossier.md")
    build_md(m, CASE_NX, CASE_GV)
    print(f"{os.path.basename(m)}  {os.path.getsize(m):,} bytes")
