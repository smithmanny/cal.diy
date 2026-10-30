# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Architecture (architecture)

**Impact:** CRITICAL
**Description:** Domain folders in `apps/web/src/server`, boundaries between domains and workspaces, and where permission checks go.

## 2. Code Quality (quality)

**Impact:** CRITICAL
**Description:** Standards for maintaining high-quality, maintainable code including PR reviews, testing, and accountability.

## 3. Data Layer (data)

**Impact:** HIGH
**Description:** Repositories on Drizzle, column selection, DTOs, and schema migrations that work on D1 and SQLite.

## 4. API Design (api)

**Impact:** HIGH
**Description:** Thin server functions and API routes, and API v2 stability.

## 5. Performance (performance)

**Impact:** HIGH
**Description:** Algorithm complexity, data structure choices, and performance patterns for enterprise scale.

## 6. Testing (testing)

**Impact:** MEDIUM-HIGH
**Description:** Test coverage requirements and testing strategies for maintaining code quality.

## 7. Design Patterns (patterns)

**Impact:** MEDIUM
**Description:** Factories, constructor injection wired in `container.ts`, app integrations, and background work.

## 8. Team Culture (culture)

**Impact:** MEDIUM
**Description:** Engineering culture, accountability, and collaboration standards.

## 9. CI/CD (ci)

**Impact:** HIGH
**Description:** Continuous integration practices, type checking priorities, and git workflow standards.

## 10. Reference (reference)

**Impact:** LOW
**Description:** Informational lookups, file locations, and local development setup guides.
