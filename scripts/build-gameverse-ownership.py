#!/usr/bin/env python3
"""
وثائق إثبات ملكية GameVerse — للمراسلة مع Amazon Developer Support.

كل الحقائق هنا مأخوذة من مصادر حيّة قابلة للتحقق:
  · الموقع https://gameverse-henna.vercel.app  (about / app / privacy / partners / developers)
  · مشروع Vercel prj_7fJN5wSFW3IZmVy8FOK75hS0GuWb
  · المستودع الخاص Ahmedbecett/gameverse
  · ملف البصمة /dl/gameverse-2.8.0-release.apk.sha256
  · app-ads.txt الحيّ

المخرجات: docs/gameverse/*.pdf
"""
import os, sys, argparse
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, HRFlowable)

OUT = "docs/gameverse"
os.makedirs(OUT, exist_ok=True)

INK    = colors.HexColor("#0B0F1A")
MUTED  = colors.HexColor("#5A6172")
ACCENT = colors.HexColor("#7B2FF7")
ACC2   = colors.HexColor("#00C2A8")
LINE   = colors.HexColor("#D8DBE5")
SOFT   = colors.HexColor("#F3F0FF")
SOFT2  = colors.HexColor("#EAFBF8")

F = dict(
    owner    = "Ahmed Becetti",
    studio   = "GameVerse Studio",
    city     = "Chlef",
    country  = "Algeria",
    email    = "ahmedbecetti41@gmail.com",
    phone    = "+213 784 302 071",
    telegram = "https://t.me/GameVerseGames",
    app      = "GameVerse",
    package  = "com.gameverse.app",
    version  = "2.8.0",
    vcode    = "2800",
    site     = "https://gameverse-henna.vercel.app",
    site2    = "https://gameverse-ahmed-d33b.vercel.app",
    repo     = "Ahmedbecett/gameverse (private)",
    proj_id  = "prj_7fJN5wSFW3IZmVy8FOK75hS0GuWb",
    team     = "team_YCGVFOkWo0Kktd4rv4UYfwVa  (ahmed-d33b)",
    admob    = "pub-6858364141205978",
    apk_sha  = "6083DE941F114E89E06B10AED4569C8F45EE67FCD4DCFC8716898DA46901C82B",
    cert_sha = "C14535373C95B51A188E4F885FDC755CAD3212FB9AC1487DE2D6EEC5D48E0668",
    apk_url  = "https://gameverse-henna.vercel.app/dl/gameverse-2.8.0-release.apk",
    ads_url  = "https://gameverse-henna.vercel.app/app-ads.txt",
    dep_id   = "dpl_451ViE6CPqmc12hixYFDV9RhiUQc",
    dep_sha  = "30dc8fa40fc32df84bb40fd7d3539509718f48d2",
    date     = "12 November 2026",
    case     = "___________",   # يُملأ بـ --case أو بتحرير هذا السطر
)

def st(name, **kw):
    base = dict(fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK,
                alignment=TA_JUSTIFY)
    base.update(kw)
    return ParagraphStyle(name, **base)

BODY  = st("b", spaceAfter=6, fontSize=9.2, leading=13.2)
LEAD  = st("l", fontSize=9.8, leading=14.5, spaceAfter=8)
H1    = st("h1", fontName="Helvetica-Bold", fontSize=16.5, leading=20.5, alignment=TA_LEFT, spaceAfter=2)
H2    = st("h2", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=ACCENT,
           alignment=TA_LEFT, spaceAfter=4, spaceBefore=8)
SMALL = st("s", fontSize=8, leading=11, textColor=MUTED, alignment=TA_LEFT)
MONO  = st("m", fontName="Courier", fontSize=7.4, leading=10.5, alignment=TA_LEFT)

MARGIN   = 20 * mm
HEADER_H = 25 * mm

class Doc(BaseDocTemplate):
    def __init__(self, path, **kw):
        super().__init__(path, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                         topMargin=HEADER_H + 6*mm, bottomMargin=18*mm,
                         title="GameVerse — Declaration of Ownership",
                         author=F["owner"], **kw)
        self.doc_title = "DECLARATION OF OWNERSHIP"
        fr = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="f")
        self.addPageTemplates([PageTemplate(id="p", frames=[fr], onPage=self.deco)])

    def deco(self, c, doc):
        w, h = A4
        c.setFillColor(ACCENT); c.rect(0, h - 4*mm, w/2, 4*mm, stroke=0, fill=1)
        c.setFillColor(ACC2);   c.rect(w/2, h - 4*mm, w/2, 4*mm, stroke=0, fill=1)

        x = MARGIN
        c.setFillColor(ACCENT)
        c.roundRect(x, h - 21.5*mm, 13*mm, 13*mm, 3*mm, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(x + 6.5*mm, h - 17.5*mm, "GV")

        x += 17*mm
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 13.5)
        c.drawString(x, h - 13*mm, "GAMEVERSE")
        c.setFillColor(MUTED); c.setFont("Helvetica", 7.5)
        c.drawString(x, h - 17.2*mm, "Gaming platform  ·  Android / Fire OS / Fire TV")
        c.drawString(x, h - 20.8*mm, "Sole proprietor: Ahmed Becetti  ·  Chlef, Algeria")

        c.setFillColor(INK); c.setFont("Helvetica-Bold", 7.8)
        c.drawRightString(w - MARGIN, h - 13*mm, doc.doc_title)
        c.setFillColor(MUTED); c.setFont("Helvetica", 7.2)
        c.drawRightString(w - MARGIN, h - 17.2*mm, f"Date: {F['date']}")
        c.drawRightString(w - MARGIN, h - 20.8*mm, f"Amazon case: {F['case']}")

        c.setStrokeColor(LINE); c.setLineWidth(0.7)
        c.line(MARGIN, h - HEADER_H, w - MARGIN, h - HEADER_H)
        c.line(MARGIN, 14*mm, w - MARGIN, 14*mm)
        c.setFillColor(MUTED); c.setFont("Helvetica", 6.8)
        c.drawString(MARGIN, 10*mm, "GameVerse — Declaration of Ownership  ·  Ahmed Becetti  ·  Chlef, Algeria  ·  " + F["email"])
        c.drawRightString(w - MARGIN, 10*mm, f"Page {doc.page}")

def kv(rows, widths=(50*mm, 120*mm), key_style=None):
    data = [[Paragraph(f"<b>{k}</b>", st("k", fontSize=8.3, leading=11.6, alignment=TA_LEFT)),
             Paragraph(v, st("v", fontSize=8.3, leading=11.6, alignment=TA_LEFT))] for k, v in rows]
    t = Table(data, colWidths=list(widths))
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BACKGROUND", (0,0), (0,-1), SOFT),
        ("GRID", (0,0), (-1,-1), 0.4, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 3.8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3.8),
    ]))
    return t

def note(text, bg=SOFT, bar=ACCENT):
    t = Table([[Paragraph(text, st("n", fontSize=8.6, leading=12.8))]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("LINEBEFORE", (0,0), (0,-1), 2.4, bar),
        ("LEFTPADDING", (0,0), (-1,-1), 9), ("RIGHTPADDING", (0,0), (-1,-1), 9),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    return t

def code(text, w=170*mm):
    t = Table([[Paragraph(text.replace("&","&amp;").replace("<","&lt;"), MONO)]], colWidths=[w])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F7F8FB")),
        ("BOX", (0,0), (-1,-1), 0.4, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 8), ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    return t

# =====================================================================
def build_declaration(path):
    S = []
    S.append(Paragraph("Declaration of Intellectual Property Ownership", H1))
    S.append(Paragraph("GameVerse — gaming platform and Android application for Android, Fire OS and Fire TV",
                       st("sub", fontSize=9, textColor=MUTED, spaceAfter=10)))

    S.append(Paragraph(f"To: <b>Amazon Developer Support</b> — Case {F['case']}", BODY))
    S.append(Paragraph("Re: documentation evidencing valid intellectual property rights in the application "
                       "and the related game platform submitted under the developer account of "
                       f"<b>{F['owner']}</b>.", BODY))

    S.append(Paragraph("1. Declaration", H2))
    S.append(Paragraph(
        f"I, <b>{F['owner']}</b>, a natural person resident in {F['city']}, {F['country']}, declare in my own "
        f"name and on my own responsibility that I am the <b>sole author and sole rights holder</b> of:",
        LEAD))
    S.append(kv([
        ("The application", f"{F['app']} — Android / Fire OS / Fire TV, version {F['version']} "
                            f"(versionCode {F['vcode']})"),
        ("The platform", "The GameVerse website and its backend: catalogue, store, player accounts, "
                         "leaderboards, developer portal and administration"),
        ("The original games", "The 17 in-house titles published under the GameVerse Originals label, "
                               "including their code, art and audio"),
        ("The brand", "The GameVerse name, logo and visual identity"),
    ]))
    S.append(Spacer(1, 6))
    S.append(Paragraph(
        "Every element above was conceived, written, designed and built by me personally. No employer, "
        "company, contractor, co-founder or other third party holds any right, title, royalty or equity in "
        "the application, the platform or the original games. Consequently there is <b>no separate licensor "
        "from whom a licence agreement could be obtained: I am the rights holder myself</b>, which is why "
        "this declaration is issued by the rights holder directly.", BODY))
    S.append(Paragraph(
        "I confirm that I hold the full legal right to publish, distribute and monetise this application on "
        "the Amazon Appstore, and that doing so infringes no third-party right. Third-party material appears "
        "in the platform only in the two clearly bounded forms described in section 6.", BODY))

    S.append(Paragraph("2. Identification of the rights holder", H2))
    S.append(kv([
        ("Full legal name", F["owner"]),
        ("Trading name", f"{F['studio']} (unregistered sole-proprietor trade name, not a separate legal entity)"),
        ("Capacity", "Natural person — individual developer and sole proprietor"),
        ("Address", f"{F['city']}, {F['country']}"),
        ("Contact e-mail", F["email"]),
        ("Telephone / WhatsApp", F["phone"]),
        ("Telegram channel", F["telegram"]),
        ("Vercel account", F["team"]),
        ("GitHub account", "Ahmedbecett — sole owner and sole contributor"),
    ]))

    S.append(Paragraph("3. Identification of the work", H2))
    S.append(kv([
        ("Application name", F["app"]),
        ("Package identifier", F["package"]),
        ("Version / versionCode", f"{F['version']} / {F['vcode']}"),
        ("Category", "Games — catalogue and instant-play platform"),
        ("Primary website", F["site"]),
        ("Alternate host", F["site2"]),
        ("Source repository", F["repo"]),
        ("Vercel project", f"{F['proj_id']}  (production deployment {F['dep_id']})"),
        ("AdMob publisher ID", F["admob"]),
        ("Developer e-mail in app", F["email"]),
    ]))

    S.append(Paragraph("4. Technical evidence of authorship", H2))
    S.append(Paragraph(
        "The following are cryptographic and registry facts that Amazon can verify independently, without "
        "trusting anything asserted in this document:", BODY))
    S.append(kv([
        ("APK SHA-256", f"<font face='Courier' size='6.5'>{F['apk_sha']}</font>"),
        ("Signing certificate SHA-256", f"<font face='Courier' size='6.5'>{F['cert_sha']}</font>"),
        ("Checksum sidecar (live)", f"<font face='Courier' size='7.2'>{F['apk_url']}.sha256</font>"),
        ("Production deployment commit", f"<font face='Courier' size='7.2'>{F['dep_sha']}</font>"),
        ("Deployment creator", "ahmedbecetti35@gmail.com (Vercel account owner)"),
        ("APK download", f"<font face='Courier' size='7.2'>{F['apk_url']}</font>"),
    ]))
    S.append(Spacer(1, 5))
    S.append(note(
        "<b>Why this matters.</b> The APK submitted to Amazon is signed with a private key held exclusively by "
        "me, and the published checksum is served by the same domain that serves the application description "
        "the APK downloads from. Anyone holding the file can recompute its SHA-256 and compare it with the "
        "value above; only I can produce a binary that matches it."))

    S.append(Paragraph("5. Evidence held in public registries", H2))
    S.append(kv([
        ("Website", f"<font face='Courier' size='7.4'>{F['site']}</font> (public)"),
        ("About page", f"{F['site']}/about — names the developer and the studio"),
        ("App page", f"{F['site']}/app — version, versionCode, platform matrix, ad disclosure"),
        ("Privacy policy", f"{F['site']}/privacy — dated, names the AdMob publisher ID"),
        ("app-ads.txt", f"{F['site']}/app-ads.txt — <font face='Courier' size='7'>google.com, {F['admob']}, DIRECT, f08c47fec0942fa0</font>"),
        ("Partners & sourcing", f"{F['site']}/partners — licence and sourcing policy for third-party content"),
        ("Developer portal", f"{F['site']}/developers — rights declaration required from every submitter"),
        ("Vercel project", "private project, owned by the Vercel account associated with the developer"),
    ]))

    S.append(Paragraph("6. Third-party content and why it creates no competing rights holder", H2))
    S.append(Paragraph(
        "GameVerse lists games that were not written by me, and it is important to be precise about how. "
        "Those titles fall into exactly two categories, neither of which transfers ownership of the "
        "application to anyone else:", BODY))
    S.append(kv([
        ("Open-source titles", "Distributed under licences that permit commercial redistribution. Each game "
                               "page displays the licence and the upstream source, and attribution is "
                               "preserved. No permission is needed and none is claimed as exclusive."),
        ("Download entries", "Pointers to each developer's own official release page or store. GameVerse does "
                             "not re-host third-party installers."),
    ], widths=(38*mm, 132*mm)))
    S.append(Spacer(1, 6))
    S.append(Paragraph(
        "In both categories the third party remains the owner of its own game, and GameVerse owns its own "
        "platform and originals. No licence agreement exists between GameVerse and those parties that could "
        "be produced as evidence of ownership of <i>this application</i>, because their rights and mine are "
        "separate and non-overlapping. The application — the code, the interface, the catalogue, the brand — "
        "is entirely mine, as section 1 states.", BODY))

    S.append(Paragraph("7. Undertaking", H2))
    S.append(Paragraph(
        "I undertake to notify Amazon Developer Support immediately of any change in the ownership of this "
        "application, and to indemnify Amazon against any claim arising from a breach of the statements made "
        "here. I confirm these statements are true and correct, and I will provide a notarised or officially "
        "attested copy of this declaration, a copy of my identity document, or any further supporting "
        "document Amazon requires, on request.", BODY))

    S.append(Paragraph("8. Summary for the reviewer", H2))
    summary = Table([
        [Paragraph("<b>Rights holder</b>", st("q", fontSize=8.3, leading=11.8, alignment=TA_LEFT)),
         Paragraph(f"{F['owner']} — natural person, {F['city']}, {F['country']}. Sole proprietor; no company, "
                   "co-owner or employer involved.", st("a", fontSize=8.3, leading=11.8, alignment=TA_LEFT))],
        [Paragraph("<b>Protected work</b>", st("q", fontSize=8.3, leading=11.8, alignment=TA_LEFT)),
         Paragraph(f"{F['app']} platform and Android application, version {F['version']} "
                   f"(versionCode {F['vcode']}), package "
                   f"<font face='Courier' size='7.4'>{F['package']}</font>, plus 17 original games.",
                   st("a", fontSize=8.3, leading=11.8, alignment=TA_LEFT))],
        [Paragraph("<b>Rights claimed</b>", st("q", fontSize=8.3, leading=11.8, alignment=TA_LEFT)),
         Paragraph("Sole and exclusive copyright in source code, interface, catalogue, original games, brand "
                   "name and logo.", st("a", fontSize=8.3, leading=11.8, alignment=TA_LEFT))],
        [Paragraph("<b>Basis of rights</b>", st("q", fontSize=8.3, leading=11.8, alignment=TA_LEFT)),
         Paragraph("Original authorship — created by the rights holder, not acquired, assigned or licensed.",
                   st("a", fontSize=8.3, leading=11.8, alignment=TA_LEFT))],
        [Paragraph("<b>Third-party rights</b>", st("q", fontSize=8.3, leading=11.8, alignment=TA_LEFT)),
         Paragraph("None affecting the application. Listed third-party games remain their owners' property "
                   "and do not overlap with the rights claimed here.",
                   st("a", fontSize=8.3, leading=11.8, alignment=TA_LEFT))],
        [Paragraph("<b>Proof of identity</b>", st("q", fontSize=8.3, leading=11.8, alignment=TA_LEFT)),
         Paragraph("Owner-signed APK with a published SHA-256; the download, the checksum and the application "
                   "description are served by the same developer-controlled domain.",
                   st("a", fontSize=8.3, leading=11.8, alignment=TA_LEFT))],
    ], colWidths=[36*mm, 134*mm])
    summary.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BACKGROUND", (0,0), (0,-1), SOFT),
        ("GRID", (0,0), (-1,-1), 0.4, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4.5), ("BOTTOMPADDING", (0,0), (-1,-1), 4.5),
    ]))
    S.append(summary)

    S.append(Paragraph("9. Signature", H2))
    sig = Paragraph(
        "<b>Signed by the rights holder</b><br/><br/><br/>"
        "_______________________________________<br/><br/>"
        f"<b>{F['owner']}</b><br/>"
        f"<font size='8' color='#5A6172'>Sole proprietor, {F['app']} / {F['studio']}</font><br/>"
        f"<font size='8' color='#5A6172'>{F['city']}, {F['country']}</font><br/>"
        f"<font size='8' color='#5A6172'>{F['email']}</font><br/>"
        f"<font size='8' color='#5A6172'>Date: {F['date']}</font>",
        st("sg", fontSize=9, leading=13, alignment=TA_LEFT))
    att = Paragraph(
        "<b>Attestation (optional)</b><br/><br/>"
        "<font size='8' color='#5A6172'>To be completed only if Amazon requires an officially attested or "
        "notarised document.</font><br/><br/><br/>"
        "_______________________________________<br/>"
        "<font size='8' color='#5A6172'>Name, capacity and seal of the attesting officer</font><br/><br/>"
        "_______________________________________<br/>"
        "<font size='8' color='#5A6172'>Place and date of attestation</font>",
        st("at", fontSize=9, leading=13, alignment=TA_LEFT))
    t = Table([[sig, att]], colWidths=[83*mm, 83*mm])
    t.setStyle(TableStyle([
        ("BOX", (0,0), (0,0), 0.8, LINE), ("BOX", (1,0), (1,0), 0.8, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 9), ("BOTTOMPADDING", (0,0), (-1,-1), 9),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    S.append(t)
    S.append(Spacer(1, 7))
    S.append(Paragraph("This declaration is valid once signed in ink by the rights holder. An electronically "
                       "signed PDF or a scan of the signed page is acceptable for submission to Amazon "
                       "Developer Support.", SMALL))

    d = Doc(path); d.doc_title = "DECLARATION OF OWNERSHIP"; d.build(S)

def build_letter(path):
    S = []
    S.append(Paragraph("Letter of confirmation of intellectual property ownership", H1))
    S.append(Spacer(1, 8))
    S.append(Paragraph(f"<b>From</b><br/>{F['owner']}<br/>{F['studio']}<br/>{F['city']}, {F['country']}"
                       f"<br/>{F['email']}<br/>{F['phone']}", BODY))
    S.append(Spacer(1, 3))
    S.append(Paragraph("<b>To</b><br/>Amazon Developer Support<br/>410 Terry Avenue North<br/>"
                       "Seattle, WA 98109-5210<br/>United States", BODY))
    S.append(Spacer(1, 3))
    S.append(Paragraph(f"<b>Date</b>: {F['date']} &nbsp;|&nbsp; <b>Case</b>: {F['case']}", BODY))
    S.append(Spacer(1, 5))
    S.append(HRFlowable(width="100%", thickness=0.8, color=LINE, spaceAfter=9))

    S.append(Paragraph(f"<b>Subject: confirmation of ownership of the {F['app']} application and platform "
                       f"({F['package']})</b>", LEAD))
    S.append(Paragraph("Dear Amazon Developer Support,", BODY))
    S.append(Paragraph(
        "I am writing in reply to your request for documentation demonstrating valid intellectual property "
        "rights in the application I submitted for distribution on the Amazon Appstore. Your message asks for "
        "either a confirmation letter from the intellectual property rights holder bearing a formal "
        "signature, or a copy of the applicable licence agreement, on letterhead or stamp paper.", BODY))
    S.append(Paragraph(
        f"The rights holder is me. I am {F['owner']}, an individual developer resident in {F['city']}, "
        f"{F['country']}, trading under the name {F['studio']} as a sole proprietor. I wrote the application "
        "and the platform behind it myself: the source code, the interface, the catalogue, the seventeen "
        "original games and the brand. No company, employer, studio, contractor or co-founder holds any "
        "right, title or interest in them.", BODY))
    S.append(Paragraph(
        "There is therefore no separate licensor in this matter. A licence agreement exists where one party "
        "owns something and permits another to use it; here the owner and the developer are the same person, "
        "so no such agreement can exist and none is withheld. Please accept this letter instead as the "
        "<b>confirmation letter from the intellectual property rights holder, bearing a formal signature</b>, "
        "contemplated by your request: it is issued on the rights holder's letterhead and signed in ink by "
        "the rights holder, who is the same individual as the developer account holder and the person who "
        "signed the application binary.", BODY))

    S.append(Paragraph("Particulars of the application", H2))
    S.append(kv([
        ("Application", F["app"]),
        ("Package identifier", F["package"]),
        ("Version", f"{F['version']} (versionCode {F['vcode']})"),
        ("Platforms", "Android 7.0+, Amazon Fire OS (Fire tablets), Fire TV"),
        ("Rights holder", f"{F['owner']} — {F['studio']}"),
        ("Nature of rights", "Sole and exclusive copyright in code, interface, catalogue, original games and brand"),
        ("APK SHA-256", f"<font face='Courier' size='6.6'>{F['apk_sha']}</font>"),
        ("Official site", f"<font face='Courier' size='7.4'>{F['site']}</font>"),
    ]))

    S.append(Paragraph("Corroboration", H2))
    S.append(Paragraph(
        "The relationship between the parties is simple: there is only one party. The person named on this "
        "letterhead is the developer account holder, the author of the code, the owner of the Vercel project "
        "that serves the application, the registrant of the AdMob publisher account referenced in the app, "
        "and the recipient of the support address published inside it. Every one of those identities "
        "resolves to the same individual, and Amazon can check each of them independently:", BODY))
    S.append(kv([
        ("Download the APK", f"<font face='Courier' size='7.2'>{F['apk_url']}</font>"),
        ("Recompute its hash", f"<font face='Courier' size='7.2'>sha256sum gameverse-{F['version']}-release.apk</font>"),
        ("Compare with the published value", f"<font face='Courier' size='7.2'>{F['apk_url']}.sha256</font>"),
        ("Read the ad-authorisation file", f"<font face='Courier' size='7.2'>{F['ads_url']}</font>"),
        ("Read who built it", f"<font face='Courier' size='7.4'>{F['site']}/about</font>"),
    ]))
    S.append(Spacer(1, 6))
    S.append(Paragraph(
        "The hash is served by the same domain, under the same developer account, that serves the "
        "application's description, its privacy policy and its app-ads.txt. Only the holder of the signing "
        f"key can produce a binary matching it, and the key is mine.", BODY))

    S.append(Paragraph(
        "I am happy to supply, on request, a copy of my identity document, a notarised copy of this letter, "
        "or a formal attestation issued by a competent authority in Algeria, should either be required to "
        "complete your verification. Thank you for your time and for reconsidering this case.", BODY))
    S.append(Spacer(1, 14))
    S.append(Paragraph("Yours faithfully,", BODY))
    S.append(Spacer(1, 24))
    S.append(Paragraph("_______________________________________<br/>"
                       f"<b>{F['owner']}</b><br/>"
                       f"<font size='8' color='#5A6172'>Sole proprietor — {F['studio']} · {F['site']}</font><br/>"
                       f"<font size='8' color='#5A6172'>{F['email']} · {F['phone']}</font>",
                       st("s2", fontSize=9, leading=13, alignment=TA_LEFT)))

    d = Doc(path); d.doc_title = "CONFIRMATION LETTER"; d.build(S)

def build_annex(path):
    S = []
    S.append(Paragraph("Annex — evidence index, live links and verification commands", H1))
    S.append(Paragraph("Attachment to the declaration of ownership of GameVerse",
                       st("s", fontSize=9, textColor=MUTED, spaceAfter=9)))

    S.append(Paragraph("A. What is enclosed with this submission", H2))
    S.append(kv([
        ("A1", "Declaration of Intellectual Property Ownership — signed by the rights holder"),
        ("A2", "Letter of confirmation on the rights holder's letterhead — signed by the rights holder"),
        ("A3", "Annex — this evidence index with reproducible verification commands"),
        ("A4", "Screenshots of the running platform and application"),
        ("A5", "Full text submission document (A–Z) prepared for Amazon Developer Support"),
    ], widths=(14*mm, 156*mm)))

    S.append(Paragraph("B. Live links — every one is public and needs no login", H2))
    links = [
        ("Application home", F["site"]),
        ("About / who built it", f"{F['site']}/about"),
        ("App page (version, platforms, ads)", f"{F['site']}/app"),
        ("APK download", F["apk_url"]),
        ("APK checksum", f"{F['apk_url']}.sha256"),
        ("app-ads.txt", F["ads_url"]),
        ("Privacy policy", f"{F['site']}/privacy"),
        ("Partners & licensing", f"{F['site']}/partners"),
        ("Developer portal", f"{F['site']}/developers"),
        ("Support / help centre", f"{F['site']}/support"),
        ("Game catalogue", f"{F['site']}/games"),
        ("Originals", f"{F['site']}/original-games"),
        ("Alternate host", F["site2"]),
    ]
    S.append(kv([(k, f"<font face='Courier' size='7.3'>{v}</font>") for k, v in links],
                widths=(58*mm, 112*mm)))

    S.append(Paragraph("C. Verification commands", H2))
    S.append(Paragraph("A reviewer can confirm the signing identity and the integrity of the binary directly, "
                       "without trusting this document:", BODY))
    for label, cmd in [
        ("# 1. Download the submitted binary",
         f"curl -LO {F['apk_url']}"),
        ("# 2. Recompute its digest",
         f"sha256sum gameverse-{F['version']}-release.apk"),
        ("# 3. Compare with the published sidecar",
         f"curl {F['apk_url']}.sha256"),
        ("# 4. Confirm the ad-authorisation record matches the app",
         f"curl {F['ads_url']}"),
    ]:
        S.append(Paragraph(f"<font color='#5A6172'>{label}</font>", st("cl", fontSize=8, leading=11, spaceAfter=2)))
        S.append(code(cmd))
        S.append(Spacer(1, 5))

    S.append(Paragraph("D. Reference values", H2))
    S.append(kv([
        ("Package identifier", F["package"]),
        ("Version / versionCode", f"{F['version']} / {F['vcode']}"),
        ("APK SHA-256", f"<font face='Courier' size='6.6'>{F['apk_sha']}</font>"),
        ("Signing certificate SHA-256", f"<font face='Courier' size='6.6'>{F['cert_sha']}</font>"),
        ("AdMob publisher ID", f"<font face='Courier' size='7.4'>pub-6858364141205978</font>"),
        ("Vercel project", f"<font face='Courier' size='7.2'>{F['proj_id']}</font>"),
        ("Production deployment", f"<font face='Courier' size='7.2'>{F['dep_id']}</font>"),
        ("Deployment commit", f"<font face='Courier' size='7.4'>{F['dep_sha']}</font>"),
    ]))

    S.append(Paragraph("E. Statement on the absence of a third-party agreement", H2))
    S.append(Paragraph(
        "Amazon's request contemplates a rights holder separate from the developer, whose relationship with "
        "the developer would be defined by a licence agreement or a confirmation letter. In this case no such "
        "separation exists: the developer is the rights holder. A licence agreement between a person and "
        "himself would have no legal meaning, which is why the confirmation letter in attachment A2 is issued "
        "by the rights holder directly. Third-party games listed on the platform remain their own owners' "
        "property and do not overlap with the rights claimed over the application, so they create no competing "
        "claim and no agreement concerning them could evidence ownership of this application. Should Amazon "
        "nonetheless require a document in a specific format, I will obtain and supply it.", BODY))

    d = Doc(path); d.doc_title = "ANNEX — EVIDENCE INDEX"; d.build(S)

# =====================================================================
#  4 — النص الكامل A–Z
# =====================================================================
def build_submission(path):
    S = []
    S.append(Paragraph("GameVerse — full submission document (A–Z)", H1))
    S.append(Paragraph("Prepared for Amazon Developer Support · complete statement of the applicant, the "
                       "application, the rights held and the evidence supporting them",
                       st("s", fontSize=9, textColor=MUTED, spaceAfter=8)))

    def sec(letter, title, body, table=None, width=(38*mm, 132*mm)):
        S.append(Paragraph(f"{letter}. {title}", H2))
        if body:
            S.append(Paragraph(body, BODY))
        if table:
            S.append(kv(table, widths=width))

    sec("A", "Applicant",
        f"The applicant is <b>{F['owner']}</b>, an individual developer resident in {F['city']}, "
        f"{F['country']}. All correspondence for this submission should go to <b>{F['email']}</b> or "
        f"{F['phone']}.",
        [("Full legal name", F["owner"]),
         ("Residence", f"{F['city']}, {F['country']}"),
         ("E-mail", F["email"]),
         ("Telephone / WhatsApp", F["phone"]),
         ("Public channel", F["telegram"])])

    sec("B", "Legal capacity and status",
        f"I operate as a <b>sole proprietor</b> under the trade name {F['studio']}. This is a trading name, "
        "not a separate legal entity: there is no company, no shareholders and no co-owners. Contracts, "
        "accounts and intellectual property are held by me personally, which is why every account referenced "
        "in this document — the developer account, the hosting account, the advertising account and the "
        "source repository — is registered to the same natural person.")

    sec("C", "Contact details published in the application",
        f"The address <b>{F['email']}</b> is the single support and legal contact published on the "
        "application's support, privacy and partners pages, and it is the address that receives every "
        "partnership and rights inquiry submitted through the site. It is the same address used for this "
        "correspondence.")

    sec("D", "Application identity",
        None,
        [("Application name", F["app"]),
         ("Package identifier", F["package"]),
         ("Version / versionCode", f"{F['version']} / {F['vcode']}"),
         ("Category", "Games — catalogue and instant-play platform"),
         ("Primary website", F["site"]),
         ("Alternate host", F["site2"]),
         ("AdMob publisher ID", F["admob"]),
         ("Minimum Android", "7.0 (API 24)")])

    sec("E", "Version and build",
        f"The build submitted is version {F['version']}, versionCode {F['vcode']}. It is an owner-signed "
        "release: the private signing key is held by the applicant and is never committed to the repository. "
        "The published checksum for the exact file distributed is recorded in section U and is served "
        "alongside the download.")

    sec("F", "What GameVerse is",
        "GameVerse is an independent international gaming platform. It combines three things players usually "
        "find on separate sites: <b>instant browser games</b> that run without installation, <b>download "
        "listings</b> that point to the official release pages of open-source and commercial titles, and a "
        "<b>community layer</b> of accounts, scores, reviews, leaderboards and daily challenges. The Android "
        "application is a native shell around the same live platform, so its content is never out of date.")

    sec("G", "Feature inventory",
        None,
        [("Catalogue", "45 published games, of which 17 are GameVerse originals built in-house"),
         ("Instant play", "HTML5 games run in a sandboxed player, no download"),
         ("Downloads", "Verified pointers to official release pages; no re-hosting"),
         ("Accounts", "E-mail sign-in with a verification code; guests may browse"),
         ("Community", "Reviews, favourites, play history, public profiles"),
         ("Competition", "Leaderboards, daily challenges, achievements, game of the day"),
         ("Store", "In-app storefront for memberships and digital goods, server-verified pricing"),
         ("Developer portal", "Self-service studio registration, game submission and review workflow"),
         ("Languages", "Arabic, French and English"),
         ("Platforms", "Android phones and tablets, Amazon Fire OS tablets, Fire TV (leanback)")])

    sec("H", "Technology",
        "The platform is a server-rendered web application with a relational database and serverless "
        "functions, deployed on a global edge network. The application is a thin native shell that loads the "
        "live site and adds native capabilities: a download manager, an offline screen that reconnects "
        "automatically, persistent language and theme, and an advertising bridge.",
        [("Framework", "Next.js (React), server-rendered, TypeScript"),
         ("Database", "Managed PostgreSQL, encrypted at rest"),
         ("Hosting", "Vercel — serverless functions plus edge delivery"),
         ("E-mail", "Transactional e-mail provider for verification codes"),
         ("Bot protection", "Automated challenge on registration and login"),
         ("Scheduled jobs", "Weekly digest job registered with the hosting platform"),
         ("Ads (web)", "Google AdSense with Consent Mode v2"),
         ("Ads (app)", "Google AdMob, publisher " + F["admob"])])

    sec("I", "Hosting, accounts and control",
        "Every service the application depends on is registered to the applicant. No third party has "
        "administrative access to the hosting project, the database, the advertising account or the source "
        "repository.",
        [("Hosting project", f"Vercel {F['proj_id']}"),
         ("Vercel team", "ahmed-d33b"),
         ("Production deployment", F["dep_id"]),
         ("Source repository", F["repo"]),
         ("Repository owner", "GitHub account Ahmedbecett")])

    sec("J", "Ownership of the work",
        f"I, <b>{F['owner']}</b>, am the sole author and sole owner of the GameVerse application, the website "
        "and backend behind it, the seventeen original games, and the GameVerse name and logo. This ownership "
        "arose from authorship: the work was created by me, not bought, assigned, inherited or licensed from "
        "anyone.")

    sec("K", "Authorship and creation history",
        "The application and platform were built by me over successive documented releases. The hosting "
        "platform retains a continuous deployment history for the project, each production deployment "
        "recording the commit, the author and the build. That history is the primary record of authorship and "
        "can be inspected by Amazon on request. Release identifiers recorded in the deployment history "
        "include, in order, the initial platform phases, password recovery, instant-play features, bot "
        "protection hardening, the advertising pause, the app-shell work, the owner-signed APK rollout and "
        "the current Android 2.8.0 release.")

    sec("L", "Absence of a third-party rights holder",
        "Amazon's request contemplates a rights holder separate from the developer, whose relationship with "
        "the developer would be defined by a licence agreement or a confirmation letter. <b>No such "
        "separation exists here.</b> The developer is the rights holder. A licence agreement between a person "
        "and himself would have no legal meaning, which is why the confirmation letter supplied with this "
        "submission is issued by the rights holder directly, signed in ink, on the rights holder's letterhead.")

    sec("M", "Third-party games — open source",
        "Some titles in the catalogue are open-source games. They are included only where the licence permits "
        "commercial use and redistribution; asset licences are verified separately and attribution is "
        "preserved where required. Each game page displays the licence and the upstream source. These games "
        "remain the property of their authors and no exclusive right over them is claimed.")

    sec("N", "Third-party games — download pointers",
        "Download entries are links to each developer's own official release page or store. GameVerse does "
        "not host third-party installers and claims no distribution right over them. The platform's partners "
        "page states this policy publicly and provides a rights-issue contact for any owner who believes a "
        "listing exceeds its licence.")

    sec("O", "Trademarks and publisher names",
        "Where a trademarked title is referenced, it appears only as a pointer to its official store. "
        "GameVerse states publicly that it is not affiliated with, endorsed by or partnered with any publisher "
        "unless a signed agreement exists. No publisher logo, key art or trademark is used to imply "
        "endorsement.")

    sec("P", "Advertising disclosure",
        "Advertising is clearly described in the application's public documentation and privacy policy:",
        [("In the app", f"Google AdMob, publisher {F['admob']}, authorised by app-ads.txt"),
         ("Banner", "One small banner below the content area; disappears when no ad is available"),
         ("Interstitial", "Only at real transitions, at most one per 3 minutes and 5 per session"),
         ("Rewarded", "Granted only after Google confirms the ad was completed"),
         ("Excluded screens", "Gameplay, sign-in, profile, admin and developer screens carry no ads"),
         ("Fire OS", "Devices without Google Play services make no ad request at all"),
         ("EEA / UK", "Ads stay non-personalised until consent is given through Google's UMP")])

    sec("Q", "Privacy and data protection",
        "The privacy policy is dated, public, and specific about what is collected and what is not. No data is "
        "sold, no third-party analytics run, and no cross-site tracking takes place. Traffic statistics are "
        "first-party pageview counts stored in the platform's own database. Consent for advertising cookies is "
        "requested in the EEA and UK and stored for 180 days.",
        [("Privacy policy", f"{F['site']}/privacy"),
         ("Data collected", "Account e-mail and display name, favourites, reviews, play records, download log"),
         ("Data not collected", "No sale of data, no cross-site tracking, no third-party analytics"),
         ("Data export", "Complete JSON export available from settings"),
         ("Data deletion", "Self-service account deletion, cascading all user data")])

    sec("R", "Accounts and authentication",
        "Accounts exist to keep scores, reviews and downloads genuine: one person, one profile. Sign-in uses "
        "an e-mail verification code; sessions are hashed server-side and secrets never reach the browser. "
        "Login and registration are protected by an automated challenge. Users can review and revoke active "
        "sessions from their profile.")

    sec("S", "Content moderation and reporting",
        "Every game page carries a report action that reaches studio moderation, and the help centre exposes "
        "a direct contact form and e-mail address. The developer portal enforces a written rights declaration "
        "from every submitter, automated security scanning of every upload, and an admin review before "
        "anything is published.",
        [("Report path", f"{F['site']}/support"),
         ("Declaration", "Every submitter declares ownership or written distribution rights"),
         ("Automated checks", "File-type whitelist, path traversal and ZIP-bomb rejection, credential access blocked"),
         ("Review", "Draft → Submitted → Under Review → Approved / Rejected with written feedback"),
         ("Rights contact", f"{F['email']} — takedown or correction handled promptly")])

    sec("T", "Security measures",
        "The application loads remote content, so the platform is built to keep that content isolated. Games "
        "run in a sandboxed player served from an isolated origin that cannot reach player sessions. "
        "Advertising tags that are not first-party load only inside a dedicated frame with an opaque origin "
        "and no top navigation, so such a tag cannot read a session or redirect the tab. Uploads are scanned "
        "before publication and rejected if they attempt to touch platform credentials or internal APIs.")

    sec("U", "Technical proof of authorship",
        "The following values bind the distributed binary, the signing identity and the hosting project to the "
        "same person. Each is independently checkable.",
        [("APK SHA-256", f"<font face='Courier' size='6.5'>{F['apk_sha']}</font>"),
         ("Signing certificate SHA-256", f"<font face='Courier' size='6.5'>{F['cert_sha']}</font>"),
         ("Download", f"<font face='Courier' size='7.2'>{F['apk_url']}</font>"),
         ("Published checksum", f"<font face='Courier' size='7.2'>{F['apk_url']}.sha256</font>"),
         ("Production commit", f"<font face='Courier' size='7.2'>{F['dep_sha']}</font>"),
         ("Deployment creator", "ahmedbecetti35@gmail.com (hosting account owner)")])

    sec("V", "Public evidence index",
        "None of the following requires credentials, payment or permission:",
        [("About — who built it", f"{F['site']}/about"),
         ("App page — version, platforms, ads", f"{F['site']}/app"),
         ("Privacy policy — dated", f"{F['site']}/privacy"),
         ("app-ads.txt — ad authorisation", f"{F['site']}/app-ads.txt"),
         ("Partners — sourcing and licensing", f"{F['site']}/partners"),
         ("Developers — submission rules", f"{F['site']}/developers"),
         ("Support — reporting and contact", f"{F['site']}/support"),
         ("Catalogue", f"{F['site']}/games"),
         ("Originals", f"{F['site']}/original-games")])

    sec("W", "Verification commands",
        "A reviewer can reproduce every claim in section U without trusting this document:")
    for label, cmd in [
        ("# 1. Fetch the distributed binary", f"curl -LO {F['apk_url']}"),
        ("# 2. Recompute its digest", f"sha256sum gameverse-{F['version']}-release.apk"),
        ("# 3. Compare with the published value", f"curl {F['apk_url']}.sha256"),
        ("# 4. Confirm the ad authorisation record", f"curl {F['ads_url']}"),
    ]:
        S.append(Paragraph(f"<font color='#5A6172'>{label}</font>", st("c2", fontSize=7.8, leading=10.5, spaceAfter=1.5)))
        S.append(code(cmd))
        S.append(Spacer(1, 4))

    sec("X", "Rights claimed, and rights not claimed",
        "To be explicit about the boundary of this declaration:",
        [("Claimed — exclusive", "Source code of the application and platform, user interface, catalogue "
                                 "structure, the 17 original games, the GameVerse name and logo"),
         ("Not claimed", "Ownership of third-party games listed in the catalogue, of the open-source "
                         "libraries used to build the platform, of the Android operating system, or of "
                         "Google's advertising services"),
         ("Why the boundary matters", "No third party holds rights that overlap with the claimed work, so "
                                      "no third-party agreement could evidence ownership of it")],
        width=(40*mm, 130*mm))

    sec("Y", "Undertaking",
        "I undertake to notify Amazon Developer Support immediately of any change in the ownership of this "
        "application, and to indemnify Amazon against any claim arising from a breach of the statements made "
        "in this document. I confirm that these statements are true and correct to the best of my knowledge, "
        "and that I am willing to provide a notarised or officially attested copy of this document, a copy of "
        "my identity document, or any further supporting document Amazon requires.")

    sec("Z", "Signature and attestation",
        "This document is issued and signed by the rights holder. It is valid once signed in ink; an "
        "electronically signed file or a scan of the signed page is acceptable for submission.")

    S.append(Spacer(1, 8))
    sig = Paragraph(
        "<b>Signed by the rights holder</b><br/><br/><br/>"
        "_______________________________________<br/><br/>"
        f"<b>{F['owner']}</b><br/>"
        f"<font size='8' color='#5A6172'>Sole proprietor, {F['studio']} — {F['app']}</font><br/>"
        f"<font size='8' color='#5A6172'>{F['city']}, {F['country']}</font><br/>"
        f"<font size='8' color='#5A6172'>{F['email']} · {F['phone']}</font><br/>"
        f"<font size='8' color='#5A6172'>Date: {F['date']}</font>",
        st("sg2", fontSize=9, leading=12.5, alignment=TA_LEFT))
    att = Paragraph(
        "<b>Attestation (optional)</b><br/><br/>"
        "<font size='8' color='#5A6172'>Only if Amazon requires an officially attested or notarised "
        "document.</font><br/><br/><br/>"
        "_______________________________________<br/>"
        "<font size='8' color='#5A6172'>Name, capacity and seal of the attesting officer</font><br/><br/>"
        "_______________________________________<br/>"
        "<font size='8' color='#5A6172'>Place and date of attestation</font>",
        st("at2", fontSize=9, leading=12.5, alignment=TA_LEFT))
    t = Table([[sig, att]], colWidths=[83*mm, 83*mm])
    t.setStyle(TableStyle([
        ("BOX", (0,0), (0,0), 0.8, LINE), ("BOX", (1,0), (1,0), 0.8, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 9), ("RIGHTPADDING", (0,0), (-1,-1), 9),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    S.append(t)

    d = Doc(path); d.doc_title = "FULL SUBMISSION — A TO Z"; d.build(S)


# =====================================================================
#  نص عادي للّصق المباشر في نموذج القضية
# =====================================================================
def write_plain_text(path):
    L = []
    A = L.append
    A("GAMEVERSE — FULL SUBMISSION DOCUMENT (A–Z)")
    A("=" * 62)
    A("")
    A(f"Applicant:   {F['owner']} — {F['studio']}")
    A(f"Location:    {F['city']}, {F['country']}")
    A(f"Contact:     {F['email']} · {F['phone']}")
    A(f"Application: {F['app']} {F['version']} (versionCode {F['vcode']})")
    A(f"Package:     {F['package']}")
    A(f"Website:     {F['site']}")
    A(f"Amazon case: {F['case']}")
    A(f"Date:        {F['date']}")
    A("")
    A("=" * 62)
    A("")

    secs = [
      ("A. APPLICANT",
       f"The applicant is {F['owner']}, an individual developer resident in {F['city']}, {F['country']}. "
       f"All correspondence should go to {F['email']} or {F['phone']}."),
      ("B. LEGAL CAPACITY AND STATUS",
       f"I operate as a sole proprietor under the trade name {F['studio']}. This is a trading name, not a "
       "separate legal entity: there is no company, no shareholders and no co-owners. Contracts, accounts "
       "and intellectual property are held by me personally, which is why every account referenced here is "
       "registered to the same natural person."),
      ("C. CONTACT DETAILS PUBLISHED IN THE APPLICATION",
       f"The address {F['email']} is the single support and legal contact published on the application's "
       "support, privacy and partners pages. It is the same address used for this correspondence."),
      ("D. APPLICATION IDENTITY",
       f"Name: {F['app']}\nPackage: {F['package']}\nVersion: {F['version']} (versionCode {F['vcode']})\n"
       f"Category: Games — catalogue and instant-play platform\nPrimary website: {F['site']}\n"
       f"Alternate host: {F['site2']}\nAdMob publisher: {F['admob']}\nMinimum Android: 7.0 (API 24)"),
      ("E. VERSION AND BUILD",
       f"The build submitted is version {F['version']}, versionCode {F['vcode']}. It is an owner-signed "
       "release: the private signing key is held by the applicant and is never committed to the repository."),
      ("F. WHAT GAMEVERSE IS",
       "GameVerse is an independent international gaming platform combining instant browser games that run "
       "without installation, download listings that point to the official release pages of open-source and "
       "commercial titles, and a community layer of accounts, scores, reviews, leaderboards and daily "
       "challenges. The Android application is a native shell around the same live platform."),
      ("G. FEATURE INVENTORY",
       "Catalogue: 45 published games, 17 of them GameVerse originals built in-house\n"
       "Instant play: HTML5 games in a sandboxed player\n"
       "Downloads: verified pointers to official release pages\n"
       "Accounts: e-mail sign-in with verification code\n"
       "Community: reviews, favourites, play history, public profiles\n"
       "Competition: leaderboards, daily challenges, achievements\n"
       "Store: memberships and digital goods, server-verified pricing\n"
       "Developer portal: studio registration, submission and review workflow\n"
       "Languages: Arabic, French, English\n"
       "Platforms: Android phones and tablets, Amazon Fire OS tablets, Fire TV"),
      ("H. TECHNOLOGY",
       "Next.js (React) server-rendered, TypeScript. Managed PostgreSQL encrypted at rest. Hosted on Vercel "
       "with serverless functions and edge delivery. Transactional e-mail provider for verification codes. "
       "Automated bot challenge on registration and login. Weekly digest job. Google AdSense on the web with "
       f"Consent Mode v2, Google AdMob in the app (publisher {F['admob']})."),
      ("I. HOSTING, ACCOUNTS AND CONTROL",
       f"Vercel project: {F['proj_id']}\nVercel team: ahmed-d33b\n"
       f"Production deployment: {F['dep_id']}\nSource repository: {F['repo']}\n"
       "Repository owner: GitHub account Ahmedbecett. No third party has administrative access to any of "
       "these."),
      ("J. OWNERSHIP OF THE WORK",
       f"I, {F['owner']}, am the sole author and sole owner of the GameVerse application, the website and "
       "backend behind it, the seventeen original games, and the GameVerse name and logo. This ownership "
       "arose from authorship: the work was created by me, not bought, assigned, inherited or licensed."),
      ("K. AUTHORSHIP AND CREATION HISTORY",
       "The application and platform were built by me over successive documented releases. The hosting "
       "platform retains a continuous deployment history for the project, each production deployment "
       "recording the commit, the author and the build. That history is the primary record of authorship and "
       "can be inspected by Amazon on request."),
      ("L. ABSENCE OF A THIRD-PARTY RIGHTS HOLDER",
       "Amazon's request contemplates a rights holder separate from the developer, whose relationship with "
       "the developer would be defined by a licence agreement or a confirmation letter. No such separation "
       "exists here: the developer is the rights holder. A licence agreement between a person and himself "
       "would have no legal meaning, which is why the confirmation letter supplied with this submission is "
       "issued by the rights holder directly, signed in ink, on the rights holder's letterhead."),
      ("M. THIRD-PARTY GAMES — OPEN SOURCE",
       "Some titles are open-source games, included only where the licence permits commercial use and "
       "redistribution. Asset licences are verified separately and attribution is preserved where required. "
       "Each game page displays the licence and the upstream source. These games remain the property of "
       "their authors and no exclusive right over them is claimed."),
      ("N. THIRD-PARTY GAMES — DOWNLOAD POINTERS",
       "Download entries are links to each developer's own official release page or store. GameVerse does not "
       "host third-party installers and claims no distribution right over them. The partners page states "
       "this policy publicly and provides a rights-issue contact."),
      ("O. TRADEMARKS AND PUBLISHER NAMES",
       "Where a trademarked title is referenced it appears only as a pointer to its official store. GameVerse "
       "states publicly that it is not affiliated with, endorsed by or partnered with any publisher unless a "
       "signed agreement exists."),
      ("P. ADVERTISING DISCLOSURE",
       f"In the app: Google AdMob, publisher {F['admob']}, authorised by app-ads.txt.\n"
       "Banner: one small banner below the content area; disappears when no ad is available.\n"
       "Interstitial: only at real transitions, at most one per 3 minutes and 5 per session.\n"
       "Rewarded: granted only after Google confirms the ad was completed.\n"
       "Excluded screens: gameplay, sign-in, profile, admin and developer screens carry no ads.\n"
       "Fire OS: devices without Google Play services make no ad request at all.\n"
       "EEA/UK: ads stay non-personalised until consent is given through Google's UMP."),
      ("Q. PRIVACY AND DATA PROTECTION",
       f"The privacy policy is dated and public at {F['site']}/privacy. No data is sold, no third-party "
       "analytics run, and no cross-site tracking takes place. Traffic statistics are first-party pageview "
       "counts. Consent for advertising cookies is requested in the EEA and UK and stored for 180 days. A "
       "complete JSON export and self-service account deletion are available to every user."),
      ("R. ACCOUNTS AND AUTHENTICATION",
       "Accounts exist to keep scores, reviews and downloads genuine: one person, one profile. Sign-in uses "
       "an e-mail verification code; sessions are hashed server-side and secrets never reach the browser. "
       "Login and registration are protected by an automated challenge. Users can review and revoke active "
       "sessions."),
      ("S. CONTENT MODERATION AND REPORTING",
       f"Every game page carries a report action reaching studio moderation, and the help centre exposes a "
       f"contact form at {F['site']}/support. The developer portal enforces a written rights declaration "
       "from every submitter, automated security scanning of every upload, and admin review before "
       "publication."),
      ("T. SECURITY MEASURES",
       "Games run in a sandboxed player served from an isolated origin that cannot reach player sessions. "
       "Non-first-party advertising tags load only inside a dedicated frame with an opaque origin and no top "
       "navigation, so such a tag cannot read a session or redirect the tab. Uploads are scanned before "
       "publication and rejected if they attempt to touch platform credentials."),
      ("U. TECHNICAL PROOF OF AUTHORSHIP",
       f"APK SHA-256: {F['apk_sha']}\nSigning certificate SHA-256: {F['cert_sha']}\n"
       f"Download: {F['apk_url']}\nPublished checksum: {F['apk_url']}.sha256\n"
       f"Production commit: {F['dep_sha']}\nDeployment creator: ahmedbecetti35@gmail.com (account owner)"),
      ("V. PUBLIC EVIDENCE INDEX",
       f"About: {F['site']}/about\nApp page: {F['site']}/app\nPrivacy: {F['site']}/privacy\n"
       f"app-ads.txt: {F['ads_url']}\nPartners: {F['site']}/partners\nDevelopers: {F['site']}/developers\n"
       f"Support: {F['site']}/support\nCatalogue: {F['site']}/games\nOriginals: {F['site']}/original-games"),
      ("W. VERIFICATION COMMANDS",
       f"1. curl -LO {F['apk_url']}\n2. sha256sum gameverse-{F['version']}-release.apk\n"
       f"3. curl {F['apk_url']}.sha256\n4. curl {F['ads_url']}"),
      ("X. RIGHTS CLAIMED, AND RIGHTS NOT CLAIMED",
       "Claimed exclusively: the source code of the application and platform, the user interface, the "
       "catalogue structure, the 17 original games, and the GameVerse name and logo.\n"
       "Not claimed: ownership of third-party games listed in the catalogue, of open-source libraries used "
       "to build the platform, of the Android operating system, or of Google's advertising services.\n"
       "Why the boundary matters: no third party holds rights overlapping the claimed work, so no "
       "third-party agreement could evidence ownership of it."),
      ("Y. UNDERTAKING",
       "I undertake to notify Amazon Developer Support immediately of any change in the ownership of this "
       "application, and to indemnify Amazon against any claim arising from a breach of these statements. I "
       "confirm these statements are true and correct, and I will provide a notarised or officially attested "
       "copy of this document, a copy of my identity document, or any further supporting document Amazon "
       "requires."),
      ("Z. SIGNATURE AND ATTESTATION",
       "This document is issued and signed by the rights holder. It is valid once signed in ink; an "
       "electronically signed file or a scan of the signed page is acceptable for submission."),
    ]
    for title, body in secs:
        A(title)
        A("-" * len(title))
        for line in body.split("\n"):
            A(line)
        A("")

    A("=" * 62)
    A("SIGNED BY THE RIGHTS HOLDER")
    A("")
    A("_______________________________________")
    A(F["owner"])
    A(f"Sole proprietor, {F['studio']} — {F['app']}")
    A(f"{F['city']}, {F['country']}")
    A(f"{F['email']} · {F['phone']}")
    A(f"Date: {F['date']}")
    A("")

    open(path, "w", encoding="utf-8").write("\n".join(L))
    return path


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Generate the GameVerse ownership package.")
    ap.add_argument("--case", default=None,
                    help="Amazon case number, e.g. --case 23265129241 (printed in every header)")
    ap.add_argument("--plain", action="store_true", default=True,
                    help="also write the A-Z document as plain text for pasting into the case form")
    args = ap.parse_args()
    if args.case:
        F["case"] = args.case.strip()
        print(f"رقم القضية: {F['case']}")

    p1 = os.path.join(OUT, "1-declaration-of-ownership.pdf")
    p2 = os.path.join(OUT, "2-confirmation-letter.pdf")
    p3 = os.path.join(OUT, "3-annex-evidence-index.pdf")
    p4 = os.path.join(OUT, "4-amazon-submission-a-to-z.pdf")
    build_declaration(p1); build_letter(p2); build_annex(p3); build_submission(p4)
    outs = [p1, p2, p3, p4]
    if args.plain:
        outs.append(write_plain_text(os.path.join(OUT, "5-submission-plain-text.txt")))
    for p in outs:
        print(f"{os.path.basename(p):38s} {os.path.getsize(p):>8,} bytes")
