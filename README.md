# Template Engine

A zero-dependency, Mustache-style template engine for TypeScript. Templates are lexed into tokens, parsed into an AST, and rendered against a plain JavaScript view — with proper error positions, so a broken template tells you exactly which line to fix.

## Features

- `{{variable}}` interpolation with HTML escaping (`{{{raw}}}` / `{{& raw}}` for unescaped output)
- Sections `{{#section}}…{{/section}}`: truthy rendering, object context push, array iteration
- Inverted sections `{{^section}}` for empty / falsy values
- Dotted paths (`{{user.address.city}}`) and `{{.}}` for the current context
- Partials (`{{>name}}`) with a configurable nesting-depth guard
- Lambdas — section lambdas receive the raw section text plus a render helper
- Comments `{{! … }}` and custom delimiters `{{=<% %>=}}`
- Standalone-line handling: a section/partial tag alone on a line doesn't leak a blank line into the output
- `TemplateError` with line and column for every syntax problem
- A `template-engine` CLI for rendering templates from JSON data

## Install

```bash
npm install
npm run build
```

## Library usage

```ts
import { render, compile } from "typescript-template-engine";

// One-shot render
const out = render("Hello, {{name}}!", { name: "Ana" });
// "Hello, Ana!"

// Compile once, render many times (parsed AST is cached)
const welcome = compile("{{#items}}- {{.}}\n{{/items}}");
welcome({ items: ["one", "two"] });
// "- one\n- two\n"
```

Sections iterate arrays and push objects onto the context stack, so inner
names shadow outer ones — and missing keys fall back to the outer context:

```ts
render("{{#user}}{{title}} {{name}}{{/user}}", {
  title: "Dr.",
  user: { name: "Ana" },
});
// "Dr. Ana"
```

Partials and lambdas:

```ts
render("{{>greet}}", { name: "Ana" }, { partials: { greet: "Hi {{name}}!" } });
// "Hi Ana!"

render("{{#shout}}hello {{name}}{{/shout}}", {
  name: "ana",
  shout: (text, renderFn) => renderFn(text).toUpperCase(),
});
// "HELLO ANA"
```

## CLI usage

```bash
# Render a template with JSON data and partials
npx template-engine render examples/welcome.mustache examples/welcome.json \
  --partials examples/partials

# Read the template or the data from stdin with "-"
cat data.json | npx template-engine render template.mustache - --output out.txt

# Validate templates (exits non-zero on the first bad file)
npx template-engine check templates/*.mustache
```

## Syntax reference

| Tag | Meaning |
| --- | --- |
| `{{name}}` | HTML-escaped variable |
| `{{{name}}}`, `{{& name}}` | Unescaped variable |
| `{{#name}}…{{/name}}` | Section: renders once for truthy values, once per item for arrays, with object context push |
| `{{^name}}…{{/name}}` | Inverted section: renders only when the value is falsy or an empty list |
| `{{>name}}` | Partial (looked up in `options.partials`) |
| `{{! comment}}` | Comment, dropped from output |
| `{{=<% %>=}}` | Switch delimiters to `<%` / `%>` for the rest of the template |
| `{{user.name}}`, `{{.}}` | Dotted path, or the current context |

## Design decisions

1. **Three stages, three modules.** The lexer (`src/lexer.ts`) only splits text from tags and tracks line/column; the parser (`src/parser.ts`) builds the AST and validates section nesting; the renderer (`src/renderer.ts`) walks the AST against a context stack. Each stage is independently testable, and a syntax error is reported with its exact position instead of a generic failure.
2. **A context stack, not a merged object.** Lookups walk from the innermost section context outward. That gives Mustache's shadowing semantics without copying or merging objects on every section — iteration over a large list stays cheap.
3. **Templates compile to a reusable AST.** `compile()` parses once and the engine caches parsed templates by source string, so rendering the same template in a loop (an email batch, a static-site build) pays the parse cost once.
4. **Lambdas get raw text, not pre-rendered output.** A section lambda receives the section's source plus a render callback, so it can transform the rendered result (upper-casing, wrapping) — the same hook Mustache provides — instead of being limited to returning a static string.

## Running tests

```bash
npm test
```

38 tests cover the lexer, the parser's error cases, escaping, sections,
partials, lambdas, delimiter changes, and the compile cache.

## Tech stack

- TypeScript (strict mode), zero runtime dependencies
- Jest + ts-jest for tests
