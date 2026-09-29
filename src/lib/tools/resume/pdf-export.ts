import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFString } from "pdf-lib";
import { CareerProfile, ResumeVersion, ResumeTemplateId } from "@/types/career";

export interface GeneratePdfOptions {
  profile: CareerProfile;
  version: ResumeVersion;
}

export interface PdfExportResult {
  pdfBytes: Uint8Array;
  blobUrl: string;
  pageCount: number;
  fitsOnePage: boolean;
}

// Standard A4 dimensions in points
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const MARGIN_TOP = 42;
const MARGIN_BOTTOM = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

/**
 * Strictly sanitizes URLs for ISO 32000 PDF URI annotations.
 * Rejects dangerous schemes like javascript:, data:, vbscript:, file:
 */
export function sanitizeUrl(rawUrl?: string): string | null {
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

export const sanitizePdfUrl = sanitizeUrl;

/**
 * Creates native ISO 32000 URI link annotation on a pdf-lib PDFPage.
 */
function addLinkAnnotation(
  pdfDoc: PDFDocument,
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  url: string
) {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) return;

  try {
    const uriAction = pdfDoc.context.obj({
      Type: "Action",
      S: "URI",
      URI: PDFString.of(sanitized),
    });
    const linkAnnotation = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y - 2, x + width, y + height + 2],
      Border: [0, 0, 0],
      A: uriAction,
    });
    page.node.addAnnot(pdfDoc.context.register(linkAnnotation));
  } catch (err) {
    console.warn("Failed to register PDF link annotation:", err);
  }
}

export async function generateResumePdf(options: GeneratePdfOptions): Promise<PdfExportResult> {
  const { profile, version } = options;
  const template: ResumeTemplateId = version.template || "classic-ats";

  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pages: PDFPage[] = [pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])];
  let currentPage = pages[0];
  let curY = PAGE_HEIGHT - MARGIN_TOP;

  // Color schemes per template
  const isAtsClassic = template === "classic-ats" || template === "ats-latex";
  const isModern = template === "modern-professional";
  const isExecutive = template === "executive";
  const isStudent = template === "student-clean";
  const isMinimal = template === "minimal";

  // Template Accent Colors
  const headerColor = isModern
    ? rgb(0.12, 0.35, 0.8) // Royal Blue
    : isExecutive
    ? rgb(0.08, 0.15, 0.3) // Deep Navy
    : isStudent
    ? rgb(0.05, 0.45, 0.6) // Teal / Deep Cyan
    : rgb(0.1, 0.1, 0.1); // Charcoal ATS Classic & Minimal

  const textDark = rgb(0.12, 0.15, 0.2);
  const textMuted = rgb(0.35, 0.4, 0.45);
  const ruleColor = isMinimal
    ? rgb(1, 1, 1)
    : isAtsClassic
    ? rgb(0.15, 0.15, 0.15) // Crisp dark rule for ATS Classic
    : isModern
    ? rgb(0.8, 0.85, 0.95)
    : rgb(0.85, 0.85, 0.85);

  const linkColor = isModern
    ? rgb(0.12, 0.35, 0.8) // Royal Blue
    : isExecutive
    ? rgb(0.08, 0.25, 0.5) // Navy
    : isStudent
    ? rgb(0.05, 0.45, 0.6) // Teal
    : rgb(0.1, 0.35, 0.75); // ATS Blue

  function checkPageBreak(requiredHeight: number) {
    if (curY - requiredHeight < MARGIN_BOTTOM) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(currentPage);
      curY = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    if (!text) return [];
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  function drawSectionHeader(title: string) {
    checkPageBreak(32);
    curY -= isAtsClassic ? 10 : 12;

    const titleText = title.toUpperCase();
    currentPage.drawText(titleText, {
      x: MARGIN_X,
      y: curY,
      size: isAtsClassic ? 10.5 : 11,
      font: fontBold,
      color: headerColor,
    });

    curY -= isAtsClassic ? 3 : 4;
    if (!isMinimal) {
      currentPage.drawLine({
        start: { x: MARGIN_X, y: curY },
        end: { x: MARGIN_X + CONTENT_WIDTH, y: curY },
        thickness: 0.75,
        color: ruleColor,
      });
    }
    curY -= isAtsClassic ? 8 : 10;
  }

  // ==========================================
  // HEADER SECTION (Contact & Title)
  // ==========================================
  const name = (profile.fullName || "Your Name").trim();
  const title = (profile.professionalTitle || version.targetRole || "").trim();

  // Name (centered for ATS Classic)
  const nameSize = isExecutive ? 20 : isAtsClassic ? 17 : 18;
  const nameWidth = fontBold.widthOfTextAtSize(name.toUpperCase(), nameSize);
  const nameX = isAtsClassic ? MARGIN_X + (CONTENT_WIDTH - nameWidth) / 2 : MARGIN_X;

  currentPage.drawText(name.toUpperCase(), {
    x: nameX,
    y: curY,
    size: nameSize,
    font: fontBold,
    color: headerColor,
  });
  curY -= isAtsClassic ? 15 : 16;

  // Title / Subtitle
  const subtitle = isAtsClassic
    ? [title, profile.location].filter(Boolean).join("  |  ")
    : title;

  if (subtitle) {
    const subSize = isAtsClassic ? 9.5 : 11;
    const subFont = isAtsClassic ? fontRegular : fontOblique;
    const subWidth = subFont.widthOfTextAtSize(subtitle, subSize);
    const subX = isAtsClassic ? MARGIN_X + (CONTENT_WIDTH - subWidth) / 2 : MARGIN_X;

    currentPage.drawText(subtitle, {
      x: subX,
      y: curY,
      size: subSize,
      font: subFont,
      color: textMuted,
    });
    curY -= isAtsClassic ? 13 : 14;
  }

  // Contact Info Line with ISO 32000 Clickable Hyperlink Annotations
  interface ContactItem {
    label: string;
    url?: string;
  }

  const contactItems: ContactItem[] = [];
  if (profile.email) {
    contactItems.push({ label: profile.email, url: `mailto:${profile.email}` });
  }
  if (profile.phone) {
    contactItems.push({ label: profile.phone, url: `tel:${profile.phone}` });
  }
  if (profile.location && !isAtsClassic) {
    contactItems.push({ label: profile.location });
  }
  if (profile.linkedin) {
    contactItems.push({ label: "LinkedIn", url: profile.linkedin });
  }
  if (profile.github) {
    contactItems.push({ label: "GitHub", url: profile.github });
  }
  const portfolioLink = profile.portfolio || profile.website;
  if (portfolioLink) {
    contactItems.push({ label: "Portfolio", url: portfolioLink });
  }
  if (profile.portfolio && profile.website && profile.portfolio !== profile.website) {
    contactItems.push({ label: "Website", url: profile.website });
  }

  if (contactItems.length > 0) {
    const sep = "  |  ";
    const sepWidth = fontRegular.widthOfTextAtSize(sep, 8.5);

    // Calculate total width to center if it fits on a single line
    let totalWidth = 0;
    for (let i = 0; i < contactItems.length; i++) {
      totalWidth += fontRegular.widthOfTextAtSize(contactItems[i].label, 8.5);
      if (i > 0) totalWidth += sepWidth;
    }

    let curX = isAtsClassic && totalWidth <= CONTENT_WIDTH
      ? MARGIN_X + (CONTENT_WIDTH - totalWidth) / 2
      : MARGIN_X;

    for (let i = 0; i < contactItems.length; i++) {
      const item = contactItems[i];
      const itemWidth = fontRegular.widthOfTextAtSize(item.label, 8.5);

      if (i > 0) {
        if (curX + sepWidth + itemWidth > MARGIN_X + CONTENT_WIDTH) {
          curY -= 12;
          curX = MARGIN_X;
        } else {
          currentPage.drawText(sep, {
            x: curX,
            y: curY,
            size: 8.5,
            font: fontRegular,
            color: textMuted,
          });
          curX += sepWidth;
        }
      }

      if (curX + itemWidth > MARGIN_X + CONTENT_WIDTH) {
        curY -= 12;
        curX = MARGIN_X;
      }

      const isLink = Boolean(item.url);
      currentPage.drawText(item.label, {
        x: curX,
        y: curY,
        size: 8.5,
        font: fontRegular,
        color: isLink ? linkColor : textDark,
      });

      if (isLink && item.url) {
        // Subtle hyperlink underline
        currentPage.drawLine({
          start: { x: curX, y: curY - 1 },
          end: { x: curX + itemWidth, y: curY - 1 },
          thickness: 0.5,
          color: linkColor,
        });
        addLinkAnnotation(pdfDoc, currentPage, curX, curY, itemWidth, 8.5, item.url);
      }

      curX += itemWidth;
    }
    curY -= 12;
  }

  // Subtle separator below header (omitted in ATS classic for clean LaTeX styling)
  if (!isMinimal && !isAtsClassic) {
    curY -= 4;
    currentPage.drawLine({
      start: { x: MARGIN_X, y: curY },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: curY },
      thickness: 1,
      color: isModern ? headerColor : ruleColor,
    });
    curY -= 6;
  }

  // ==========================================
  // RENDER DYNAMIC SECTIONS BY SECTION ORDER
  // ==========================================
  const activeSectionOrder = [...version.sectionOrder];

  for (const sectionId of activeSectionOrder) {
    if (!version.enabledSections[sectionId]) continue;

    switch (sectionId) {
      case "summary": {
        const summaryText = (version.summaryOverride || profile.summary || "").trim();
        if (!summaryText) break;

        drawSectionHeader("Professional Summary");
        const lines = wrapText(summaryText, fontRegular, 9.5, CONTENT_WIDTH);
        for (const line of lines) {
          checkPageBreak(13);
          currentPage.drawText(line, {
            x: MARGIN_X,
            y: curY,
            size: 9.5,
            font: fontRegular,
            color: textDark,
          });
          curY -= 13;
        }
        curY -= 4;
        break;
      }

      case "education": {
        const activeEdu = profile.education.filter(
          (e) => version.selectedEducationIds.length === 0 || version.selectedEducationIds.includes(e.id)
        );
        if (activeEdu.length === 0) break;

        drawSectionHeader("Education");
        for (const edu of activeEdu) {
          checkPageBreak(30);

          // Institution & Dates
          currentPage.drawText(edu.institution, {
            x: MARGIN_X,
            y: curY,
            size: 10,
            font: fontBold,
            color: textDark,
          });

          const dateStr = `${edu.startDate || ""} - ${edu.endDate || (edu.current ? "Present" : "")}`.trim();
          if (dateStr !== "-") {
            const dateWidth = fontRegular.widthOfTextAtSize(dateStr, 9);
            currentPage.drawText(dateStr, {
              x: MARGIN_X + CONTENT_WIDTH - dateWidth,
              y: curY,
              size: 9,
              font: fontRegular,
              color: textMuted,
            });
          }
          curY -= 12;

          // Degree & Field & GPA
          let degLine = `${edu.degree} in ${edu.fieldOfStudy}`;
          if (edu.gpa) degLine += `  •  ${edu.gpa}`;
          if (edu.scheme) degLine += `  •  ${edu.scheme}`;

          currentPage.drawText(degLine, {
            x: MARGIN_X,
            y: curY,
            size: 9,
            font: fontRegular,
            color: textDark,
          });
          curY -= 13;

          // Highlights / Coursework
          if (edu.highlights && edu.highlights.length > 0) {
            for (const h of edu.highlights) {
              const hLines = wrapText(`•  ${h}`, fontRegular, 8.5, CONTENT_WIDTH - 12);
              for (const hl of hLines) {
                checkPageBreak(12);
                currentPage.drawText(hl, {
                  x: MARGIN_X + 8,
                  y: curY,
                  size: 8.5,
                  font: fontRegular,
                  color: textDark,
                });
                curY -= 11;
              }
            }
          }
          curY -= 4;
        }
        break;
      }

      case "skills": {
        const activeSkills = profile.skills.filter(
          (s) => version.selectedSkillIds.length === 0 || version.selectedSkillIds.includes(s.id)
        );
        if (activeSkills.length === 0) break;

        drawSectionHeader("Technical Skills");

        // Group by category
        const categorized: Record<string, string[]> = {};
        for (const sk of activeSkills) {
          if (!categorized[sk.category]) categorized[sk.category] = [];
          categorized[sk.category].push(sk.name);
        }

        for (const [cat, items] of Object.entries(categorized)) {
          checkPageBreak(15);
          const catPrefix = `${cat}: `;
          const itemsStr = items.join(", ");
          const fullLine = `${catPrefix}${itemsStr}`;

          const wrappedLines = wrapText(fullLine, fontRegular, 9, CONTENT_WIDTH);
          for (let i = 0; i < wrappedLines.length; i++) {
            checkPageBreak(13);
            if (i === 0) {
              const prefixWidth = fontBold.widthOfTextAtSize(catPrefix, 9);
              currentPage.drawText(catPrefix, {
                x: MARGIN_X,
                y: curY,
                size: 9,
                font: fontBold,
                color: textDark,
              });
              const rem = wrappedLines[0].substring(catPrefix.length);
              currentPage.drawText(rem, {
                x: MARGIN_X + prefixWidth,
                y: curY,
                size: 9,
                font: fontRegular,
                color: textDark,
              });
            } else {
              currentPage.drawText(wrappedLines[i], {
                x: MARGIN_X + 10,
                y: curY,
                size: 9,
                font: fontRegular,
                color: textDark,
              });
            }
            curY -= 13;
          }
        }
        curY -= 4;
        break;
      }

      case "experience": {
        const activeExp = profile.experience.filter(
          (e) => version.selectedExperienceIds.length === 0 || version.selectedExperienceIds.includes(e.id)
        );
        if (activeExp.length === 0) break;

        drawSectionHeader("Experience & Internships");
        for (const exp of activeExp) {
          checkPageBreak(30);

          // Company & Location & Dates
          currentPage.drawText(exp.role, {
            x: MARGIN_X,
            y: curY,
            size: 10,
            font: fontBold,
            color: textDark,
          });

          const expDates = `${exp.startDate || ""} - ${exp.endDate || (exp.current ? "Present" : "")}`.trim();
          if (expDates !== "-") {
            const dWidth = fontRegular.widthOfTextAtSize(expDates, 9);
            currentPage.drawText(expDates, {
              x: MARGIN_X + CONTENT_WIDTH - dWidth,
              y: curY,
              size: 9,
              font: fontRegular,
              color: textMuted,
            });
          }
          curY -= 12;

          let compLine = exp.company;
          if (exp.location) compLine += `  •  ${exp.location}`;
          if (exp.type) compLine += ` (${exp.type})`;

          currentPage.drawText(compLine, {
            x: MARGIN_X,
            y: curY,
            size: 9,
            font: fontOblique,
            color: textMuted,
          });
          curY -= 12;

          // Bullets
          for (const bullet of exp.bullets) {
            const bulletLines = wrapText(`•  ${bullet}`, fontRegular, 8.5, CONTENT_WIDTH - 12);
            for (const bl of bulletLines) {
              checkPageBreak(12);
              currentPage.drawText(bl, {
                x: MARGIN_X + 8,
                y: curY,
                size: 8.5,
                font: fontRegular,
                color: textDark,
              });
              curY -= 11.5;
            }
          }
          curY -= 4;
        }
        break;
      }

      case "projects": {
        const activeProjects = profile.projects.filter(
          (p) => version.selectedProjectIds.length === 0 || version.selectedProjectIds.includes(p.id)
        );
        if (activeProjects.length === 0) break;

        drawSectionHeader("Technical Projects");
        for (const proj of activeProjects) {
          checkPageBreak(30);

          currentPage.drawText(proj.title, {
            x: MARGIN_X,
            y: curY,
            size: 10,
            font: fontBold,
            color: textDark,
          });

          // Role & Links (Live Demo | GitHub)
          const projLinks: Array<{ label: string; url: string }> = [];
          if (proj.liveUrl) projLinks.push({ label: "Live Demo", url: proj.liveUrl });
          if (proj.githubUrl) projLinks.push({ label: "GitHub", url: proj.githubUrl });

          let rightX = MARGIN_X + CONTENT_WIDTH;

          if (projLinks.length > 0) {
            for (let li = projLinks.length - 1; li >= 0; li--) {
              const pLink = projLinks[li];
              const pWidth = fontRegular.widthOfTextAtSize(pLink.label, 8.5);
              rightX -= pWidth;

              currentPage.drawText(pLink.label, {
                x: rightX,
                y: curY,
                size: 8.5,
                font: fontRegular,
                color: linkColor,
              });

              currentPage.drawLine({
                start: { x: rightX, y: curY - 1 },
                end: { x: rightX + pWidth, y: curY - 1 },
                thickness: 0.5,
                color: linkColor,
              });

              addLinkAnnotation(pdfDoc, currentPage, rightX, curY, pWidth, 8.5, pLink.url);

              if (li > 0) {
                const sep = "  |  ";
                const sepW = fontRegular.widthOfTextAtSize(sep, 8.5);
                rightX -= sepW;
                currentPage.drawText(sep, {
                  x: rightX,
                  y: curY,
                  size: 8.5,
                  font: fontRegular,
                  color: textMuted,
                });
              }
            }
          } else if (proj.role) {
            const rWidth = fontOblique.widthOfTextAtSize(proj.role, 8.5);
            currentPage.drawText(proj.role, {
              x: MARGIN_X + CONTENT_WIDTH - rWidth,
              y: curY,
              size: 8.5,
              font: fontOblique,
              color: textMuted,
            });
          }
          curY -= 12;

          // Technologies
          if (proj.technologies && proj.technologies.length > 0) {
            const techLine = `Technologies: ${proj.technologies.join(", ")}`;
            const techWrapped = wrapText(techLine, fontOblique, 8.5, CONTENT_WIDTH);
            for (const tl of techWrapped) {
              checkPageBreak(11);
              currentPage.drawText(tl, {
                x: MARGIN_X,
                y: curY,
                size: 8.5,
                font: fontOblique,
                color: textMuted,
              });
              curY -= 11;
            }
          }

          // Highlights
          for (const h of proj.highlights) {
            const hLines = wrapText(`•  ${h}`, fontRegular, 8.5, CONTENT_WIDTH - 12);
            for (const hl of hLines) {
              checkPageBreak(12);
              currentPage.drawText(hl, {
                x: MARGIN_X + 8,
                y: curY,
                size: 8.5,
                font: fontRegular,
                color: textDark,
              });
              curY -= 11.5;
            }
          }
          curY -= 4;
        }
        break;
      }

      case "certifications": {
        const activeCerts = profile.certifications.filter(
          (c) => version.selectedCertificationIds.length === 0 || version.selectedCertificationIds.includes(c.id)
        );
        if (activeCerts.length === 0) break;

        drawSectionHeader("Certifications");
        for (const cert of activeCerts) {
          checkPageBreak(18);
          const certTitle = `${cert.name}  —  ${cert.issuer}`;
          currentPage.drawText(`•  ${certTitle}`, {
            x: MARGIN_X,
            y: curY,
            size: 9,
            font: fontRegular,
            color: textDark,
          });

          if (cert.date) {
            const dWidth = fontRegular.widthOfTextAtSize(cert.date, 8.5);
            currentPage.drawText(cert.date, {
              x: MARGIN_X + CONTENT_WIDTH - dWidth,
              y: curY,
              size: 8.5,
              font: fontRegular,
              color: textMuted,
            });
          }
          curY -= 13;
        }
        curY -= 4;
        break;
      }

      case "hackathons": {
        const activeHacks = profile.hackathons.filter(
          (h) => version.selectedHackathonIds.length === 0 || version.selectedHackathonIds.includes(h.id)
        );
        if (activeHacks.length === 0) break;

        drawSectionHeader("Hackathons & Competitions");
        for (const hack of activeHacks) {
          checkPageBreak(22);
          let hTitle = `${hack.title} [${hack.outcome}]`;
          if (hack.projectTitle) hTitle += `  •  ${hack.projectTitle}`;

          currentPage.drawText(hTitle, {
            x: MARGIN_X,
            y: curY,
            size: 9.5,
            font: fontBold,
            color: textDark,
          });

          if (hack.date) {
            const dWidth = fontRegular.widthOfTextAtSize(hack.date, 8.5);
            currentPage.drawText(hack.date, {
              x: MARGIN_X + CONTENT_WIDTH - dWidth,
              y: curY,
              size: 8.5,
              font: fontRegular,
              color: textMuted,
            });
          }
          curY -= 12;

          if (hack.technologies && hack.technologies.length > 0) {
            currentPage.drawText(`Technologies: ${hack.technologies.join(", ")}`, {
              x: MARGIN_X + 8,
              y: curY,
              size: 8.5,
              font: fontRegular,
              color: textMuted,
            });
            curY -= 12;
          }
          curY -= 2;
        }
        break;
      }

      case "achievements": {
        const activeAch = profile.achievements.filter(
          (a) => version.selectedAchievementIds.length === 0 || version.selectedAchievementIds.includes(a.id)
        );
        if (activeAch.length === 0) break;

        drawSectionHeader("Honors & Achievements");
        for (const ach of activeAch) {
          checkPageBreak(16);
          let aLine = `•  ${ach.title}`;
          if (ach.issuer) aLine += ` (${ach.issuer})`;
          if (ach.description) aLine += `  —  ${ach.description}`;

          const aLines = wrapText(aLine, fontRegular, 9, CONTENT_WIDTH);
          for (const al of aLines) {
            checkPageBreak(12);
            currentPage.drawText(al, {
              x: MARGIN_X,
              y: curY,
              size: 9,
              font: fontRegular,
              color: textDark,
            });
            curY -= 12;
          }
        }
        curY -= 4;
        break;
      }

      case "leadership": {
        if (!profile.leadership || profile.leadership.length === 0) break;
        drawSectionHeader("Leadership & Activities");
        for (const lead of profile.leadership) {
          checkPageBreak(22);
          const leadTitle = `${lead.title || lead.role || "Lead"}  —  ${lead.organization}${lead.location ? ` (${lead.location})` : ""}`;
          currentPage.drawText(leadTitle, {
            x: MARGIN_X,
            y: curY,
            size: 9.5,
            font: fontBold,
            color: textDark,
          });
          const dates = `${lead.startDate || ""}${lead.endDate ? ` – ${lead.endDate}` : lead.current ? " – Present" : ""}`;
          if (dates.trim()) {
            const dWidth = fontRegular.widthOfTextAtSize(dates, 8.5);
            currentPage.drawText(dates, {
              x: PAGE_WIDTH - MARGIN_X - dWidth,
              y: curY,
              size: 8.5,
              font: fontRegular,
              color: textMuted,
            });
          }
          curY -= 12;
          if (lead.description) {
            const lLines = wrapText(lead.description, fontRegular, 8.5, CONTENT_WIDTH - 8);
            for (const ll of lLines) {
              checkPageBreak(11);
              currentPage.drawText(ll, {
                x: MARGIN_X + 8,
                y: curY,
                size: 8.5,
                font: fontRegular,
                color: textDark,
              });
              curY -= 11;
            }
          }
          curY -= 4;
        }
        break;
      }

      case "volunteering": {
        if (!profile.volunteering || profile.volunteering.length === 0) break;
        drawSectionHeader("Volunteering");
        for (const vol of profile.volunteering) {
          checkPageBreak(22);
          const volTitle = `${vol.role}  —  ${vol.organization}${vol.location ? ` (${vol.location})` : ""}`;
          currentPage.drawText(volTitle, {
            x: MARGIN_X,
            y: curY,
            size: 9.5,
            font: fontBold,
            color: textDark,
          });
          const dates = `${vol.startDate || ""}${vol.endDate ? ` – ${vol.endDate}` : vol.current ? " – Present" : ""}`;
          if (dates.trim()) {
            const dWidth = fontRegular.widthOfTextAtSize(dates, 8.5);
            currentPage.drawText(dates, {
              x: PAGE_WIDTH - MARGIN_X - dWidth,
              y: curY,
              size: 8.5,
              font: fontRegular,
              color: textMuted,
            });
          }
          curY -= 12;
          if (vol.description) {
            const vLines = wrapText(vol.description, fontRegular, 8.5, CONTENT_WIDTH - 8);
            for (const vl of vLines) {
              checkPageBreak(11);
              currentPage.drawText(vl, {
                x: MARGIN_X + 8,
                y: curY,
                size: 8.5,
                font: fontRegular,
                color: textDark,
              });
              curY -= 11;
            }
          }
          curY -= 4;
        }
        break;
      }

      case "languages": {
        if (!profile.languages || profile.languages.length === 0) break;
        drawSectionHeader("Languages");
        checkPageBreak(16);
        const langItems = profile.languages.map(
          (l) => `${l.name}${l.proficiency ? ` — ${l.proficiency}` : ""}`
        );
        const langText = langItems.join("   •   ");
        const lines = wrapText(langText, fontRegular, 9, CONTENT_WIDTH);
        for (const line of lines) {
          checkPageBreak(12);
          currentPage.drawText(line, {
            x: MARGIN_X,
            y: curY,
            size: 9,
            font: fontRegular,
            color: textDark,
          });
          curY -= 12;
        }
        curY -= 4;
        break;
      }

      case "additional": {
        const items = profile.additionalItems || [];
        const rawText = profile.additionalInfo;
        if (items.length === 0 && !rawText) break;
        drawSectionHeader("Additional Information");
        if (items.length > 0) {
          for (const item of items) {
            checkPageBreak(14);
            const line = `•  [${item.type}] ${item.title}: ${item.value}`;
            const wrap = wrapText(line, fontRegular, 8.5, CONTENT_WIDTH);
            for (const wl of wrap) {
              checkPageBreak(11);
              currentPage.drawText(wl, {
                x: MARGIN_X,
                y: curY,
                size: 8.5,
                font: fontRegular,
                color: textDark,
              });
              curY -= 11;
            }
          }
        } else if (rawText) {
          const lines = wrapText(rawText, fontRegular, 8.5, CONTENT_WIDTH);
          for (const line of lines) {
            checkPageBreak(11);
            currentPage.drawText(line, {
              x: MARGIN_X,
              y: curY,
              size: 8.5,
              font: fontRegular,
              color: textDark,
            });
            curY -= 11;
          }
        }
        curY -= 4;
        break;
      }

      default:
        break;
    }
  }

  const pdfBytes = await pdfDoc.save();
  // Safe in browser environment
  let blobUrl = "";
  if (typeof window !== "undefined" && typeof window.Blob !== "undefined" && window.URL) {
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
    blobUrl = window.URL.createObjectURL(blob);
  }

  const pageCount = pages.length;
  const fitsOnePage = pageCount === 1;

  return {
    pdfBytes,
    blobUrl,
    pageCount,
    fitsOnePage,
  };
}

/**
 * Strictly sanitizes plain text strings against LaTeX injection.
 * Strips dangerous compilation commands and escapes reserved syntax characters.
 */
export function sanitizeLatexText(text?: string): string {
  if (!text) return "";
  return text
    .replace(/\\(input|include|write18|def|let|catcode|usepackage|openin|openout)/gi, "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/&/g, "\\&")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

/**
 * Generates official Saarvi ATS Classic LaTeX source code (.tex)
 * Single-column, Helvetica sans-serif, standard headings, native hidelinks hyperref.
 */
export function generateControlledLatex(
  optionsOrProfile: { profile: CareerProfile; version?: ResumeVersion | null } | CareerProfile,
  versionArg?: ResumeVersion | null
): string {
  let profile: CareerProfile;
  let version: ResumeVersion | null | undefined;
  if ("profile" in optionsOrProfile) {
    profile = optionsOrProfile.profile;
    version = optionsOrProfile.version;
  } else {
    profile = optionsOrProfile;
    version = versionArg;
  }

  const name = sanitizeLatexText(profile.fullName || "Candidate Name");
  const title = sanitizeLatexText(version?.targetRole || profile.professionalTitle || "");
  const location = sanitizeLatexText(profile.location || "");
  const email = sanitizeLatexText(profile.email || "");
  const phone = sanitizeLatexText(profile.phone || "");

  const safeLinkedin = sanitizeUrl(profile.linkedin);
  const safeGithub = sanitizeUrl(profile.github);
  const safePortfolio = sanitizeUrl(profile.portfolio || profile.website);

  const contactPieces: string[] = [];
  if (email) contactPieces.push(`\\href{mailto:${email}}{${email}}`);
  if (phone) contactPieces.push(phone);
  if (location) contactPieces.push(location);
  if (safeLinkedin) contactPieces.push(`\\href{${safeLinkedin}}{LinkedIn}`);
  if (safeGithub) contactPieces.push(`\\href{${safeGithub}}{GitHub}`);
  if (safePortfolio) contactPieces.push(`\\href{${safePortfolio}}{Portfolio}`);

  const activeSkills = version
    ? profile.skills.filter((s) => version.selectedSkillIds.length === 0 || version.selectedSkillIds.includes(s.id))
    : profile.skills;

  const activeEdu = version
    ? profile.education.filter((e) => version.selectedEducationIds.length === 0 || version.selectedEducationIds.includes(e.id))
    : profile.education;

  const activeExp = version
    ? profile.experience.filter((e) => version.selectedExperienceIds.length === 0 || version.selectedExperienceIds.includes(e.id))
    : profile.experience;

  const activeProjects = version
    ? profile.projects.filter((p) => version.selectedProjectIds.length === 0 || version.selectedProjectIds.includes(p.id))
    : profile.projects;

  const activeHacks = version
    ? profile.hackathons.filter((h) => version.selectedHackathonIds.length === 0 || version.selectedHackathonIds.includes(h.id))
    : profile.hackathons;

  const activeCerts = version
    ? profile.certifications.filter((c) => version.selectedCertificationIds.length === 0 || version.selectedCertificationIds.includes(c.id))
    : profile.certifications;

  const summaryText = sanitizeLatexText((version?.summaryOverride || profile.summary || "").trim());

  // Group skills into standard ATS-safe categories
  const skillCategoryMap: Record<string, string[]> = {};
  for (const s of activeSkills) {
    const cat = s.category || "Other";
    if (!skillCategoryMap[cat]) skillCategoryMap[cat] = [];
    skillCategoryMap[cat].push(sanitizeLatexText(s.name));
  }

  let skillsLatex = "";
  for (const [cat, skillList] of Object.entries(skillCategoryMap)) {
    if (skillList.length > 0) {
      skillsLatex += `\\noindent \\textbf{${sanitizeLatexText(cat)}:} ${skillList.join(", ")} \\\\[2pt]\n`;
    }
  }

  // Format Education
  let eduLatex = "";
  for (const edu of activeEdu) {
    const dates = sanitizeLatexText(`${edu.startDate || ""} -- ${edu.endDate || (edu.current ? "Present" : "")}`);
    const deg = sanitizeLatexText(`${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ""}`);
    const score = edu.gpa || edu.score ? sanitizeLatexText(`GPA / Score: ${edu.score || edu.gpa}`) : "";
    eduLatex += `\\noindent \\textbf{${sanitizeLatexText(edu.institution)}} \\hfill {\\small ${dates}} \\\\\n` +
      `\\noindent \\textit{${deg}} ${score ? `\\hfill {\\small \\textit{${score}}}` : ""} \\\\[4pt]\n`;
  }

  // Format Experience
  let expLatex = "";
  for (const exp of activeExp) {
    const dates = sanitizeLatexText(`${exp.startDate || ""} -- ${exp.endDate || (exp.current ? "Present" : "")}`);
    expLatex += `\\noindent \\textbf{${sanitizeLatexText(exp.role)}} -- \\textit{${sanitizeLatexText(exp.company)}} \\hfill {\\small ${dates}} \\\\\n` +
      `\\begin{itemize}[leftmargin=1.5em, itemsep=-2pt, topsep=2pt]\n`;
    for (const b of exp.bullets || []) {
      expLatex += `  \\item ${sanitizeLatexText(b)}\n`;
    }
    expLatex += `\\end{itemize}\n\\vspace{4pt}\n`;
  }

  // Format Projects
  let projLatex = "";
  for (const proj of activeProjects) {
    const tech = proj.technologies?.length ? `\\textit{(${sanitizeLatexText(proj.technologies.join(", "))})}` : "";
    const safeLive = sanitizeUrl(proj.liveUrl);
    const safeGit = sanitizeUrl(proj.githubUrl);
    const links: string[] = [];
    if (safeLive) links.push(`\\href{${safeLive}}{Live Demo}`);
    if (safeGit) links.push(`\\href{${safeGit}}{GitHub}`);
    const linkStr = links.length ? `\\hfill {\\small ${links.join(" $\\vert$ ")}}` : "";

    projLatex += `\\noindent \\textbf{${sanitizeLatexText(proj.title)}} ${tech} ${linkStr} \\\\\n` +
      `\\begin{itemize}[leftmargin=1.5em, itemsep=-2pt, topsep=2pt]\n`;
    for (const h of proj.highlights || [proj.description || ""]) {
      if (h) projLatex += `  \\item ${sanitizeLatexText(h)}\n`;
    }
    projLatex += `\\end{itemize}\n\\vspace{4pt}\n`;
  }

  // Format Hackathons & Achievements
  let hackLatex = "";
  for (const hack of activeHacks) {
    const date = hack.date ? sanitizeLatexText(hack.date) : "";
    const outcome = hack.outcome ? sanitizeLatexText(`[${hack.outcome}]`) : "";
    hackLatex += `\\noindent \\textbf{${sanitizeLatexText(hack.title)}} ${outcome} \\hfill {\\small ${date}} \\\\\n`;
    if (hack.description) {
      hackLatex += `\\noindent {\\small ${sanitizeLatexText(hack.description)}} \\\\[3pt]\n`;
    }
  }

  // Format Certifications
  let certLatex = "";
  if (activeCerts.length > 0) {
    certLatex += `\\begin{itemize}[leftmargin=1.5em, itemsep=-2pt, topsep=2pt]\n`;
    for (const cert of activeCerts) {
      const date = cert.date ? `\\hfill {\\small ${sanitizeLatexText(cert.date)}}` : "";
      certLatex += `  \\item \\textbf{${sanitizeLatexText(cert.name)}}${cert.issuer ? ` -- ${sanitizeLatexText(cert.issuer)}` : ""} ${date}\n`;
    }
    certLatex += `\\end{itemize}\n\\vspace{4pt}\n`;
  }

  // Format Leadership
  let leadLatex = "";
  if (profile.leadership && profile.leadership.length > 0) {
    for (const lead of profile.leadership) {
      const dates = sanitizeLatexText(`${lead.startDate || ""} -- ${lead.endDate || (lead.current ? "Present" : "")}`);
      leadLatex += `\\noindent \\textbf{${sanitizeLatexText(lead.title || lead.role || "Lead")}}${lead.organization ? ` -- \\textit{${sanitizeLatexText(lead.organization)}}` : ""}${lead.location ? ` {\\small (${sanitizeLatexText(lead.location)})}` : ""} \\hfill {\\small ${dates}} \\\\\n`;
      if (lead.description) {
        leadLatex += `\\noindent {\\small ${sanitizeLatexText(lead.description)}} \\\\[3pt]\n`;
      }
    }
  }

  // Format Volunteering
  let volLatex = "";
  if (profile.volunteering && profile.volunteering.length > 0) {
    for (const vol of profile.volunteering) {
      const dates = sanitizeLatexText(`${vol.startDate || ""} -- ${vol.endDate || (vol.current ? "Present" : "")}`);
      volLatex += `\\noindent \\textbf{${sanitizeLatexText(vol.role)}}${vol.organization ? ` -- \\textit{${sanitizeLatexText(vol.organization)}}` : ""}${vol.location ? ` {\\small (${sanitizeLatexText(vol.location)})}` : ""} \\hfill {\\small ${dates}} \\\\\n`;
      if (vol.description) {
        volLatex += `\\noindent {\\small ${sanitizeLatexText(vol.description)}} \\\\[3pt]\n`;
      }
    }
  }

  // Format Languages
  let langLatex = "";
  if (profile.languages && profile.languages.length > 0) {
    const langStrings = profile.languages.map(
      (l) => `\\textbf{${sanitizeLatexText(l.name)}}${l.proficiency ? ` (${sanitizeLatexText(l.proficiency)})` : ""}`
    );
    langLatex = `\\noindent ${langStrings.join(" $\\bullet$ ")}\n\\vspace{4pt}\n`;
  }

  // Format Additional Information
  let addLatex = "";
  if (profile.additionalItems && profile.additionalItems.length > 0) {
    addLatex += `\\begin{itemize}[leftmargin=1.5em, itemsep=-2pt, topsep=2pt]\n`;
    for (const item of profile.additionalItems) {
      addLatex += `  \\item \\textbf{[${sanitizeLatexText(item.type)}]} ${sanitizeLatexText(item.title)}: ${sanitizeLatexText(item.value)}\n`;
    }
    addLatex += `\\end{itemize}\n\\vspace{4pt}\n`;
  } else if (profile.additionalInfo) {
    addLatex += `\\noindent {\\small ${sanitizeLatexText(profile.additionalInfo)}}\n\\vspace{4pt}\n`;
  }

  return `% =============================================================================
% Saarvi ATS Classic — Official LaTeX Template
% Deterministic, single-column, ATS-parseable resume generated by Saarvi
% https://saarvi.app
% =============================================================================

\\documentclass[10pt, a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=0.6in]{geometry}
\\usepackage[scaled=0.92]{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[hidelinks]{hyperref}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{parskip}

% Section styling: clean uppercase with horizontal rule
\\titleformat{\\section}{\\large\\bfseries\\uppercase}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{10pt}{6pt}

\\pagestyle{empty}

\\begin{document}

% --- HEADER ---
\\begin{center}
  {\\LARGE \\textbf{${name}}} \\\\[3pt]
  ${title ? `{\\small \\textit{${title}}} \\\\[3pt]` : ""}
  {\\small ${contactPieces.join(" $\\vert$ ")}}
\\end{center}
\\vspace{-4pt}

${summaryText ? `
% --- SUMMARY ---
\\section{Professional Summary}
${summaryText}
` : ""}

${eduLatex ? `
% --- EDUCATION ---
\\section{Education}
${eduLatex}
` : ""}

${skillsLatex ? `
% --- TECHNICAL SKILLS ---
\\section{Technical Skills}
${skillsLatex}
` : ""}

${projLatex ? `
% --- PROJECTS ---
\\section{Key Projects}
${projLatex}
` : ""}

${hackLatex ? `
% --- HACKATHONS & ACHIEVEMENTS ---
\\section{Hackathons \\& Achievements}
${hackLatex}
` : ""}

${certLatex ? `
% --- CERTIFICATIONS ---
\\section{Certifications}
${certLatex}
` : ""}

${leadLatex ? `
% --- LEADERSHIP & ACTIVITIES ---
\\section{Leadership \\& Activities}
${leadLatex}
` : ""}

${volLatex ? `
% --- VOLUNTEERING ---
\\section{Volunteering}
${volLatex}
` : ""}

${langLatex ? `
% --- LANGUAGES ---
\\section{Languages}
${langLatex}
` : ""}

${addLatex ? `
% --- ADDITIONAL INFORMATION ---
\\section{Additional Information}
${addLatex}
` : ""}

${expLatex ? `
% --- EXPERIENCE ---
\\section{Professional Experience}
${expLatex}
` : ""}

\\end{document}
`;
}
