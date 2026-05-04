# ⚠️ ISOLATED PROJECT - DO NOT USE ⚠️

This directory (`server/api/v2`) contains an **ongoing, independent project**.

---

## 🚨🚨🚨 ABSOLUTE RULE: COMPLETE ISOLATION 🚨🚨🚨

### This module MUST be 100% self-contained and self-sufficient.

**EVERY file in this directory MUST ONLY import from within `server/api/v2/`.**

- ✅ `import { useDB } from '../_utils/db'` — CORRECT (within v2)
- ❌ `import { useDB } from '../../../utils/db'` — **FORBIDDEN** (outside v2)
- ❌ `import { anything } from '~/server/utils/...'` — **FORBIDDEN** (outside v2)
- ❌ `import { anything } from '../../somethingElse/...'` — **FORBIDDEN** (outside v2)

**NO EXCEPTIONS. NO IMPORTS OUTSIDE OF `server/api/v2/`. EVER.**

If you need a utility that exists elsewhere in the codebase, **copy it into `_utils/`**. Do NOT import it from outside.

---

### 🚫 CRITICAL RESTRICTIONS (Inbound)
- **DO NOT** import any modules or files from this directory into the main codebase.
- **DO NOT** reference this directory when coding features for the main application.
- **DO NOT** account for its logic or state in the primary sync or API flows.

### 🚫 CRITICAL RESTRICTIONS (Outbound)
- **DO NOT** import anything from outside `server/api/v2/` into this module.
- **DO NOT** use shared utilities, composables, or types from the parent project.
- **DO NOT** rely on any file, module, or dependency that lives outside this directory tree.

---

## Directory Structure

```
server/api/v2/
├── _utils/        ← Runtime utilities (db, auth). Underscore hides from Nitro.
├── _types/        ← TypeScript types/interfaces. Underscore hides from Nitro.
├── _tests/        ← All test files, setup, and test utilities. Underscore hides from Nitro.
├── users/         ← API endpoint handlers (auto-registered by Nitro).
├── doc/           ← API documentation.
└── README.md      ← This file.
```

This project must be treated as completely separate and **COMPLETELY IGNORED** by the rest of the application development.
