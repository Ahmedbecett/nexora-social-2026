#!/usr/bin/env python3
"""
يبني وثيقة إثبات ملكية NEXORA AI — للمراسلة مع Amazon Developer Support.
المخرجات: docs/ownership/*.pdf
"""
import os, sys, hashlib, argparse
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, Image, KeepTogether, HRFlowable)

OUT = "docs/ownership"
os.makedirs(OUT, exist_ok=True)

# ---------- ألوان الهوية ----------
INK    = colors.HexColor("#101322")
MUTED  = colors.HexColor("#5B6172")
ACCENT = colors.HexColor("#6D3BF5")
LINE   = colors.HexColor("#D7DAE3")
SOFT   = colors.HexColor("#F4F2FF")

# ---------- حقائق المشروع (مُستخرَجة من المستودع) ----------
F = dict(
    owner      = "Ahmed Becetti",
    city       = "Chlef",
    country    = "Algeria",
    email      = "ahmedbecetti35@gmail.com",
    app        = "NEXORA AI",
    package    = "com.ahmedbecetti.nexora",
    version    = "4.4.0",
    vcode      = "44",
    repo       = "https://github.com/Ahmedbecett/nexora-social-2026",
    sites      = ["https://nexora-social-2026.vercel.app"],
    admob      = "ca-app-pub-6858364141205978",
    cert_sha   = "24:0E:00:2F:A0:90:51:6D:EF:06:E8:92:61:4F:03:A3:79:17:A0:3B:30:04:BE:EC:F5:1B:1A:D3:0C:07:42:F6",
    cert_subj  = "CN=NEXORA AI, OU=Mobile, O=Ahmed Becetti, L=Chlef, C=DZ",
    cert_serial= "669888727667885013161587190790839580619482603532",
    cert_from  = "11 November 2026",
    cert_to    = "29 March 2054",
    apk_sha    = "0BB69798A7D99CE84EA940EF8C18B2403A6A8B37975DD1C815F5BBA32E85B662",
    apk_size   = "13,814,604 bytes",
    case_id    = "23265129241",
    date       = "12 November 2026",
)

ss = getSampleStyleSheet()
def st(name, **kw):
    base = dict(fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK,
                alignment=TA_JUSTIFY, spaceAfter=0)
    base.update(kw)
    return ParagraphStyle(name, **base)

BODY   = st("body", spaceAfter=7)
LEAD   = st("lead", fontSize=10, leading=15.5, spaceAfter=9)
H1     = st("h1", fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=INK,
            alignment=TA_LEFT, spaceAfter=2)
H2     = st("h2", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=ACCENT,
            alignment=TA_LEFT, spaceAfter=5, spaceBefore=11)
SMALL  = st("small", fontSize=8, leading=11, textColor=MUTED, alignment=TA_LEFT)
MONO   = st("mono", fontName="Courier", fontSize=7.6, leading=11, textColor=INK,
            alignment=TA_LEFT)
CENT   = st("cent", fontSize=8.5, leading=12, textColor=MUTED, alignment=TA_CENTER)

# ---------- صفحة بترويسة وتذييل ----------
MARGIN = 20 * mm
HEADER_H = 26 * mm

class Doc(BaseDocTemplate):
    def __init__(self, path, **kw):
        super().__init__(path, pagesize=A4,
                         leftMargin=MARGIN, rightMargin=MARGIN,
                         topMargin=HEADER_H + 6 * mm, bottomMargin=18 * mm,
                         title="Declaration of Ownership — NEXORA AI",
                         author=F["owner"], subject="Intellectual property ownership declaration",
                         **kw)
        frame = Frame(self.leftMargin, self.bottomMargin,
                      self.width, self.height, id="f", showBoundary=0)
        self.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=self.decorate)])

    def decorate(self, c, doc):
        w, h = A4
        # شريط علوي
        c.setFillColor(ACCENT); c.rect(0, h - 4.2*mm, w, 4.2*mm, stroke=0, fill=1)
        # الشعار
        logo = "public/icon-192.png"
        if os.path.exists(logo):
            c.drawImage(logo, MARGIN, h - 24*mm, 15*mm, 15*mm, mask="auto",
                        preserveAspectRatio=True)
        x = MARGIN + 19*mm
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 13)
        c.drawString(x, h - 14*mm, "NEXORA AI")
        c.setFillColor(MUTED); c.setFont("Helvetica", 7.6)
        c.drawString(x, h - 18.4*mm, "Mobile application  ·  com.ahmedbecetti.nexora  ·  v4.4.0")
        c.drawString(x, h - 22*mm, "Sole proprietor: Ahmed Becetti  ·  Chlef, Algeria")

        # الجهة اليمنى من الترويسة
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 7.8)
        c.drawRightString(w - MARGIN, h - 14*mm, getattr(doc, "doc_title", "DECLARATION OF OWNERSHIP"))
        c.setFillColor(MUTED); c.setFont("Helvetica", 7.2)
        c.drawRightString(w - MARGIN, h - 18.4*mm, f"Date: {F['date']}")
        c.drawRightString(w - MARGIN, h - 22*mm, f"Amazon case: {F['case_id']}")

        c.setStrokeColor(LINE); c.setLineWidth(0.7)
        c.line(MARGIN, h - HEADER_H, w - MARGIN, h - HEADER_H)

        # تذييل
        c.setStrokeColor(LINE); c.setLineWidth(0.7)
        c.line(MARGIN, 14*mm, w - MARGIN, 14*mm)
        c.setFillColor(MUTED); c.setFont("Helvetica", 7)
        c.drawString(MARGIN, 10*mm, "NEXORA AI — Declaration of Ownership  ·  Ahmed Becetti  ·  Chlef, Algeria")
        c.drawRightString(w - MARGIN, 10*mm, f"Page {doc.page}")

def kv_table(rows, widths=(52*mm, 118*mm)):
    data = [[Paragraph(f"<b>{k}</b>", st("k", fontSize=8.6, leading=12)),
             Paragraph(v, st("v", fontSize=8.6, leading=12, alignment=TA_LEFT))] for k, v in rows]
    t = Table(data, colWidths=list(widths))
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BACKGROUND", (0,0), (0,-1), SOFT),
        ("GRID", (0,0), (-1,-1), 0.4, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4.5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4.5),
    ]))
    return t

def notice(text, bg=SOFT, border=ACCENT):
    t = Table([[Paragraph(text, st("n", fontSize=8.8, leading=13))]],
              colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("LINEBEFORE", (0,0), (0,-1), 2.4, border),
        ("LEFTPADDING", (0,0), (-1,-1), 9),
        ("RIGHTPADDING", (0,0), (-1,-1), 9),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    return t

# =====================================================================
#  المخرجات
# =====================================================================
def build_declaration(path):
    """الصفحة الرئيسية: إقرار موقّع (ما يطلبه Amazon حرفيًا)."""
    S = []
    S.append(Paragraph("Declaration of Intellectual Property Ownership", H1))
    S.append(Paragraph("Sole authorship and ownership of the NEXORA AI application", st("sub", fontSize=9, textColor=MUTED, spaceAfter=10)))

    S.append(Paragraph("To: <b>Amazon Developer Support</b> — Case 23265129241", BODY))
    S.append(Paragraph("Re: Documentation evidencing valid intellectual property rights in the application "
                       "submitted under the developer account of <b>Ahmed Becetti</b>.", BODY))

    S.append(Paragraph("1. Declaration", H2))
    S.append(Paragraph(
        f"I, <b>{F['owner']}</b>, a natural person resident in {F['city']}, {F['country']}, hereby declare "
        f"under my own responsibility and in my own name that I am the <b>sole author, sole owner and sole "
        f"rights holder</b> of the mobile application distributed under the name <b>{F['app']}</b>, package "
        f"identifier <b>{F['package']}</b>.", LEAD))
    S.append(Paragraph(
        "The application was conceived, designed, written, built, signed and published by me personally. "
        "No third party contributed source code, artwork, brand assets or content to the application, and no "
        "third party holds any licence, royalty, equity or other interest in it. There is therefore no "
        "separate rights holder from whom a licence agreement or a confirmation letter could be obtained: "
        "<b>I am that rights holder, and the declaration below is issued by the rights holder himself.</b>", BODY))
    S.append(Paragraph(
        "I confirm that I have the full legal right to publish, distribute and monetise this application, "
        "including on the Amazon Appstore, and that doing so does not infringe the rights of any third party.", BODY))

    S.append(Paragraph("2. Identification of the rights holder", H2))
    S.append(kv_table([
        ("Full legal name", F["owner"]),
        ("Capacity", "Natural person — sole proprietor (individual developer)"),
        ("Address", f"{F['city']}, {F['country']}"),
        ("Contact e-mail", F["email"]),
        ("Amazon case reference", F["case_id"]),
        ("GitHub account", "Ahmedbecett — sole owner and sole contributor"),
    ]))

    S.append(Paragraph("3. Identification of the work", H2))
    S.append(kv_table([
        ("Application name", F["app"]),
        ("Package identifier", F["package"]),
        ("Version / versionCode", f"{F['version']} / {F['vcode']}"),
        ("Category", "Mobile application (Android / Fire OS) — AI assistant"),
        ("Official website", F["sites"][0]),
        ("Source repository", F["repo"]),
        ("AdMob publisher ID", F["admob"]),
    ]))

    S.append(Paragraph("4. Technical evidence of authorship", H2))
    S.append(Paragraph(
        "The following are cryptographic and registry facts, independently verifiable by Amazon, that tie the "
        "published binary, the signing identity and the source repository to the same person:", BODY))
    S.append(kv_table([
        ("APK signing certificate — subject",
         f"<font face='Courier' size='7.4'>{F['cert_subj']}</font>"),
        ("Certificate SHA-256 fingerprint",
         f"<font face='Courier' size='7.0'>{F['cert_sha']}</font>"),
        ("Certificate serial number",
         f"<font face='Courier' size='6.8'>{F['cert_serial']}</font>"),
        ("Certificate validity", f"{F['cert_from']} — {F['cert_to']}"),
        ("Published APK — SHA-256",
         f"<font face='Courier' size='6.6'>{F['apk_sha']}</font>"),
        ("Published APK — size", F["apk_size"]),
        ("Digest published by GitHub",
         f"<font face='Courier' size='6.6'>The release asset named Nexora.apk on the public repository "
         f"carries digest sha256:{F['apk_sha'].lower()} — the same value as the file on the website.</font>"),
    ]))
    S.append(Spacer(1, 5))
    S.append(notice(
        "<b>Independently checkable.</b> GitHub publishes the SHA-256 digest of every release asset it stores. "
        "The digest of the Nexora.apk asset on the public release page equals the value above, so the binary "
        "distributed from the website and the binary attached to the release are byte-identical, and both are "
        "recorded by a third party that has no interest in this dispute.", bg=colors.HexColor("#F0FBF7"), border=colors.HexColor("#0E9F6E")))
    S.append(Spacer(1, 6))
    S.append(notice(
        "<b>Why this matters.</b> The APK submitted to Amazon is signed with a private key whose certificate "
        "carries the legal name and place of residence of the signatory. Only the holder of that private key "
        "can produce a binary with this signature, and only I hold it. The certificate subject "
        "(&ldquo;O=Ahmed Becetti, L=Chlef, C=DZ&rdquo;) is identical to the identity declared in this document."))

    S.append(Paragraph("5. Evidence held in public registries", H2))
    S.append(Paragraph(
        "The source code, commit history, release artefacts and documentation are public and can be inspected "
        "by Amazon without contacting me:", BODY))
    S.append(kv_table([
        ("Repository", f"<font face='Courier' size='7.6'>{F['repo']}</font> (public)"),
        ("Commit authorship", "All commits authored by GitHub account <b>Ahmedbecett</b>"),
        ("Release history", "v2.6.0 (11 Oct 2026) → v3.0.0 → v3.1.0 → v3.2.0 (12 Oct 2026) → latest (10 Nov 2026)"),
        ("Signing documentation", f"docs/ci/SIGNING.md — records the certificate subject and SHA-256 fingerprint quoted above"),
        ("Screenshots", "store/capture/ — 20 captures of the running v4.4.0 build at 1080×1920"),
    ]))

    S.append(Paragraph("6. Contact details published inside the application", H2))
    S.append(Paragraph(
        f"The address <b>{F['email']}</b> is the single support and legal contact hard-coded into the "
        "application's help, privacy-policy and terms-of-use screens in every one of the 30+ languages it "
        "supports. It is the same address used for this correspondence, and the same person answers it.", BODY))

    S.append(Paragraph("7. Undertaking", H2))
    S.append(Paragraph(
        "I undertake to inform Amazon Developer Support immediately of any change in the ownership of this "
        "application, and to indemnify Amazon against any claim arising from a breach of the statements made "
        "in this declaration. I confirm that the statements above are true and correct to the best of my "
        "knowledge, and I am willing to provide a notarised or officially attested copy of this declaration, "
        "or any further supporting document Amazon requires, upon request.", BODY))

    S.append(Paragraph("8. Summary for the reviewer", H2))
    S.append(Paragraph(
        "The table below restates the essential facts of this declaration so that it can be assessed on its "
        "own, without reading the preceding pages.", BODY))

    summary = Table([
        [Paragraph("<b>Rights holder</b>", st("q", fontSize=8.4, leading=12, alignment=TA_LEFT)),
         Paragraph(f"{F['owner']} — natural person, {F['city']}, {F['country']}. Sole proprietor, no company "
                   "or co-owner involved.", st("a", fontSize=8.4, leading=12, alignment=TA_LEFT))],
        [Paragraph("<b>Protected work</b>", st("q", fontSize=8.4, leading=12, alignment=TA_LEFT)),
         Paragraph(f"{F['app']} — Android / Fire OS application, version {F['version']} (versionCode "
                   f"{F['vcode']}), package <font face='Courier' size='7.6'>{F['package']}</font>.",
                   st("a", fontSize=8.4, leading=12, alignment=TA_LEFT))],
        [Paragraph("<b>Rights claimed</b>", st("q", fontSize=8.4, leading=12, alignment=TA_LEFT)),
         Paragraph("Sole and exclusive copyright in the source code, the user interface, the brand name and "
                   "logo, and all content shipped in the application.",
                   st("a", fontSize=8.4, leading=12, alignment=TA_LEFT))],
        [Paragraph("<b>Basis of rights</b>", st("q", fontSize=8.4, leading=12, alignment=TA_LEFT)),
         Paragraph("Original authorship — the work was created by the rights holder, not acquired, assigned "
                   "or licensed from anyone.", st("a", fontSize=8.4, leading=12, alignment=TA_LEFT))],
        [Paragraph("<b>Third-party interests</b>", st("q", fontSize=8.4, leading=12, alignment=TA_LEFT)),
         Paragraph("None. No licence, royalty, equity, employment relationship or contractor agreement "
                   "affects this work.", st("a", fontSize=8.4, leading=12, alignment=TA_LEFT))],
        [Paragraph("<b>Proof of identity</b>", st("q", fontSize=8.4, leading=12, alignment=TA_LEFT)),
         Paragraph("APK signing certificate subject carries the rights holder's legal name and residence; "
                   "private key held exclusively by the rights holder.",
                   st("a", fontSize=8.4, leading=12, alignment=TA_LEFT))],
    ], colWidths=[38*mm, 132*mm])
    summary.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BACKGROUND", (0,0), (0,-1), SOFT),
        ("GRID", (0,0), (-1,-1), 0.4, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    S.append(summary)

    S.append(Spacer(1, 10))
    S.append(Paragraph("9. Signature", H2))


    sig_cell = Paragraph(
        "<b>Signed by the rights holder</b><br/><br/><br/><br/>"
        "_______________________________________<br/><br/>"
        f"<b>{F['owner']}</b><br/>"
        f"<font size='8' color='#5B6172'>Sole proprietor, {F['app']}</font><br/>"
        f"<font size='8' color='#5B6172'>{F['city']}, {F['country']}</font><br/>"
        f"<font size='8' color='#5B6172'>Date: {F['date']}</font>",
        st("sg", fontSize=9, leading=13, alignment=TA_LEFT))

    att_cell = Paragraph(
        "<b>Attestation (optional)</b><br/><br/>"
        "<font size='8' color='#5B6172'>To be completed only if Amazon requires an officially "
        "attested or notarised document. A sworn translation or an apostille may be affixed "
        "here.</font><br/><br/><br/>"
        "_______________________________________<br/>"
        "<font size='8' color='#5B6172'>Name, capacity and seal of the attesting officer</font><br/><br/>"
        "_______________________________________<br/>"
        "<font size='8' color='#5B6172'>Place and date of attestation</font>",
        st("at", fontSize=9, leading=13, alignment=TA_LEFT))

    sign = Table([[sig_cell, att_cell]], colWidths=[83*mm, 83*mm])
    sign.setStyle(TableStyle([
        ("BOX", (0,0), (0,0), 0.8, LINE),
        ("BOX", (1,0), (1,0), 0.8, LINE),
        ("BACKGROUND", (0,0), (-1,-1), colors.white),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 9),
        ("BOTTOMPADDING", (0,0), (-1,-1), 9),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    S.append(sign)
    S.append(Spacer(1, 8))
    S.append(Paragraph(
        "This declaration is valid once signed in ink by the rights holder. An electronically signed PDF or a "
        "scan of the signed page is acceptable for submission to Amazon Developer Support.", SMALL))

    d = Doc(path); d.doc_title = "DECLARATION OF OWNERSHIP"; d.build(S)

def build_letter(path):
    """نسخة خطاب رسمي على ترويسة — نفس المحتوى بصيغة مراسلة."""
    S = []
    S.append(Spacer(1, 4))
    S.append(Paragraph("Letter of confirmation of intellectual property ownership", H1))
    S.append(Spacer(1, 10))

    S.append(Paragraph(f"<b>From</b><br/>{F['owner']}<br/>{F['city']}, {F['country']}<br/>{F['email']}", BODY))
    S.append(Spacer(1, 4))
    S.append(Paragraph("<b>To</b><br/>Amazon Developer Support<br/>410 Terry Avenue North<br/>Seattle, WA 98109-5210<br/>United States", BODY))
    S.append(Spacer(1, 4))
    S.append(Paragraph(f"<b>Date</b>: {F['date']} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Case</b>: {F['case_id']}", BODY))
    S.append(Spacer(1, 6))
    S.append(HRFlowable(width="100%", thickness=0.8, color=LINE, spaceAfter=10))

    S.append(Paragraph(f"<b>Subject: confirmation of ownership of the {F['app']} application "
                       f"({F['package']})</b>", LEAD))
    S.append(Paragraph("Dear Amazon Developer Support,", BODY))
    S.append(Paragraph(
        "I am writing in reply to your request for documentation demonstrating valid intellectual property "
        "rights in the application I submitted for distribution on the Amazon Appstore. Your message asks for "
        "either a confirmation letter from the intellectual property rights holder bearing a formal signature, "
        "or a copy of the applicable licence agreement.", BODY))
    S.append(Paragraph(
        f"The rights holder for this application is me. I am {F['owner']}, an individual developer resident in "
        f"{F['city']}, {F['country']}. I wrote the application myself: its source code, its interface, its brand "
        "and all of its content. No company, employer, contractor or other third party holds any right, title "
        "or interest in it, and no licence agreement exists because no licence is needed — there is no separate "
        "licensor to license from.", BODY))
    S.append(Paragraph(
        "Accordingly, please accept this letter as the <b>confirmation letter from the intellectual property "
        "rights holder, bearing a formal signature</b>, as contemplated by your request. It is issued on the "
        "letterhead of the rights holder and signed in ink by the rights holder, who is the same individual as "
        "the developer account holder and the signatory of the application's signing certificate.", BODY))

    S.append(Paragraph("Particulars of the application", H2))
    S.append(kv_table([
        ("Application", F["app"]),
        ("Package identifier", F["package"]),
        ("Version", f"{F['version']} (versionCode {F['vcode']})"),
        ("Rights holder", F["owner"]),
        ("Nature of rights", "Sole and exclusive — copyright in source code, interface and brand assets"),
        ("Signing certificate subject", f"<font face='Courier' size='7.2'>{F['cert_subj']}</font>"),
        ("Certificate SHA-256", f"<font face='Courier' size='6.9'>{F['cert_sha']}</font>"),
        ("Public repository", f"<font face='Courier' size='7.5'>{F['repo']}</font>"),
        ("Website", F["sites"][0]),
    ]))

    S.append(Paragraph("Corroboration", H2))
    S.append(Paragraph(
        "The relationship between the parties is simple: there is only one party. The person named on this "
        "letterhead is the developer account holder, the author of the code, the registrant of the public "
        "repository that contains the complete version history, the holder of the private signing key, the "
        "registrant of the AdMob publisher account referenced in the application, and the recipient of the "
        "support address published inside the application. All of these identities resolve to the same "
        "individual, and all of them are independently checkable by Amazon.", BODY))

    S.append(Paragraph(
        "I am happy to supply, on request, a copy of my identity document, a notarised version of this letter, "
        "or a formal attestation issued by a competent authority in Algeria, should either be required to "
        "complete your verification.", BODY))
    S.append(Paragraph("Thank you for your time and for reconsidering this case.", BODY))
    S.append(Spacer(1, 16))
    S.append(Paragraph("Yours faithfully,", BODY))
    S.append(Spacer(1, 26))
    S.append(Paragraph("_______________________________________<br/>"
                       f"<b>{F['owner']}</b><br/>"
                       f"<font size='8' color='#5B6172'>Sole proprietor — {F['app']} · {F['email']}</font>",
                       st("s2", fontSize=9, leading=13, alignment=TA_LEFT)))

    d = Doc(path); d.doc_title = "CONFIRMATION LETTER"; d.build(S)

def build_evidence(path):
    """ملحق الأدلة: قائمة تحقق + أوامر تحقق يستطيع موظف Amazon تشغيلها."""
    S = []
    S.append(Paragraph("Annex — evidence index and verification commands", H1))
    S.append(Paragraph("Attachment to the declaration of ownership of NEXORA AI", st("s", fontSize=9, textColor=MUTED, spaceAfter=10)))

    S.append(Paragraph("A. What is enclosed with this submission", H2))
    items = [
        ("A1", "Declaration of Intellectual Property Ownership — signed by the rights holder (3 pages)"),
        ("A2", "Letter of confirmation on the rights holder's letterhead — signed by the rights holder (2 pages)"),
        ("A3", "Annex — this evidence index with reproducible verification commands"),
        ("A4", "Screenshots of the running application, version 4.4.0, 20 frames at 1080×1920"),
        ("A5", "Signing documentation (docs/ci/SIGNING.md) recording the certificate subject and fingerprint"),
    ]
    S.append(kv_table([(a, b) for a, b in items], widths=(14*mm, 156*mm)))

    S.append(Paragraph("B. Verification commands", H2))
    S.append(Paragraph(
        "Any reviewer can confirm the signing identity and the integrity of the submitted binary directly, "
        "without trusting this document:", BODY))

    cmds = [
        ("# 1. Read the signing certificate of the submitted APK",
         "unzip -p Nexora.apk 'META-INF/CERT.RSA' > cert.der"),
        ("# 2. Print subject and SHA-256 fingerprint",
         "openssl pkcs7 -inform DER -in cert.der -print_certs -noout \\\n    -subject -fingerprint -sha256"),
        ("# 3. Confirm the binary hash",
         "sha256sum Nexora.apk"),
        ("# 4. Confirm the public source history",
         "gh api repos/Ahmedbecett/nexora-social-2026/commits --jq '.[].commit.author.name'"),
    ]
    for label, cmd in cmds:
        S.append(Paragraph(f"<font color='#5B6172'>{label}</font>", st("cl", fontSize=8, leading=11, spaceAfter=2)))
        box = Table([[Paragraph(cmd.replace("&","&amp;").replace("<","&lt;").replace("\n","<br/>"), MONO)]],
                    colWidths=[170*mm])
        box.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F7F8FB")),
            ("BOX", (0,0), (-1,-1), 0.4, LINE),
            ("LEFTPADDING", (0,0), (-1,-1), 8),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ]))
        S.append(box)
        S.append(Spacer(1, 6))

    S.append(Paragraph("C. Reference values", H2))
    S.append(kv_table([
        ("Expected certificate subject", f"<font face='Courier' size='7.2'>{F['cert_subj']}</font>"),
        ("Expected fingerprint (SHA-256)", f"<font face='Courier' size='6.9'>{F['cert_sha']}</font>"),
        ("Expected APK hash (SHA-256)", f"<font face='Courier' size='6.6'>{F['apk_sha']}</font>"),
        ("Expected APK size", F["apk_size"]),
        ("Package identifier", F["package"]),
        ("Version", f"{F['version']} / {F['vcode']}"),
    ]))

    S.append(Paragraph("D. Statement on the absence of a third-party agreement", H2))
    S.append(Paragraph(
        "Amazon's request contemplates a rights holder separate from the developer, whose relationship with the "
        "developer would be defined by a licence agreement or a confirmation letter. In this case no such "
        "separation exists. The developer is the rights holder. A licence agreement between a person and "
        "himself would have no legal meaning, which is why the confirmation letter in attachment A2 is issued "
        "by the rights holder directly. Should Amazon nonetheless require a document in a specific format, I "
        "will obtain and supply it.", BODY))

    d = Doc(path); d.doc_title = "ANNEX — EVIDENCE INDEX"; d.build(S)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Generate the NEXORA AI ownership package.")
    ap.add_argument("--case", default=None,
                    help="Amazon case number, e.g. --case 23265129241 (printed in every header)")
    args = ap.parse_args()
    if args.case:
        F["case_id"] = args.case.strip()
        print(f"رقم القضية: {F['case_id']}")

    p1 = os.path.join(OUT, "1-declaration-of-ownership.pdf")
    p2 = os.path.join(OUT, "2-confirmation-letter.pdf")
    p3 = os.path.join(OUT, "3-annex-evidence-index.pdf")
    build_declaration(p1)
    build_letter(p2)
    build_evidence(p3)
    for p in (p1, p2, p3):
        print(f"{os.path.basename(p):38s} {os.path.getsize(p):>8,} bytes")
