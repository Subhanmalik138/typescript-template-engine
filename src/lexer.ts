// Token types produced by the lexer. A template is a flat stream of
// TEXT chunks and TAGs; the parser turns that stream into a tree.
export type TokenKind =
  | "text"
  | "variable" // {{name}} — HTML-escaped
  | "unescaped" // {{{name}}} or {{& name}} — raw output
  | "section" // {{#name}}
  | "inverted" // {{^name}}
  | "close" // {{/name}}
  | "partial" // {{>name}}
  | "comment" // {{! ... }} — discarded by the parser
  | "delimiter"; // {{=<% %>=}} — changes the tag delimiters

export interface Token {
  kind: TokenKind;
  /** Raw payload inside the tag (empty for plain text). */
  value: string;
  /** 1-based line where the token starts — used in error messages. */
  line: number;
  /** 1-based column where the token starts. */
  column: number;
}

/** Error thrown for malformed templates, with the offending position. */
export class TemplateError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line = 1, column = 1) {
    super(`${message} (line ${line}, column ${column})`);
    this.name = "TemplateError";
    this.line = line;
    this.column = column;
  }
}

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#x60;",
  "=": "&#x3D;",
  "/": "&#x2F;",
};

/** Escape a value for safe interpolation into HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`=/]/g, (ch) => ESCAPE_MAP[ch]);
}

/**
 * Split a template into tokens.
 *
 * Tags are recognised between the current delimiters (default `{{` / `}}`).
 * A `{{{name}}}` triple-mustache tag is an unescaped variable; whitespace
 * inside a tag is trimmed. Anything that is not a well-formed tag is left
 * as literal text — the parser, not the lexer, decides what is an error.
 */
export function lex(template: string): Token[] {
  const tokens: Token[] = [];
  let open = "{{";
  let close = "}}";
  let pos = 0;
  let line = 1;
  let lineStart = 0;

  const advance = (text: string): void => {
    for (const ch of text) {
      if (ch === "\n") {
        line++;
        lineStart = pos + 1;
      }
      pos++;
    }
  };

  const pushText = (text: string, startLine: number, startCol: number): void => {
    if (text.length > 0) {
      tokens.push({ kind: "text", value: text, line: startLine, column: startCol });
    }
  };

  while (pos < template.length) {
    const openIdx = template.indexOf(open, pos);
    if (openIdx === -1) {
      pushText(template.slice(pos), line, pos - lineStart + 1);
      break;
    }

    // Advance past the preceding text first, so the token's line/column
    // reflect where the tag itself starts, not where the text began.
    pushText(template.slice(pos, openIdx), line, pos - lineStart + 1);
    advance(template.slice(pos, openIdx));
    const tokenLine = line;
    const tokenCol = openIdx - lineStart + 1;

    // Triple mustache: {{{name}}} — the closing delimiter gains a brace.
    const triple = open === "{{" && template.startsWith("{{{", openIdx);
    const tagClose = triple ? close + "}" : close;
    const contentStart = openIdx + (triple ? 3 : open.length);
    const closeIdx = template.indexOf(tagClose, contentStart);

    if (closeIdx === -1) {
      throw new TemplateError(`Unclosed tag starting at`, tokenLine, tokenCol);
    }

    const raw = template.slice(contentStart, closeIdx);
    const content = raw.trim();

    if (content.length === 0) {
      throw new TemplateError("Empty tag", tokenLine, tokenCol);
    }

    const sigil = content[0];
    const body = content.slice(1).trim();

    if (triple) {
      tokens.push({ kind: "unescaped", value: content, line: tokenLine, column: tokenCol });
    } else if (sigil === "#") {
      tokens.push({ kind: "section", value: body, line: tokenLine, column: tokenCol });
    } else if (sigil === "^") {
      tokens.push({ kind: "inverted", value: body, line: tokenLine, column: tokenCol });
    } else if (sigil === "/") {
      tokens.push({ kind: "close", value: body, line: tokenLine, column: tokenCol });
    } else if (sigil === ">") {
      tokens.push({ kind: "partial", value: body, line: tokenLine, column: tokenCol });
    } else if (sigil === "!") {
      tokens.push({ kind: "comment", value: body, line: tokenLine, column: tokenCol });
    } else if (sigil === "&") {
      tokens.push({ kind: "unescaped", value: body, line: tokenLine, column: tokenCol });
    } else if (sigil === "=") {
      // {{=<% %>=}} — switch delimiters for the rest of the template.
      const inner = body.endsWith("=") ? body.slice(0, -1).trim() : body;
      const parts = inner.split(/\s+/);
      if (parts.length !== 2 || parts.some((p) => p.length === 0)) {
        throw new TemplateError("Delimiter change needs two delimiters, e.g. {{=<% %>=}}", tokenLine, tokenCol);
      }
      [open, close] = parts;
      tokens.push({ kind: "delimiter", value: inner, line: tokenLine, column: tokenCol });
    } else {
      tokens.push({ kind: "variable", value: content, line: tokenLine, column: tokenCol });
    }

    advance(template.slice(openIdx, closeIdx + tagClose.length));
  }

  return tokens;
}
