# Vivliostyle REST API Testing Guide

## Overview

This document describes how to test the Vivliostyle REST API endpoints and explains the reasoning behind each validation step.

## Prerequisites

1. Build the project:

   ```bash
   pnpm build
   ```

2. Start the API server:
   ```bash
   pnpm start:api
   # or
   node dist/api-server.js
   ```

## Test Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Test:**

```bash
curl http://localhost:8080/health
```

**Expected Response:**

```json
{ "status": "ok", "uptime": 123.456 }
```

**Why:** Confirms the server is running and responsive. The uptime field helps identify if the server was recently restarted.

---

### 2. PDF Rendering

**Endpoint:** `POST /render/pdf`

**Test:**

```bash
curl -X POST http://localhost:8080/render/pdf \
  -H 'Content-Type: application/json' \
  -d '{"html":"<html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>"}' \
  -o test.pdf
```

**Validation Steps:**

1. **Check file type:**

   ```bash
   file test.pdf
   ```

   Expected: `test.pdf: PDF document, version 1.7`

2. **Verify PDF metadata:**

   ```bash
   pdfinfo test.pdf
   ```

   Expected output includes:

   - `Title: Test` (from HTML title tag)
   - `Creator: Vivliostyle`
   - `Tagged: yes`

3. **Check magic bytes:**
   ```bash
   head -c 5 test.pdf
   ```
   Expected: `%PDF-`

**Why:**

- `file` command uses magic bytes to identify file type, catching JSON error responses
- `pdfinfo` validates internal PDF structure and metadata extraction
- Magic bytes confirm the file wasn't corrupted or truncated

**Common Failure Modes:**

- JSON response instead of PDF = rendering pipeline error
- Empty file = server crash during rendering
- Corrupted PDF = Playwright/Chromium issue

---

### 3. EPUB Rendering

**Endpoint:** `POST /render/epub`

**Test:**

```bash
curl -X POST http://localhost:8080/render/epub \
  -H 'Content-Type: application/json' \
  -d '{"html":"<html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>"}' \
  -o test.epub
```

**Validation Steps:**

1. **Check file type:**

   ```bash
   file test.epub
   ```

   Expected: `test.epub: EPUB document`

2. **Verify ZIP integrity:**

   ```bash
   unzip -t test.epub
   ```

   Expected: `No errors detected in compressed data`

3. **Check EPUB structure:**

   ```bash
   unzip -l test.epub
   ```

   Expected files:

   - `mimetype` (must be first, uncompressed)
   - `META-INF/container.xml`
   - `EPUB/content.opf`
   - `EPUB/*.xhtml` (content files)

4. **Verify mimetype placement (EPUB spec requirement):**
   ```bash
   hexdump -C test.epub | head -3
   ```
   Expected: `mimetype` appears at offset ~30 bytes, containing `application/epub+zip`

**Why:**

- EPUB is a ZIP file with specific structure requirements
- The `mimetype` file MUST be the first entry and stored uncompressed (EPUB spec)
- ZIP integrity check catches truncation or corruption
- Structure check ensures all required EPUB components exist

**Common Failure Modes:**

- JSON response = rendering pipeline error
- "File is not a zip file" = mimetype not first or compressed
- Missing container.xml = incomplete EPUB generation

---

### 4. Error Handling

**Test invalid request:**

```bash
curl -X POST http://localhost:8080/render/pdf \
  -H 'Content-Type: application/json' \
  -d '{"css":"body{}"}'
```

**Expected Response:**

```json
{
  "error": {
    "message": "html field is required and must be a non-empty string",
    "type": "INVALID_INPUT"
  }
}
```

**Test invalid JSON:**

```bash
curl -X POST http://localhost:8080/render/pdf \
  -H 'Content-Type: application/json' \
  -d 'not json'
```

**Expected Response:**

```json
{
  "error": {
    "message": "Invalid JSON in request body",
    "type": "INVALID_INPUT"
  }
}
```

**Why:** Validates that the API returns structured error responses instead of crashing or returning HTML error pages.

---

## Full Test Script

```bash
#!/bin/bash
set -e

API_URL="${API_URL:-http://localhost:8080}"
PASS=0
FAIL=0

test_pass() { echo "✓ $1"; ((PASS++)); }
test_fail() { echo "✗ $1"; ((FAIL++)); }

# Health check
echo "Testing health endpoint..."
HEALTH=$(curl -s "$API_URL/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  test_pass "Health check"
else
  test_fail "Health check: $HEALTH"
fi

# PDF generation
echo "Testing PDF generation..."
curl -s -X POST "$API_URL/render/pdf" \
  -H 'Content-Type: application/json' \
  -d '{"html":"<html><head><title>Test</title></head><body><h1>Test</h1></body></html>"}' \
  -o /tmp/test.pdf

if file /tmp/test.pdf | grep -q "PDF document"; then
  test_pass "PDF generation"
else
  test_fail "PDF generation: $(file /tmp/test.pdf)"
fi

# EPUB generation
echo "Testing EPUB generation..."
curl -s -X POST "$API_URL/render/epub" \
  -H 'Content-Type: application/json' \
  -d '{"html":"<html><head><title>Test</title></head><body><h1>Test</h1></body></html>"}' \
  -o /tmp/test.epub

if file /tmp/test.epub | grep -q "EPUB document"; then
  test_pass "EPUB generation"
else
  test_fail "EPUB generation: $(file /tmp/test.epub)"
fi

if unzip -t /tmp/test.epub > /dev/null 2>&1; then
  test_pass "EPUB ZIP integrity"
else
  test_fail "EPUB ZIP integrity"
fi

# Validation error
echo "Testing validation..."
VALIDATION=$(curl -s -X POST "$API_URL/render/pdf" \
  -H 'Content-Type: application/json' \
  -d '{"css":"body{}"}')

if echo "$VALIDATION" | grep -q '"type":"INVALID_INPUT"'; then
  test_pass "Validation error handling"
else
  test_fail "Validation error handling: $VALIDATION"
fi

# Summary
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && exit 0 || exit 1
```

---

## Troubleshooting

### "File is not a zip file" for EPUB

The EPUB spec requires `mimetype` to be the first file in the archive, stored without compression. If this isn't the case, EPUB readers will reject the file even if the content is valid.

### JSON response instead of binary

Check the response content:

```bash
cat test.pdf
```

If it's JSON with an `error` field, the rendering failed. Common causes:

- Absolute paths in entry config (must be relative)
- Vite server not started for the workspace
- HTML parsing errors

### PDF renders but is blank

Check if the HTML is valid and contains visible content. Vivliostyle requires proper HTML structure.

### Timeout errors

PDF rendering uses Playwright/Chromium which can be slow on first run (downloading browser). Default timeout is 5 minutes. For complex documents, rendering may take longer.

---

## Architecture Notes

### Why Per-Request Vite Servers?

Each render request creates its own Vite server because:

1. **Workspace isolation**: Each request writes HTML/CSS to a temp directory. Vite must serve from that specific directory.

2. **Path resolution**: Vivliostyle's config resolver calculates paths relative to the Vite server's root. A shared server with a different root would produce incorrect paths.

3. **Cleanup**: Per-request servers are cleaned up with the temp workspace, preventing resource leaks.

The trade-off is ~1-2 second overhead per request for Vite startup. For production, consider request queuing or warm server pools.

### Why Relative Paths in Entry Config?

Vivliostyle treats paths starting with `/` as URIs (HTTP resources), not file paths. This is by design for supporting remote content. Local files must use relative paths:

```typescript
// Wrong - treated as URI, fetched via HTTP
entry: [{ path: '/tmp/workspace/index.html' }];

// Correct - resolved as local file
entry: [{ path: 'index.html' }]; // relative to workspaceDir
```
