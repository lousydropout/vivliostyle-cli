# **Vivliostyle REST API Testing Guide**

## Overview

This document describes how to test the Vivliostyle REST API endpoints and explains the reasoning behind each validation step.

Both `/render/pdf` and `/render/epub` use the **full Vivliostyle pipeline**:

```
write temp workspace → resolveTaskConfig() → compile() → (PDF | EPUB)
```

A **single shared Vite server** is started at API boot and is used only to serve the Vivliostyle Viewer UI required for PDF rendering.
Vite does **not** serve user HTML, and it does **not** run per request.

---

# **Prerequisites**

1. Build:

   ```bash
   pnpm build
   ```

2. Start the API server:

   ```bash
   pnpm start:api
   # or
   node dist/api-server.js
   ```

---

# **1. Health Check**

**Endpoint:**
`GET /health`

**Test:**

```bash
curl http://localhost:8080/health
```

**Expected Response:**

```json
{ "status": "ok", "uptime": 123.456 }
```

**Why:**
Verifies the server is running and that the shared Vite server successfully booted during initialization.

---

# **2. PDF Rendering**

**Endpoint:**
`POST /render/pdf`

**Test:**

```bash
curl -X POST http://localhost:8080/render/pdf \
  -H 'Content-Type: application/json' \
  -d '{"html":"<html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>"}' \
  -o test.pdf
```

---

## Validate PDF

### **1. Check file type**

```bash
file test.pdf
```

Expected:
`test.pdf: PDF document`

---

### **2. Verify PDF magic bytes**

```bash
head -c 5 test.pdf
```

Expected:

```
%PDF-
```

---

### **3. Inspect metadata (optional)**

```bash
pdfinfo test.pdf
```

Expected metadata:

- `Title: Test`
- `Creator: Vivliostyle`
- `Tagged: yes`

---

## Why these tests matter

- Ensures Vivliostyle’s **compile → buildPDF → Playwright** pipeline is functioning.
- Confirms the PDF is not corrupted or replaced by a JSON error response.
- Validates that HTML `<title>` correctly propagates into PDF metadata.

---

## Common PDF Issues

| Symptom              | Cause                                            |
| -------------------- | ------------------------------------------------ |
| JSON instead of PDF  | compile() failed or buildPDF() threw error       |
| Blank PDF            | invalid HTML or missing `<body>` content         |
| Slow first render    | Playwright launching Chromium for the first time |
| PDF missing metadata | missing `<title>` tag                            |

---

# **3. EPUB Rendering**

**Endpoint:**
`POST /render/epub`

**Test:**

```bash
curl -X POST http://localhost:8080/render/epub \
  -H 'Content-Type: application/json' \
  -d '{"html":"<html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>"}' \
  -o test.epub
```

---

## Validate EPUB

### **1. Check file type**

```bash
file test.epub
```

Expected:
`test.epub: EPUB document`

---

### **2. Validate ZIP integrity**

```bash
unzip -t test.epub
```

Expected:
`No errors detected in compressed data`

---

### **3. Confirm EPUB structure**

```bash
unzip -l test.epub
```

Expected entries:

- `mimetype` (must be first and uncompressed)
- `META-INF/container.xml`
- `EPUB/content.opf`
- `EPUB/*.xhtml` (compiled document)

---

### **4. Verify mimetype placement**

```bash
hexdump -C test.epub | head -3
```

Expected:

- `mimetype` at the first file in the archive
- Content: `application/epub+zip`

---

## Why these tests matter

EPUB correctness depends entirely on:

- `compile()` generating valid XHTML + manifest files
- `buildWebPublication()` assembling them
- `exportEpub()` producing a compliant archive

If any part fails, readers like Kindle Previewer or iBooks will reject the EPUB.

---

## Common EPUB Issues

| Symptom                  | Cause                                             |
| ------------------------ | ------------------------------------------------- |
| “File is not a zip file” | wrong mimetype placement or compressed `mimetype` |
| Missing container.xml    | compile() did not run or failed                   |
| Corrupted EPUB           | premature cleanup, server crash                   |
| JSON response            | validation error or compile failure               |

---

# **4. Error Handling Tests**

### **Missing HTML:**

```bash
curl -X POST http://localhost:8080/render/pdf \
  -H 'Content-Type: application/json' \
  -d '{"css":"body{}"}'
```

Expected:

```json
{
  "error": {
    "message": "html field is required and must be a non-empty string",
    "type": "INVALID_INPUT"
  }
}
```

---

### **Invalid JSON:**

```bash
curl -X POST http://localhost:8080/render/pdf \
  -H 'Content-Type: application/json' \
  -d 'not-json'
```

Expected:

```json
{
  "error": {
    "message": "Invalid JSON in request body",
    "type": "INVALID_INPUT"
  }
}
```

---

### Why test errors?

- Ensures **consistent JSON error envelopes**
- Prevents HTML stack traces leaking into API responses
- Confirms Express JSON parsing and custom error middleware are wired correctly

---

# **5. Full Automated Test Script**

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

# **6. Architecture Notes (Corrected)**

### ✔ Single Shared Vite Server

Vivliostyle uses Vite **only** to serve its static Viewer UI used by Playwright during PDF rendering.
The user’s HTML/CSS is never served by Vite.

Therefore:

- **One Vite server per API process**
- **No per-request Vite servers**
- **No dynamic ports**
- **No Vite → workspace coupling**

---

### ✔ Per-Request Temp Workspaces

Each render request receives its own workspace:

- input files (`index.html`, `styles.css`)
- compile output (`.vs-out/`)
- generated metadata
- EPUB/PDF artifacts

Workspaces are deleted after each request.

---

### ✔ Relative Paths Required

Vivliostyle treats absolute paths as URLs.
Always use workspace-relative paths:

Correct:

```ts
entry: [{ path: 'index.html' }];
```

Incorrect:

```ts
entry: [{ path: '/tmp/foo/index.html' }];
```

---

### ✔ Correct Rendering Pipelines

#### PDF

```
write → resolveTaskConfig → compile → buildPDF (uses Viewer via Vite)
```

#### EPUB

```
write → resolveTaskConfig → compile → buildWebPublication → exportEpub
```

---
