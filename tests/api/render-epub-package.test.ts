import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/api-server.js';

describe('POST /render/epub-package', () => {
  const minimalEpubPackage = {
    files: [
      {
        name: 'EPUB/content.opf',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">test-book-123</dc:identifier>
    <dc:title>Test Book</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapters/chapter-1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`,
      },
      {
        name: 'EPUB/nav.xhtml',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
<nav epub:type="toc" id="toc">
  <h1>Table of Contents</h1>
  <ol>
    <li><a href="chapters/chapter-1.xhtml">Chapter 1</a></li>
  </ol>
</nav>
</body>
</html>`,
      },
      {
        name: 'EPUB/chapters/chapter-1.xhtml',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Chapter 1</title></head>
<body epub:type="bodymatter chapter">
<h1>Chapter 1</h1>
<p>This is the content of chapter 1.</p>
</body>
</html>`,
      },
    ],
    metadata: { title: 'Test Book' },
  };

  it('renders EPUB package to EPUB file', async () => {
    const res = await request(app)
      .post('/render/epub-package')
      .send(minimalEpubPackage)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/epub+zip');
    // EPUB/ZIP magic bytes: PK
    expect(res.body.slice(0, 2).toString()).toBe('PK');
  }, 30000);

  it('includes CSS in EPUB package', async () => {
    const packageWithCss = {
      files: [
        ...minimalEpubPackage.files,
        {
          name: 'EPUB/css/default.css',
          content: 'body { font-family: serif; }',
        },
      ],
      metadata: { title: 'Test With CSS' },
    };

    const res = await request(app)
      .post('/render/epub-package')
      .send(packageWithCss)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/epub+zip');
  }, 30000);

  it('returns error for missing files', async () => {
    const res = await request(app)
      .post('/render/epub-package')
      .send({ metadata: { title: 'Test' } });

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('INVALID_INPUT');
  });

  it('returns error for empty files array', async () => {
    const res = await request(app)
      .post('/render/epub-package')
      .send({ files: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('INVALID_INPUT');
  });

  it('returns error for missing content.opf', async () => {
    const res = await request(app)
      .post('/render/epub-package')
      .send({
        files: [
          { name: 'EPUB/nav.xhtml', content: '<nav/>' },
          { name: 'EPUB/chapters/chapter-1.xhtml', content: '<html/>' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('INVALID_INPUT');
  });

  it('returns error for path traversal attempt', async () => {
    const res = await request(app)
      .post('/render/epub-package')
      .send({
        files: [
          { name: '../../../etc/passwd', content: 'bad' },
          { name: 'EPUB/content.opf', content: '<package/>' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('INVALID_INPUT');
  });
});
