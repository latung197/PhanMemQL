// Markdown → Word (.docx) in the look of the other S-ERP guides. Handles headings (# ## ### ####), paragraphs, bullet and numbered
// lists (one nested level), tables, fenced code blocks, block quotes, **bold**, `code` and [links](url) (kept as plain text).
// Usage: node docs/cong-cu/build-word.cjs <source.md> <target.docx> "<footer title>" "<document title>"
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('../../Frontend/node_modules/jszip');

const [source, target, footerTitle = 'S-ERP', docTitle = 'S-ERP'] = process.argv.slice(2);
if (!source || !target) { console.error('Usage: node docs/cong-cu/build-word.cjs <source.md> <target.docx> "<footer>" "<title>"'); process.exit(1); }
const lines = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n').split('\n');

const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const run = (s, props = '') => `<w:r>${props}<w:t xml:space="preserve">${xml(s)}</w:t></w:r>`;
const CODE = '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:color w:val="164E63"/><w:sz w:val="19"/></w:rPr>';
const rich = raw => {
  const text = String(raw).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // [text](url) → text
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map(part => {
    if (part.startsWith('**') && part.endsWith('**')) return run(part.slice(2, -2), '<w:rPr><w:b/></w:rPr>');
    if (part.startsWith('`') && part.endsWith('`')) return run(part.slice(1, -1), CODE);
    return run(part);
  }).join('');
};
const p = (content, style = 'Normal', extra = '') => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${rich(content)}</w:p>`;

// Code blocks keep every line and its spaces (monospace, light background, no spacing between lines).
const codeLine = (text, first, last) => `<w:p><w:pPr><w:pStyle w:val="CodeBlock"/>${first ? '<w:spacing w:before="80"/>' : ''}${last ? '<w:spacing w:after="160"/>' : ''}</w:pPr>${run(text === '' ? ' ' : text, CODE)}</w:p>`;

// Columns share the 9360 twips of the page in proportion to the longest text of each column (bounded).
const table = rows => {
  const count = rows[0].length;
  const weights = rows[0].map((_, j) => Math.min(60, Math.max(8, ...rows.map(r => String(r[j] ?? '').length))));
  const total = weights.reduce((a, b) => a + b, 0);
  let widths = weights.map(w => Math.max(900, Math.floor(9360 * w / total)));
  const scale = 9360 / widths.reduce((a, b) => a + b, 0);
  widths = widths.map(w => Math.floor(w * scale));
  const cell = (content, width, header) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${header ? '<w:shd w:val="clear" w:fill="DCE9F3"/>' : ''}<w:tcMar><w:top w:w="70" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${p(content, header ? 'TableHeader' : 'TableText')}</w:tc>`;
  const grid = widths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  const body = rows.map((row, i) => `<w:tr>${i === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${Array.from({ length: count }, (_, j) => cell(row[j] ?? '', widths[j], i === 0)).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C9D5"/><w:left w:val="single" w:sz="4" w:color="B8C9D5"/><w:bottom w:val="single" w:sz="4" w:color="B8C9D5"/><w:right w:val="single" w:sz="4" w:color="B8C9D5"/><w:insideH w:val="single" w:sz="4" w:color="D9E1E8"/><w:insideV w:val="single" w:sz="4" w:color="D9E1E8"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`;
};

const blocks = [];
let pendingTable = [];
let inCode = false;
let codeLines = [];
let firstHeading = true;
const flushTable = () => { if (pendingTable.length) blocks.push(table(pendingTable)); pendingTable = []; };

for (const raw of lines) {
  if (raw.trim().startsWith('```')) {
    if (inCode) { codeLines.forEach((l, i) => blocks.push(codeLine(l, i === 0, i === codeLines.length - 1))); codeLines = []; }
    else flushTable();
    inCode = !inCode;
    continue;
  }
  if (inCode) { codeLines.push(raw); continue; }

  const trimmed = raw.trim();
  if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
    const cells = trimmed.slice(1, -1).split(/(?<!\\)\|/).map(x => x.trim().replace(/\\\|/g, '|'));
    if (cells.every(x => /^:?-{3,}:?$/.test(x))) continue;
    pendingTable.push(cells);
    continue;
  }
  flushTable();
  if (!trimmed || /^-{3,}$/.test(trimmed)) continue;

  const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
  const indent = raw.length - raw.trimStart().length;
  if (heading) {
    const level = heading[1].length;
    blocks.push(p(heading[2], firstHeading && level === 1 ? 'Title' : `Heading${Math.max(1, level - 1)}`));
    firstHeading = false;
  } else if (trimmed.startsWith('> ')) {
    blocks.push(p(trimmed.slice(2), 'Quote'));
  } else if (/^\d+\.\s+/.test(trimmed)) {
    blocks.push(p(trimmed, indent > 0 ? 'ListNested' : 'ListParagraph'));
  } else if (/^[-*]\s+/.test(trimmed)) {
    blocks.push(p((indent > 0 ? '– ' : '• ') + trimmed.replace(/^[-*]\s+/, ''), indent > 0 ? 'ListNested' : 'ListParagraph'));
  } else {
    blocks.push(p(trimmed));
  }
}
flushTable();

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${blocks.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1150" w:right="1160" w:bottom="1150" w:left="1380" w:header="500" w:footer="550"/></w:sectPr></w:body></w:document>`;
const style = (id, name, ppr, rpr = '', based = 'Normal') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="${based}"/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos"/><w:sz w:val="21"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="130" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
  + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>`
  + style('Title', 'Title', '<w:spacing w:before="0" w:after="320"/><w:keepNext/>', '<w:b/><w:color w:val="17365D"/><w:sz w:val="34"/>')
  + style('Heading1', 'heading 1', '<w:spacing w:before="320" w:after="150"/><w:keepNext/><w:outlineLvl w:val="0"/>', '<w:b/><w:color w:val="17365D"/><w:sz w:val="27"/>')
  + style('Heading2', 'heading 2', '<w:spacing w:before="230" w:after="110"/><w:keepNext/><w:outlineLvl w:val="1"/>', '<w:b/><w:color w:val="24567A"/><w:sz w:val="23"/>')
  + style('Heading3', 'heading 3', '<w:spacing w:before="180" w:after="90"/><w:keepNext/><w:outlineLvl w:val="2"/>', '<w:b/><w:color w:val="2F6F95"/><w:sz w:val="21"/>')
  + style('ListParagraph', 'List Paragraph', '<w:ind w:left="350" w:hanging="250"/><w:spacing w:after="85"/>')
  + style('ListNested', 'List Nested', '<w:ind w:left="700" w:hanging="250"/><w:spacing w:after="70"/>')
  + style('Quote', 'Quote', '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="7FA6C0"/></w:pBdr><w:shd w:val="clear" w:fill="F1F6FA"/><w:ind w:left="240" w:right="120"/><w:spacing w:before="60" w:after="140"/>', '<w:color w:val="2E4A5E"/>')
  + style('CodeBlock', 'Code Block', '<w:shd w:val="clear" w:fill="F3F6F8"/><w:ind w:left="120" w:right="120"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>', '<w:sz w:val="17"/>')
  + style('TableHeader', 'Table Header', '<w:spacing w:after="0"/>', '<w:b/><w:sz w:val="18"/>')
  + style('TableText', 'Table Text', '<w:spacing w:after="0"/>', '<w:sz w:val="18"/>')
  + `</w:styles>`;
const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:color w:val="667788"/><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve">${xml(footerTitle)} · Trang </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>`;

const zip = new JSZip();
zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
zip.file('word/document.xml', documentXml);
zip.file('word/styles.xml', stylesXml);
zip.file('word/footer1.xml', footerXml);
zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(docTitle)}</dc:title><dc:creator>S-ERP</dc:creator></cp:coreProperties>`);
zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>`);
zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }).then(buffer => {
  fs.writeFileSync(target, buffer);
  console.log(`${path.basename(target)}: ${buffer.length} bytes, ${blocks.length} content blocks`);
}).catch(error => { console.error(error); process.exitCode = 1; });
