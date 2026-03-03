# Contributing to GreenLight

Thanks for your interest in contributing. GreenLight is source-available under
Apache 2.0 + Commons Clause — you are welcome to use, modify, and contribute,
but commercial resale is not permitted. See [LICENSE](LICENSE) for full terms.

## Getting Started

```bash
git clone https://github.com/NimbleEngineer21/greenlight.git
cd greenlight
npm install
npm run dev
```

Open http://localhost:5173. The app will greet you with a setup wizard on first run,
or you can click "Seed with example data" in Settings to populate realistic demo data.

## Development Commands

```bash
npm run dev          # Dev server with HMR
npm run build        # Production build → dist/
npm run lint         # ESLint (must pass before submitting a PR)
npm test             # Vitest — run all tests
npm run test:watch   # Vitest — watch mode
npm run build:limits # Regenerate FHFA conforming loan limit data from source
```

## Project Structure

```
src/
  lib/         # Pure calculation functions — testable, no side effects
  pages/       # Route-level React components
  components/  # Reusable React components
  hooks/       # Custom React hooks (useStorage, usePrices, useZipLookup)
  data/        # Static data and defaults
  theme.js     # Design tokens (colors, fonts, shared styles)
docs/          # Architecture, PRD, and solution notes
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a full layout and data flow description.

## Coding Conventions

### General

- **No TypeScript** — plain JavaScript (ES2022+)
- **Inline styles** — all styling via `style={{}}` props using tokens from `src/theme.js`
- **Pure functions** — all calculation logic in `src/lib/` must be side-effect-free
- **No new dependencies** — prefer vanilla JS; justify any new npm package in the PR

### State

- All app state lives in a single localStorage object (`"greenlight"`)
- State is managed via `useStorage()` — never write to localStorage directly
- Adding new state fields requires bumping `SCHEMA_VERSION` and adding migration logic
  in `src/lib/storage.js`

### Parsers

Each brokerage parser lives in `src/lib/parsers/`. New parsers should:

1. Throw `TypeError` if input is not a string
2. Strip BOM: `text.replace(/^\uFEFF/, "")`
3. Check `result.errors` after `Papa.parse()`, filter out `FieldMismatch`, surface the rest as warnings
4. Return `{ data, warnings }` — not a plain array
5. Add the provider to `src/data/providers.js`
6. Wire the new platform in `src/pages/Import.jsx`
7. Write inline fixture tests — no real data files in the test suite (see Testing section)

### Components

- Prefer functional components with hooks
- Keep page components thin — push logic into `src/lib/`
- Don't add prop types — rely on clear naming and comments where needed

## Testing

Tests live in `src/lib/__tests__/` and mirror the source files they test.

Run all tests:
```bash
npm test
```

Run a single test file:
```bash
npx vitest run src/lib/__tests__/parsers/computershare.test.js
```

### Test Patterns

**Parser tests use a two-tier approach:**

```js
// Tier 1: Inline fixtures — ALWAYS run in CI
const MINIMAL_CSV = `...`;  // hardcoded string constant

describe("parseXxx — inline fixtures", () => {
  it("parses basic input", () => { ... });
});

// Tier 2: Real data — skipped gracefully when files aren't present
const DATA_DIR = join(process.cwd(), "data/user_xx/provider");
const dataExists = existsSync(DATA_DIR);

describe.skipIf(!dataExists)("parseXxx — real data files", () => {
  it("parses the real CSV", () => { ... });
});
```

Real data files belong in `data/user_[initials]/[provider]/` (gitignored). Tier 1 tests are
what CI runs; Tier 2 tests are for local verification against your own data.

**Calculation tests** are straightforward unit tests — input → expected output, no mocking needed.

## Submitting a Pull Request

1. Fork the repository and create a feature branch
2. Make your changes following the conventions above
3. Ensure all tests pass: `npm test`
4. Ensure lint passes: `npm run lint`
5. Submit a pull request with a clear description of what changed and why

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] New parser: includes inline fixture tests and is registered in `providers.js`
- [ ] New state field: `SCHEMA_VERSION` bumped, migration added
- [ ] No new dependencies added without justification

## Reporting Issues

Open an issue on GitHub with:
- What you were doing
- What you expected to happen
- What actually happened
- Browser and OS version

For data import issues, include the CSV/XLSX format (redact sensitive values — replace numbers
with dummy values like `100.00`) so the parser can be tested against the actual format.
