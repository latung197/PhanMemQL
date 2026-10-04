// Regenerate the Word guide from its reviewed Markdown source: node docs/build-warehouse-word.cjs
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('../Frontend/node_modules/jszip');

const root = __dirname;
const source = path.join(root, 'huong-dan-danh-muc-kho.md');
const target = path.join(root, 'Huong-dan-danh-muc-kho.docx');
const lines = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n').split('\n');
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const run = (s, style = '') => `<w:r>${style}<w:t xml:space="preserve">${xml(s)}</w:t></w:r>`;
const rich = s => {
  const parts = String(s).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map(part => {
    if (part.startsWith('**') && part.endsWith('**')) return run(part.slice(2, -2), '<w:rPr><w:b/></w:rPr>');
    if (part.startsWith('`') && part.endsWith('`')) return run(part.slice(1, -1), '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="164E63"/><w:sz w:val="19"/></w:rPr>');
    return run(part);
  }).join('');
};
const p = (content, style = 'Normal', extra = '') => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${rich(content)}</w:p>`;
const cell = (content, width, header) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${header ? '<w:shd w:fill="DCE9F3"/>' : ''}<w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar></w:tcPr>${p(content, header ? 'TableHeader' : 'TableText')}</w:tc>`;
const table = rows => {
  const widths = rows[0].map(() => Math.floor(9360 / rows[0].length));
  const grid = widths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  const rowXml = rows.map((row, i) => `<w:tr>${row.map((value, j) => cell(value, widths[j], i === 0)).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C9D5"/><w:left w:val="single" w:sz="4" w:color="B8C9D5"/><w:bottom w:val="single" w:sz="4" w:color="B8C9D5"/><w:right w:val="single" w:sz="4" w:color="B8C9D5"/><w:insideH w:val="single" w:sz="4" w:color="D9E1E8"/><w:insideV w:val="single" w:sz="4" w:color="D9E1E8"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowXml}</w:tbl>`;
};
const blocks = [];
let pendingTable = [];
const flushTable = () => {
  if (pendingTable.length) blocks.push(table(pendingTable));
  pendingTable = [];
};
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
    const cells = trimmed.slice(1, -1).split('|').map(x => x.trim());
    if (cells.every(x => /^:?-{3,}:?$/.test(x))) continue;
    pendingTable.push(cells);
    continue;
  }
  flushTable();
  if (!trimmed) continue;
  const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
  if (heading) {
    blocks.push(p(heading[2], heading[1].length === 1 ? 'Title' : `Heading${heading[1].length - 1}`));
  } else if (/^\d+\.\s+/.test(trimmed)) {
    blocks.push(p(trimmed, 'ListParagraph'));
  } else if (trimmed.startsWith('- ')) {
    blocks.push(p('• ' + trimmed.slice(2), 'ListParagraph'));
  } else {
    blocks.push(p(trimmed));
  }
}
flushTable();

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${blocks.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1150" w:right="1160" w:bottom="1150" w:left="1380" w:header="500" w:footer="550"/></w:sectPr></w:body></w:document>`;
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos"/><w:sz w:val="21"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="130" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="320"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:color w:val="17365D"/><w:sz w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="320" w:after="150"/><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="17365D"/><w:sz w:val="27"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="230" w:after="110"/><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="24567A"/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="350" w:hanging="250"/><w:spacing w:after="85"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table Header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="18"/></w:rPr></w:style></w:styles>`;
const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:color w:val="667788"/><w:sz w:val="17"/></w:rPr><w:t>S-ERP · Danh mục kho · Trang </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>`;
const zip = new JSZip();
zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
zip.file('word/document.xml', documentXml);
zip.file('word/styles.xml', stylesXml);
zip.file('word/footer1.xml', footerXml);
zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Danh mục kho — Hướng dẫn sử dụng và quy trình thêm mới</dc:title><dc:creator>S-ERP</dc:creator></cp:coreProperties>`);
zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>`);
zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }).then(buffer => {
  fs.writeFileSync(target, buffer);
  console.log(`${path.basename(target)}: ${buffer.length} bytes, ${blocks.length} content blocks`);
}).catch(error => { console.error(error); process.exitCode = 1; });
