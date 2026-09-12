import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
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
  const ruleColor = isMinimal ? rgb(1, 1, 1) : isModern ? rgb(0.8, 0.85, 0.95) : rgb(0.85, 0.85, 0.85);

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
    curY -= 12;

    const titleText = isMinimal ? title.toUpperCase() : title.toUpperCase();
    currentPage.drawText(titleText, {
      x: MARGIN_X,
      y: curY,
      size: 11,
      font: fontBold,
      color: headerColor,
    });

    curY -= 4;
    if (!isMinimal) {
      currentPage.drawLine({
        start: { x: MARGIN_X, y: curY },
        end: { x: MARGIN_X + CONTENT_WIDTH, y: curY },
        thickness: 0.75,
        color: ruleColor,
      });
    }
    curY -= 10;
  }

  // ==========================================
  // HEADER SECTION (Contact & Title)
  // ==========================================
  const name = (profile.fullName || "Your Name").trim();
  const title = (profile.professionalTitle || version.targetRole || "").trim();

  // Name
  currentPage.drawText(name.toUpperCase(), {
    x: MARGIN_X,
    y: curY,
    size: isExecutive ? 20 : 18,
    font: fontBold,
    color: headerColor,
  });
  curY -= 16;

  // Title
  if (title) {
    currentPage.drawText(title, {
      x: MARGIN_X,
      y: curY,
      size: 11,
      font: fontOblique,
      color: textMuted,
    });
    curY -= 14;
  }

  // Contact Info Line
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.location) contactParts.push(profile.location);
  if (profile.linkedin) contactParts.push(profile.linkedin.replace(/^https?:\/\//, ""));
  if (profile.github) contactParts.push(profile.github.replace(/^https?:\/\//, ""));
  if (profile.website) contactParts.push(profile.website.replace(/^https?:\/\//, ""));

  const contactLine = contactParts.join("  |  ");
  if (contactLine) {
    const contactLines = wrapText(contactLine, fontRegular, 8.5, CONTENT_WIDTH);
    for (const cline of contactLines) {
      currentPage.drawText(cline, {
        x: MARGIN_X,
        y: curY,
        size: 8.5,
        font: fontRegular,
        color: textDark,
      });
      curY -= 11;
    }
  }

  // Subtle separator below header
  curY -= 4;
  if (!isMinimal) {
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

          // Live / GitHub link or Role
          const linkStr = proj.liveUrl || proj.githubUrl || proj.role || "";
          if (linkStr) {
            const cleanLink = linkStr.replace(/^https?:\/\//, "");
            const lWidth = fontRegular.widthOfTextAtSize(cleanLink, 8.5);
            currentPage.drawText(cleanLink, {
              x: MARGIN_X + CONTENT_WIDTH - lWidth,
              y: curY,
              size: 8.5,
              font: fontRegular,
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
        drawSectionHeader("Leadership & Extracurricular");
        for (const lead of profile.leadership) {
          checkPageBreak(22);
          const leadTitle = `${lead.title}  —  ${lead.organization}`;
          currentPage.drawText(leadTitle, {
            x: MARGIN_X,
            y: curY,
            size: 9.5,
            font: fontBold,
            color: textDark,
          });
          curY -= 12;
          if (lead.description) {
            const lLines = wrapText(lead.description, fontRegular, 8.5, CONTENT_WIDTH);
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
