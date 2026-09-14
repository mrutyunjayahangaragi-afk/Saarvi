import JSZip from "jszip";
import { xml2js, type Element as XmlElement } from "xml-js";

export function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function colIndexToLetter(colIndex: number): string {
  let temp = colIndex + 1;
  let letter = "";
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

export function letterToColIndex(letter: string): number {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col - 1;
}

// ---------------------------------------------------------------------------
// XLSX GENERATOR & PARSER
// ---------------------------------------------------------------------------

export interface XlsxSheetData {
  name: string;
  rows: (string | number | boolean | null | undefined)[][];
}

/**
 * Builds an authentic Microsoft Excel (.xlsx) OpenXML workbook archive.
 */
export async function buildXlsxWorkbook(sheets: XlsxSheetData[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const safeSheets = sheets.length > 0 ? sheets : [{ name: "Sheet1", rows: [] }];

  // 1. Collect unique shared strings
  const stringIndexMap = new Map<string, number>();
  const sharedStrings: string[] = [];

  const getOrAddString = (val: string): number => {
    if (stringIndexMap.has(val)) {
      return stringIndexMap.get(val)!;
    }
    const idx = sharedStrings.length;
    stringIndexMap.set(val, idx);
    sharedStrings.push(val);
    return idx;
  };

  // Pre-scan text cells
  for (const sheet of safeSheets) {
    for (const row of sheet.rows) {
      if (!row) continue;
      for (const cell of row) {
        if (cell !== null && cell !== undefined && typeof cell === "string") {
          getOrAddString(cell);
        }
      }
    }
  }

  // 2. [Content_Types].xml
  let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedString+xml"/>`;

  for (let i = 1; i <= safeSheets.length; i++) {
    contentTypesXml += `\n  <Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }
  contentTypesXml += `\n</Types>`;
  zip.file("[Content_Types].xml", contentTypesXml);

  // 3. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  zip.file("_rels/.rels", rootRelsXml);

  // 4. xl/workbook.xml
  let workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>`;
  for (let i = 0; i < safeSheets.length; i++) {
    const sheet = safeSheets[i];
    const sheetName = escapeXml(sheet.name || `Sheet${i + 1}`);
    workbookXml += `\n    <sheet name="${sheetName}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
  }
  workbookXml += `\n  </sheets>
</workbook>`;
  zip.file("xl/workbook.xml", workbookXml);

  // 5. xl/_rels/workbook.xml.rels
  let wbRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  for (let i = 0; i < safeSheets.length; i++) {
    wbRelsXml += `\n  <Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`;
  }
  const sharedStrRId = `rId${safeSheets.length + 1}`;
  const stylesRId = `rId${safeSheets.length + 2}`;
  wbRelsXml += `\n  <Relationship Id="${sharedStrRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`;
  wbRelsXml += `\n  <Relationship Id="${stylesRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  wbRelsXml += `\n</Relationships>`;
  zip.file("xl/_rels/workbook.xml.rels", wbRelsXml);

  // 6. xl/styles.xml (Standard fonts, borders, header fill)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <!-- 0: Normal regular text -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <!-- 1: Header row (bold + soft light slate background) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <!-- 2: Regular number -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;
  zip.file("xl/styles.xml", stylesXml);

  // 7. xl/sharedStrings.xml
  let sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">`;
  for (const s of sharedStrings) {
    sstXml += `\n  <si><t xml:space="preserve">${escapeXml(s)}</t></si>`;
  }
  sstXml += `\n</sst>`;
  zip.file("xl/sharedStrings.xml", sstXml);

  // 8. xl/worksheets/sheet{N}.xml
  for (let sIdx = 0; sIdx < safeSheets.length; sIdx++) {
    const sheet = safeSheets[sIdx];
    let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView tabSelected="${sIdx === 0 ? "1" : "0"}" workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="16"/>
  <sheetData>`;

    for (let r = 0; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      if (!row || row.length === 0) continue;
      const rowNum = r + 1;
      const isHeader = r === 0;
      sheetXml += `\n    <row r="${rowNum}">`;

      for (let c = 0; c < row.length; c++) {
        const cellVal = row[c];
        if (cellVal === null || cellVal === undefined || cellVal === "") continue;

        const cellRef = `${colIndexToLetter(c)}${rowNum}`;
        const styleIdx = isHeader ? 1 : 0;

        if (typeof cellVal === "number" && !isNaN(cellVal)) {
          sheetXml += `<c r="${cellRef}" s="${styleIdx}"><v>${cellVal}</v></c>`;
        } else if (typeof cellVal === "boolean") {
          sheetXml += `<c r="${cellRef}" t="b" s="${styleIdx}"><v>${cellVal ? 1 : 0}</v></c>`;
        } else {
          const strVal = String(cellVal);
          const strIdx = stringIndexMap.get(strVal) ?? getOrAddString(strVal);
          sheetXml += `<c r="${cellRef}" t="s" s="${styleIdx}"><v>${strIdx}</v></c>`;
        }
      }

      sheetXml += `</row>`;
    }

    sheetXml += `\n  </sheetData>
</worksheet>`;
    zip.file(`xl/worksheets/sheet${sIdx + 1}.xml`, sheetXml);
  }

  return await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Parses an authentic XLSX workbook buffer into structured sheets with rows and cell strings.
 */
export async function parseXlsxWorkbook(data: ArrayBuffer | Uint8Array): Promise<XlsxSheetData[]> {
  const zip = await JSZip.loadAsync(data);

  // 1. Parse Shared Strings (xl/sharedStrings.xml)
  const sharedStrings: string[] = [];
  const sstFile = zip.file("xl/sharedStrings.xml");
  if (sstFile) {
    const sstText = await sstFile.async("text");
    try {
      const parsedSst = xml2js(sstText, { compact: false }) as XmlElement;
      const sstRoot = parsedSst.elements?.find((el) => el.name === "sst" || el.name?.endsWith(":sst"));
      if (sstRoot && sstRoot.elements) {
        for (const si of sstRoot.elements) {
          if (si.name === "si" || si.name?.endsWith(":si")) {
            let strAccum = "";
            const findText = (node: XmlElement) => {
              if (node.name === "t" || node.name?.endsWith(":t")) {
                if (node.elements) {
                  for (const sub of node.elements) {
                    if (sub.type === "text") strAccum += sub.text || "";
                  }
                }
              } else if (node.elements) {
                node.elements.forEach(findText);
              }
            };
            findText(si);
            sharedStrings.push(strAccum);
          }
        }
      }
    } catch {
      // Fallback regex if xml2js encounters non-standard markup
      const matches = sstText.match(/<t[^>]*>([\s\S]*?)<\/t>/g);
      if (matches) {
        for (const m of matches) {
          const raw = m.replace(/^<t[^>]*>/, "").replace(/<\/t>$/, "");
          sharedStrings.push(raw.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
        }
      }
    }
  }

  // 2. Discover sheets from xl/workbook.xml & xl/_rels/workbook.xml.rels
  const sheetMetaList: Array<{ name: string; rId: string; target: string }> = [];
  const wbFile = zip.file("xl/workbook.xml");
  const wbRelsFile = zip.file("xl/_rels/workbook.xml.rels");

  const relsMap = new Map<string, string>();
  if (wbRelsFile) {
    const relsText = await wbRelsFile.async("text");
    const relMatches = relsText.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g);
    for (const match of relMatches) {
      relsMap.set(match[1], match[2]);
    }
  }

  if (wbFile) {
    const wbText = await wbFile.async("text");
    const sheetMatches = wbText.matchAll(/<sheet[^>]+name="([^"]+)"[^>]+r:id="([^"]+)"/g);
    for (const sm of sheetMatches) {
      const name = sm[1];
      const rId = sm[2];
      let target = relsMap.get(rId) || `worksheets/sheet${sheetMetaList.length + 1}.xml`;
      if (!target.startsWith("xl/")) {
        target = `xl/${target.replace(/^\//, "")}`;
      }
      sheetMetaList.push({ name, rId, target });
    }
  }

  // Fallback if sheets could not be read from metadata
  if (sheetMetaList.length === 0) {
    const sheetFiles = Object.keys(zip.files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
    for (let i = 0; i < sheetFiles.length; i++) {
      sheetMetaList.push({
        name: `Sheet${i + 1}`,
        rId: `rId${i + 1}`,
        target: sheetFiles[i],
      });
    }
  }

  // 3. Parse each sheet's rows and cells
  const result: XlsxSheetData[] = [];

  for (const sheetMeta of sheetMetaList) {
    const file = zip.file(sheetMeta.target);
    if (!file) continue;

    const sheetXml = await file.async("text");
    const rowMap = new Map<number, Map<number, string>>();
    let maxCol = 0;
    let maxRow = 0;

    try {
      const parsedSheet = xml2js(sheetXml, { compact: false }) as XmlElement;
      const wsRoot = parsedSheet.elements?.find((el) => el.name === "worksheet" || el.name?.endsWith(":worksheet"));
      const sheetData = wsRoot?.elements?.find((el) => el.name === "sheetData" || el.name?.endsWith(":sheetData"));

      if (sheetData?.elements) {
        for (const rowEl of sheetData.elements) {
          if (rowEl.name !== "row" && !rowEl.name?.endsWith(":row")) continue;
          const rAttr = parseInt(String(rowEl.attributes?.r || "0"), 10);
          const rowNum = isNaN(rAttr) || rAttr < 1 ? rowMap.size + 1 : rAttr;
          maxRow = Math.max(maxRow, rowNum);

          if (!rowMap.has(rowNum)) rowMap.set(rowNum, new Map());
          const currentRow = rowMap.get(rowNum)!;

          if (rowEl.elements) {
            for (const cEl of rowEl.elements) {
              if (cEl.name !== "c" && !cEl.name?.endsWith(":c")) continue;
              const rRef = String(cEl.attributes?.r || "");
              const colLetter = rRef.replace(/[0-9]/g, "");
              const colIdx = colLetter ? letterToColIndex(colLetter) : currentRow.size;
              maxCol = Math.max(maxCol, colIdx);

              const cellType = String(cEl.attributes?.t || "");
              let cellValue = "";

              if (cellType === "inlineStr") {
                const isEl = cEl.elements?.find((el) => el.name === "is" || el.name?.endsWith(":is"));
                const tEl = isEl?.elements?.find((el) => el.name === "t" || el.name?.endsWith(":t"));
                cellValue = tEl?.elements?.[0]?.text ? String(tEl.elements[0].text) : "";
              } else {
                const vEl = cEl.elements?.find((el) => el.name === "v" || el.name?.endsWith(":v"));
                const rawV = vEl?.elements?.[0]?.text ? String(vEl.elements[0].text) : "";

                if (cellType === "s") {
                  const sIdx = parseInt(rawV, 10);
                  cellValue = !isNaN(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : rawV;
                } else if (cellType === "b") {
                  cellValue = rawV === "1" ? "TRUE" : "FALSE";
                } else {
                  cellValue = rawV;
                }
              }

              currentRow.set(colIdx, cellValue);
            }
          }
        }
      }
    } catch {
      // Robust regex fallback
      const rowMatches = sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g);
      for (const rm of rowMatches) {
        const rowNum = parseInt(rm[1], 10);
        maxRow = Math.max(maxRow, rowNum);
        if (!rowMap.has(rowNum)) rowMap.set(rowNum, new Map());
        const currentRow = rowMap.get(rowNum)!;

        const cellMatches = rm[2].matchAll(/<c[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]+)")?[^>]*>(?:<v>([^<]*)<\/v>)?/g);
        for (const cm of cellMatches) {
          const colLetter = cm[1];
          const colIdx = letterToColIndex(colLetter);
          maxCol = Math.max(maxCol, colIdx);
          const cellType = cm[2] || "";
          const rawV = cm[3] || "";
          let cellValue = rawV;
          if (cellType === "s") {
            const sIdx = parseInt(rawV, 10);
            cellValue = !isNaN(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : rawV;
          }
          currentRow.set(colIdx, cellValue);
        }
      }
    }

    // Convert rowMap to dense 2D array
    const denseRows: string[][] = [];
    for (let r = 1; r <= maxRow; r++) {
      const cRow = rowMap.get(r);
      const rowArr: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        rowArr.push(cRow?.get(c) || "");
      }
      denseRows.push(rowArr);
    }

    result.push({
      name: sheetMeta.name,
      rows: denseRows,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// PPTX GENERATOR & PARSER
// ---------------------------------------------------------------------------

export interface PptxSlideElement {
  type: "text" | "image";
  text?: string;
  fontSize?: number; // In points (default 14)
  bold?: boolean;
  italic?: boolean;
  color?: string; // Hex color e.g. "0F172A"
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  imageBytes?: Uint8Array;
  imageFormat?: "png" | "jpeg";
}

export interface PptxSlideData {
  widthPt?: number; // Default 720pt (10 inches)
  heightPt?: number; // Default 540pt (7.5 inches standard)
  elements: PptxSlideElement[];
}

/**
 * Builds an authentic Microsoft PowerPoint (.pptx) OpenXML presentation archive.
 */
export async function buildPptxPresentation(slides: PptxSlideData[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const safeSlides = slides.length > 0 ? slides : [{ elements: [] }];

  // 1. [Content_Types].xml
  let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;

  for (let i = 1; i <= safeSlides.length; i++) {
    contentTypesXml += `\n  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }
  contentTypesXml += `\n</Types>`;
  zip.file("[Content_Types].xml", contentTypesXml);

  // 2. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
  zip.file("_rels/.rels", rootRelsXml);

  // 3. ppt/presentation.xml
  const firstSlide = safeSlides[0];
  const slideWidthEmu = Math.round((firstSlide.widthPt || 720) * 12700);
  const slideHeightEmu = Math.round((firstSlide.heightPt || 540) * 12700);

  let presXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>`;

  for (let i = 0; i < safeSlides.length; i++) {
    presXml += `\n    <p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`;
  }

  presXml += `\n  </p:sldIdLst>
  <p:sldSz cx="${slideWidthEmu}" cy="${slideHeightEmu}" type="screen4x3"/>
  <p:notesSz cx="${slideHeightEmu}" cy="${slideWidthEmu}"/>
</p:presentation>`;
  zip.file("ppt/presentation.xml", presXml);

  // 4. ppt/_rels/presentation.xml.rels
  let presRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`;

  for (let i = 0; i < safeSlides.length; i++) {
    presRelsXml += `\n  <Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`;
  }
  presRelsXml += `\n</Relationships>`;
  zip.file("ppt/_rels/presentation.xml.rels", presRelsXml);

  // 5. ppt/slideMasters/slideMaster1.xml & rels
  const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;
  zip.file("ppt/slideMasters/slideMaster1.xml", slideMasterXml);

  const slideMasterRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", slideMasterRelsXml);

  // 6. ppt/slideLayouts/slideLayout1.xml & rels
  const slideLayoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;
  zip.file("ppt/slideLayouts/slideLayout1.xml", slideLayoutXml);

  const slideLayoutRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", slideLayoutRelsXml);

  // 7. ppt/slides/slide{N}.xml and media
  let globalMediaCount = 0;

  for (let sIdx = 0; sIdx < safeSlides.length; sIdx++) {
    const slide = safeSlides[sIdx];
    const slideRels: Array<{ id: string; target: string; type: string }> = [
      {
        id: "rId1",
        target: "../slideLayouts/slideLayout1.xml",
        type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
      },
    ];

    let shapeTreeXml = ``;
    let shapeId = 2;

    for (const el of slide.elements) {
      const offX = Math.round(Math.max(0, el.xPt) * 12700);
      const offY = Math.round(Math.max(0, el.yPt) * 12700);
      const extCx = Math.round(Math.max(10, el.widthPt) * 12700);
      const extCy = Math.round(Math.max(10, el.heightPt) * 12700);

      if (el.type === "image" && el.imageBytes && el.imageBytes.length > 0) {
        globalMediaCount++;
        const ext = el.imageFormat === "png" ? "png" : "jpeg";
        const mediaFilename = `image${globalMediaCount}.${ext}`;
        zip.file(`ppt/media/${mediaFilename}`, el.imageBytes);

        const imgRId = `rId${slideRels.length + 1}`;
        slideRels.push({
          id: imgRId,
          target: `../media/${mediaFilename}`,
          type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
        });

        shapeTreeXml += `
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${shapeId++}" name="Picture ${globalMediaCount}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="${imgRId}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="${offX}" y="${offY}"/><a:ext cx="${extCx}" cy="${extCy}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>`;
      } else if (el.type === "text" && el.text) {
        const szHundredths = Math.round((el.fontSize || 14) * 100);
        const boldAttr = el.bold ? ` b="1"` : ``;
        const italicAttr = el.italic ? ` i="1"` : ``;
        const colorHex = (el.color || "0F172A").replace("#", "");

        shapeTreeXml += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="TextBox ${shapeId}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${offX}" y="${offY}"/><a:ext cx="${extCx}" cy="${extCy}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" rtlCol="0">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="${szHundredths}"${boldAttr}${italicAttr} dirty="0">
                <a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill>
                <a:latin typeface="Calibri"/>
              </a:rPr>
              <a:t>${escapeXml(el.text)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;
      }
    }

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${shapeTreeXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
    zip.file(`ppt/slides/slide${sIdx + 1}.xml`, slideXml);

    let slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
    for (const rel of slideRels) {
      slideRelsXml += `\n  <Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}"/>`;
    }
    slideRelsXml += `\n</Relationships>`;
    zip.file(`ppt/slides/_rels/slide${sIdx + 1}.xml.rels`, slideRelsXml);
  }

  return await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Parses an authentic PPTX presentation buffer into structured slides, text frames, shapes, and images.
 */
export async function parsePptxPresentation(data: ArrayBuffer | Uint8Array): Promise<PptxSlideData[]> {
  const zip = await JSZip.loadAsync(data);

  // 1. Get slide dimensions from ppt/presentation.xml
  let widthPt = 720;
  let heightPt = 540;
  const presFile = zip.file("ppt/presentation.xml");
  if (presFile) {
    const presText = await presFile.async("text");
    const sldSzMatch = presText.match(/<p:sldSz[^>]+cx="(\d+)"[^>]+cy="(\d+)"/);
    if (sldSzMatch) {
      const cxEmu = parseInt(sldSzMatch[1], 10);
      const cyEmu = parseInt(sldSzMatch[2], 10);
      if (!isNaN(cxEmu) && cxEmu > 0) widthPt = Math.round(cxEmu / 12700);
      if (!isNaN(cyEmu) && cyEmu > 0) heightPt = Math.round(cyEmu / 12700);
    }
  }

  // 2. Discover slides in order
  const slidePaths: string[] = [];
  const presRelsFile = zip.file("ppt/_rels/presentation.xml.rels");
  if (presRelsFile) {
    const relsText = await presRelsFile.async("text");
    const relMatches = relsText.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g);
    const sortedSlideEntries: Array<{ rIdNum: number; path: string }> = [];
    for (const rm of relMatches) {
      const target = rm[2];
      if (/slides\/slide\d+\.xml/i.test(target)) {
        const cleanPath = target.startsWith("ppt/") ? target : `ppt/${target.replace(/^\.\.\//, "").replace(/^\//, "")}`;
        const numMatch = target.match(/slide(\d+)\.xml/i);
        const sNum = numMatch ? parseInt(numMatch[1], 10) : 0;
        sortedSlideEntries.push({ rIdNum: sNum, path: cleanPath });
      }
    }
    sortedSlideEntries.sort((a, b) => a.rIdNum - b.rIdNum);
    for (const entry of sortedSlideEntries) {
      slidePaths.push(entry.path);
    }
  }

  // Fallback if rels failed
  if (slidePaths.length === 0) {
    const allSlideFiles = Object.keys(zip.files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k));
    allSlideFiles.sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
      return na - nb;
    });
    slidePaths.push(...allSlideFiles);
  }

  const slides: PptxSlideData[] = [];

  for (const sPath of slidePaths) {
    const sFile = zip.file(sPath);
    if (!sFile) continue;

    const slideXml = await sFile.async("text");
    const elements: PptxSlideElement[] = [];

    // Check for slide relationships (images)
    const relsPath = sPath.replace(/slide(\d+)\.xml$/i, "_rels/slide$1.xml.rels");
    const relsFile = zip.file(relsPath);
    const imageRelMap = new Map<string, string>();

    if (relsFile) {
      const relsText = await relsFile.async("text");
      const imgMatches = relsText.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g);
      for (const im of imgMatches) {
        if (/image|media/i.test(im[2])) {
          let target = im[2].replace(/^\.\.\//, "ppt/").replace(/^\//, "");
          if (!target.startsWith("ppt/")) target = `ppt/${target}`;
          imageRelMap.set(im[1], target);
        }
      }
    }

    try {
      const parsed = xml2js(slideXml, { compact: false }) as XmlElement;
      const sldRoot = parsed.elements?.find((el) => el.name === "p:sld" || el.name?.endsWith(":sld"));
      const cSld = sldRoot?.elements?.find((el) => el.name === "p:cSld" || el.name?.endsWith(":cSld"));
      const spTree = cSld?.elements?.find((el) => el.name === "p:spTree" || el.name?.endsWith(":spTree"));

      if (spTree?.elements) {
        for (const child of spTree.elements) {
          const tag = child.name?.replace(/^.*:/, "");

          // A. Shape or text box (<p:sp>)
          if (tag === "sp") {
            let xPt = 50;
            let yPt = 50;
            let widthEmuPt = 400;
            let heightEmuPt = 50;

            const spPr = child.elements?.find((el) => el.name === "p:spPr" || el.name?.endsWith(":spPr"));
            const xfrm = spPr?.elements?.find((el) => el.name === "a:xfrm" || el.name?.endsWith(":xfrm"));
            if (xfrm?.elements) {
              const off = xfrm.elements.find((el) => el.name === "a:off" || el.name?.endsWith(":off"));
              const ext = xfrm.elements.find((el) => el.name === "a:ext" || el.name?.endsWith(":ext"));
              if (off?.attributes?.x !== undefined) xPt = Math.round(Number(off.attributes.x) / 12700);
              if (off?.attributes?.y !== undefined) yPt = Math.round(Number(off.attributes.y) / 12700);
              if (ext?.attributes?.cx !== undefined) widthEmuPt = Math.round(Number(ext.attributes.cx) / 12700);
              if (ext?.attributes?.cy !== undefined) heightEmuPt = Math.round(Number(ext.attributes.cy) / 12700);
            }

            const txBody = child.elements?.find((el) => el.name === "p:txBody" || el.name?.endsWith(":txBody"));
            if (txBody?.elements) {
              for (const pEl of txBody.elements) {
                if (pEl.name !== "a:p" && !pEl.name?.endsWith(":p")) continue;
                if (!pEl.elements) continue;

                let paragraphText = "";
                let fontSize = 14;
                let bold = false;
                let italic = false;
                let color = "0F172A";

                for (const rEl of pEl.elements) {
                  if (rEl.name === "a:r" || rEl.name?.endsWith(":r")) {
                    const rPr = rEl.elements?.find((el) => el.name === "a:rPr" || el.name?.endsWith(":rPr"));
                    if (rPr?.attributes?.sz) {
                      const szNum = parseInt(String(rPr.attributes.sz), 10);
                      if (!isNaN(szNum) && szNum > 0) fontSize = Math.round(szNum / 100);
                    }
                    if (rPr?.attributes?.b === "1" || rPr?.attributes?.b === "true") bold = true;
                    if (rPr?.attributes?.i === "1" || rPr?.attributes?.i === "true") italic = true;

                    const solidFill = rPr?.elements?.find((el) => el.name === "a:solidFill" || el.name?.endsWith(":solidFill"));
                    const srgb = solidFill?.elements?.find((el) => el.name === "a:srgbClr" || el.name?.endsWith(":srgbClr"));
                    if (srgb?.attributes?.val) color = String(srgb.attributes.val);

                    const tEl = rEl.elements?.find((el) => el.name === "a:t" || el.name?.endsWith(":t"));
                    if (tEl?.elements?.[0]?.text) {
                      paragraphText += String(tEl.elements[0].text);
                    }
                  }
                }

                if (paragraphText.trim()) {
                  elements.push({
                    type: "text",
                    text: paragraphText,
                    xPt,
                    yPt,
                    widthPt: widthEmuPt,
                    heightPt: heightEmuPt,
                    fontSize,
                    bold,
                    italic,
                    color,
                  });
                }
              }
            }
          }

          // B. Picture (<p:pic>)
          if (tag === "pic") {
            const blipFill = child.elements?.find((el) => el.name === "p:blipFill" || el.name?.endsWith(":blipFill"));
            const blip = blipFill?.elements?.find((el) => el.name === "a:blip" || el.name?.endsWith(":blip"));
            const embedRId = (blip?.attributes?.["r:embed"] || blip?.attributes?.embed || "") as string;

            let xPt = 50;
            let yPt = 50;
            let widthEmuPt = 200;
            let heightEmuPt = 150;

            const spPr = child.elements?.find((el) => el.name === "p:spPr" || el.name?.endsWith(":spPr"));
            const xfrm = spPr?.elements?.find((el) => el.name === "a:xfrm" || el.name?.endsWith(":xfrm"));
            if (xfrm?.elements) {
              const off = xfrm.elements.find((el) => el.name === "a:off" || el.name?.endsWith(":off"));
              const ext = xfrm.elements.find((el) => el.name === "a:ext" || el.name?.endsWith(":ext"));
              if (off?.attributes?.x !== undefined) xPt = Math.round(Number(off.attributes.x) / 12700);
              if (off?.attributes?.y !== undefined) yPt = Math.round(Number(off.attributes.y) / 12700);
              if (ext?.attributes?.cx !== undefined) widthEmuPt = Math.round(Number(ext.attributes.cx) / 12700);
              if (ext?.attributes?.cy !== undefined) heightEmuPt = Math.round(Number(ext.attributes.cy) / 12700);
            }

            const mediaTarget = imageRelMap.get(embedRId);
            if (mediaTarget) {
              const mediaFile = zip.file(mediaTarget);
              if (mediaFile) {
                const imageBytes = await mediaFile.async("uint8array");
                const format = mediaTarget.endsWith(".png") ? "png" : "jpeg";
                elements.push({
                  type: "image",
                  xPt,
                  yPt,
                  widthPt: widthEmuPt,
                  heightPt: heightEmuPt,
                  imageBytes,
                  imageFormat: format,
                });
              }
            }
          }
        }
      }
    } catch {
      // Robust regex fallback for slides
      const textMatches = slideXml.matchAll(/<a:t>([^<]+)<\/a:t>/g);
      let offset = 60;
      for (const tm of textMatches) {
        const txt = tm[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        if (txt.trim()) {
          elements.push({
            type: "text",
            text: txt,
            xPt: 60,
            yPt: offset,
            widthPt: widthPt - 120,
            heightPt: 30,
            fontSize: 14,
          });
          offset += 35;
        }
      }
    }

    slides.push({
      widthPt,
      heightPt,
      elements,
    });
  }

  return slides;
}
