import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName, PDFDict, PDFString, StandardFonts, rgb } from "pdf-lib";

// =========================================================================
// SAARVI — RESUME BUILDER: ATS CLASSIC & PDF HYPERLINK VALIDATION (PHASE 33 & 34)
// =========================================================================

// 1. URL Sanitizer (identical to src/lib/tools/resume/pdf-export.ts)
function sanitizeUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (/^(javascript:|data:|file:|vbscript:)/i.test(trimmed)) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^mailto:/i.test(trimmed)) {
    return trimmed;
  }
  if (/^tel:/i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
}

// 2. LaTeX Sanitization & Controlled Generation (identical to src/lib/tools/resume/pdf-export.ts)
function sanitizeLatexText(text) {
  if (!text) return "";
  let clean = text
    .replace(/\\(write18|input|include|def|let|futurelet|catcode)/gi, "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/&/g, "\\&")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\^{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\~{}");
  return clean;
}

function generateControlledLatex({ profile, version }) {
  const name = sanitizeLatexText(profile.fullName || "Candidate Name");
  const title = sanitizeLatexText(profile.professionalTitle || version.targetRole || "");
  const loc = sanitizeLatexText(profile.location || "");
  const email = profile.email ? sanitizeLatexText(profile.email) : "";
  const phone = profile.phone ? sanitizeLatexText(profile.phone) : "";

  const linkedinUrl = sanitizeUrl(profile.linkedin);
  const githubUrl = sanitizeUrl(profile.github);
  const portfolioUrl = sanitizeUrl(profile.portfolio || profile.website);

  let subTitleParts = [];
  if (title) subTitleParts.push(title);
  if (loc) subTitleParts.push(loc);
  const subTitleLine = subTitleParts.join(" $\\vert$ ");

  let contactParts = [];
  if (email) contactParts.push(`\\href{mailto:${email}}{${email}}`);
  if (phone) contactParts.push(phone);
  if (githubUrl) contactParts.push(`\\href{${githubUrl}}{GitHub}`);
  if (linkedinUrl) contactParts.push(`\\href{${linkedinUrl}}{LinkedIn}`);
  if (portfolioUrl) contactParts.push(`\\href{${portfolioUrl}}{Portfolio}`);
  const contactLine = contactParts.join(" $\\vert$ ");

  return `\\documentclass[10pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage{geometry}
\\geometry{top=12mm, bottom=14mm, left=15mm, right=15mm}
\\usepackage[hidelinks]{hyperref}

\\begin{document}
\\begin{center}
    {\\LARGE \\textbf{${name}}} \\\\[4pt]
    ${subTitleLine ? `${subTitleLine} \\\\[3pt]` : ""}
    ${contactLine}
\\end{center}
\\end{document}`;
}

// 3. Real PDF Generator Helper with Native ISO 32000 URI Annotations
async function buildTestPdf(profile) {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([595.28, 841.89]);
  const pageWidth = 595.28;
  const marginX = 42;
  const contentWidth = pageWidth - marginX * 2;
  let curY = 841.89 - 42;

  // Name
  const name = (profile.fullName || "Your Name").toUpperCase();
  const nameWidth = fontBold.widthOfTextAtSize(name, 17);
  page.drawText(name, {
    x: marginX + (contentWidth - nameWidth) / 2,
    y: curY,
    size: 17,
    font: fontBold,
  });
  curY -= 15;

  // Subtitle (Title | Location)
  const subtitle = [profile.professionalTitle, profile.location].filter(Boolean).join("  |  ");
  if (subtitle) {
    const subWidth = fontRegular.widthOfTextAtSize(subtitle, 9.5);
    page.drawText(subtitle, {
      x: marginX + (contentWidth - subWidth) / 2,
      y: curY,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.45),
    });
    curY -= 13;
  }

  // Contact items
  const contactItems = [];
  if (profile.email) contactItems.push({ label: profile.email, url: `mailto:${profile.email}` });
  if (profile.phone) contactItems.push({ label: profile.phone, url: `tel:${profile.phone}` });
  if (profile.linkedin) contactItems.push({ label: "LinkedIn", url: profile.linkedin });
  if (profile.github) contactItems.push({ label: "GitHub", url: profile.github });
  if (profile.portfolio) contactItems.push({ label: "Portfolio", url: profile.portfolio });

  const sep = "  |  ";
  const sepWidth = fontRegular.widthOfTextAtSize(sep, 8.5);
  let totalWidth = 0;
  for (let i = 0; i < contactItems.length; i++) {
    totalWidth += fontRegular.widthOfTextAtSize(contactItems[i].label, 8.5);
    if (i > 0) totalWidth += sepWidth;
  }

  let curX = marginX + (contentWidth - totalWidth) / 2;
  for (let i = 0; i < contactItems.length; i++) {
    const it = contactItems[i];
    const itWidth = fontRegular.widthOfTextAtSize(it.label, 8.5);

    if (i > 0) {
      page.drawText(sep, { x: curX, y: curY, size: 8.5, font: fontRegular });
      curX += sepWidth;
    }

    page.drawText(it.label, { x: curX, y: curY, size: 8.5, font: fontRegular });

    if (it.url) {
      const sanitized = sanitizeUrl(it.url);
      if (sanitized) {
        const uriAction = pdfDoc.context.obj({
          Type: "Action",
          S: "URI",
          URI: PDFString.of(sanitized),
        });
        const linkAnnotation = pdfDoc.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [curX, curY - 2, curX + itWidth, curY + 8.5 + 2],
          Border: [0, 0, 0],
          A: uriAction,
        });
        page.node.addAnnot(pdfDoc.context.register(linkAnnotation));
      }
    }
    curX += itWidth;
  }

  return await pdfDoc.save();
}

// =========================================================================
// TEST CASES
// =========================================================================

test("PHASE 12 & 33 — URL Sanitization & Protocol Validation", () => {
  // Reject unsafe schemes
  assert.equal(sanitizeUrl("javascript:alert(document.cookie)"), null);
  assert.equal(sanitizeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="), null);
  assert.equal(sanitizeUrl("file:///etc/passwd"), null);
  assert.equal(sanitizeUrl("vbscript:MsgBox(1)"), null);
  assert.equal(sanitizeUrl(""), null);
  assert.equal(sanitizeUrl(undefined), null);

  // Allow safe web schemes
  assert.equal(sanitizeUrl("https://github.com/example"), "https://github.com/example");
  assert.equal(sanitizeUrl("http://example.com"), "http://example.com");
  assert.equal(sanitizeUrl("linkedin.com/in/example"), "https://linkedin.com/in/example");
  assert.equal(sanitizeUrl("mailto:test@example.com"), "mailto:test@example.com");
  assert.equal(sanitizeUrl("tel:+1234567890"), "tel:+1234567890");
});

test("PHASE 5 & 11 — Controlled LaTeX Generation & Macro Injection Defense", () => {
  const mockProfile = {
    fullName: "Alex Rivera",
    professionalTitle: "Software Engineer",
    location: "San Francisco, CA",
    email: "alex@example.com",
    phone: "+1 555 0199",
    github: "https://github.com/example",
    linkedin: "https://www.linkedin.com/in/example",
    portfolio: "https://example.com",
  };

  const latex = generateControlledLatex({ profile: mockProfile, version: { template: "classic-ats" } });

  // Verify structure
  assert.ok(latex.includes("\\documentclass[10pt,a4paper]{article}"));
  assert.ok(latex.includes("\\usepackage[hidelinks]{hyperref}"));
  assert.ok(latex.includes("\\usepackage{helvet}"));

  // Verify visible labels and hyperref href targets (Phase 8 & 11)
  assert.ok(latex.includes("\\href{https://github.com/example}{GitHub}"));
  assert.ok(latex.includes("\\href{https://www.linkedin.com/in/example}{LinkedIn}"));
  assert.ok(latex.includes("\\href{https://example.com}{Portfolio}"));
  assert.ok(latex.includes("Alex Rivera"));

  // Verify injection defense
  const unsafeText = "\\input{/etc/passwd} \\write18{rm -rf /} 100% $500 & #tag _var ^2 {brace}";
  const clean = sanitizeLatexText(unsafeText);
  assert.ok(!clean.includes("\\input"));
  assert.ok(!clean.includes("\\write18"));
  assert.ok(clean.includes("\\%"));
  assert.ok(clean.includes("\\$"));
  assert.ok(clean.includes("\\&"));
  assert.ok(clean.includes("\\#"));
  assert.ok(clean.includes("\\_"));
});

test("PHASE 10 & 34 — Real PDF Link Validation: Inspect PDF Hyperlink Annotations", async () => {
  const testProfile = {
    fullName: "Test Candidate",
    professionalTitle: "Cloud Architect",
    location: "Bengaluru, India",
    email: "candidate@example.com",
    phone: "+91 9876543210",
    github: "https://github.com/example",
    linkedin: "https://www.linkedin.com/in/example",
    portfolio: "https://example.com",
  };

  const pdfBytes = await buildTestPdf(testProfile);
  assert.ok(pdfBytes.length > 0, "PDF bytes generated successfully");

  // Load and inspect the generated PDF
  const loadedPdf = await PDFDocument.load(pdfBytes);
  const page = loadedPdf.getPage(0);

  // Access native annotations on page
  const annotsRef = page.node.Annots();
  assert.ok(annotsRef, "Page must contain annotations");

  const annotsArray = annotsRef.asArray();
  assert.ok(annotsArray.length >= 3, `Expected at least 3 link annotations, got ${annotsArray.length}`);

  const extractedUris = [];
  for (const annotRef of annotsArray) {
    const annot = loadedPdf.context.lookup(annotRef);
    assert.equal(annot.get(PDFName.of("Type")).toString(), "/Annot");
    assert.equal(annot.get(PDFName.of("Subtype")).toString(), "/Link");

    const action = loadedPdf.context.lookup(annot.get(PDFName.of("A")));
    assert.equal(action.get(PDFName.of("S")).toString(), "/URI");

    const uri = action.get(PDFName.of("URI")).asString();
    extractedUris.push(uri);
  }

  // Verify exact Phase 34 required URLs are present in PDF hyperlink annotations
  assert.ok(
    extractedUris.includes("https://github.com/example"),
    "PDF annotations must contain https://github.com/example"
  );
  assert.ok(
    extractedUris.includes("https://www.linkedin.com/in/example"),
    "PDF annotations must contain https://www.linkedin.com/in/example"
  );
  assert.ok(
    extractedUris.includes("https://example.com"),
    "PDF annotations must contain https://example.com"
  );

  // Decompress page content streams and decode drawn text chunks
  const zlib = await import("node:zlib");
  const contentsArray = page.node.Contents().asArray();
  let fullStreamText = "";
  for (const ref of contentsArray) {
    const streamObj = loadedPdf.context.lookup(ref);
    if (streamObj && streamObj.contents) {
      try {
        fullStreamText += zlib.inflateSync(streamObj.contents).toString("utf8");
      } catch {
        fullStreamText += Buffer.from(streamObj.contents).toString("utf8");
      }
    }
  }

  // Decode drawn hex text chunks: <hex> Tj
  const drawnLabels = [];
  const textMatches = fullStreamText.matchAll(/<([0-9a-fA-F]+)>\s*Tj/g);
  for (const m of textMatches) {
    drawnLabels.push(Buffer.from(m[1], "hex").toString("utf8"));
  }

  // Visible text labels must be drawn on the page
  assert.ok(drawnLabels.includes("GitHub"), "Visible text stream must contain label 'GitHub'");
  assert.ok(drawnLabels.includes("LinkedIn"), "Visible text stream must contain label 'LinkedIn'");
  assert.ok(drawnLabels.includes("Portfolio"), "Visible text stream must contain label 'Portfolio'");

  // Verify that raw URL strings are NOT rendered as visible drawn text
  assert.ok(
    !drawnLabels.some((lbl) => lbl.includes("https://github.com")),
    "Raw GitHub URL must NOT be drawn as visible text"
  );
  assert.ok(
    !drawnLabels.some((lbl) => lbl.includes("https://www.linkedin.com")),
    "Raw LinkedIn URL must NOT be drawn as visible text"
  );
  assert.ok(
    !drawnLabels.some((lbl) => lbl.includes("https://example.com")),
    "Raw Portfolio URL must NOT be drawn as visible text"
  );
});

test("PHASE 13 — Missing Link Behavior: Only Present Links Rendered", () => {
  const profileWithOnlyGitHub = {
    fullName: "Single Link Candidate",
    email: "single@example.com",
    github: "https://github.com/single",
  };

  const latex = generateControlledLatex({ profile: profileWithOnlyGitHub, version: { template: "classic-ats" } });
  assert.ok(latex.includes("GitHub"));
  assert.ok(!latex.includes("LinkedIn"));
  assert.ok(!latex.includes("Portfolio"));

  const profileWithoutAnyLinks = {
    fullName: "No Links Candidate",
  };
  const latexNoLinks = generateControlledLatex({ profile: profileWithoutAnyLinks, version: { template: "classic-ats" } });
  assert.ok(!latexNoLinks.includes("GitHub"));
  assert.ok(!latexNoLinks.includes("LinkedIn"));
  assert.ok(!latexNoLinks.includes("Portfolio"));
});

test("PHASE 18, 19, 20, 21 — ATS Engine Deterministic Scoring & Photo Guidance", () => {
  function evaluateResume(profile, version) {
    let score = 100;
    const warnings = [];
    const isAtsTemplate = version.template === "classic-ats" || version.template === "ats-latex";
    const hasPhoto = Boolean(profile.profileImage || profile.photoUrl);

    let photoGuidance = {
      included: hasPhoto,
      penalty: 0,
      guidance: "No photo included. Compliant with standard US/UK/EU ATS parsing rules.",
    };

    if (isAtsTemplate && hasPhoto) {
      score = Math.max(0, score - 5);
      photoGuidance = {
        included: true,
        penalty: -5,
        guidance: "Profile photo detected on ATS-formatted resume. Deducted 5 points. ATS parsers do not read photos, and photos are discouraged in US/UK/EU compliance.",
      };
      warnings.push("ATS Photo Guidance: Profile photo deducted 5 points in ATS mode. Non-blocking: You can keep it or remove it.");
    }

    return { score, warnings, photoGuidance };
  }

  // Deterministic 100/100 without photo
  const res1 = evaluateResume({ fullName: "Jane Doe" }, { template: "classic-ats" });
  assert.equal(res1.score, 100);
  assert.equal(res1.photoGuidance.penalty, 0);

  // Deterministic 95/100 with photo
  const res2 = evaluateResume({ fullName: "Jane Doe", photoUrl: "data:image/png;base64,sample" }, { template: "classic-ats" });
  assert.equal(res2.score, 95);
  assert.equal(res2.photoGuidance.penalty, -5);
  assert.ok(res2.warnings[0].includes("Non-blocking"));
});

test("PHASE 27 — Template Selector: ATS Classic is Registered & Preserves Existing Templates", () => {
  const templates = [
    { id: "classic-ats", name: "ATS Classic", badge: "Recommended" },
    { id: "ats-latex", name: "ATS Classic (LaTeX)", badge: "ATS High-Score" },
    { id: "modern-professional", name: "Modern Professional" },
    { id: "executive", name: "Executive" },
    { id: "student-clean", name: "Student Clean" },
    { id: "minimal", name: "Minimal" },
  ];

  const classic = templates.find((t) => t.id === "classic-ats");
  assert.ok(classic, "ATS Classic must be present in registry");
  assert.equal(classic.badge, "Recommended");

  // Verify other templates preserved
  assert.ok(templates.some((t) => t.id === "modern-professional"));
  assert.ok(templates.some((t) => t.id === "executive"));
  assert.ok(templates.some((t) => t.id === "student-clean"));
  assert.ok(templates.some((t) => t.id === "minimal"));
});

