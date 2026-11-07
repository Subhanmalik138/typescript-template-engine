import { lex, TemplateError, Token } from "./lexer";

/** AST node kinds. */
export type NodeKind =
  | "text"
  | "variable"
  | "unescaped"
  | "section"
  | "inverted"
  | "partial";

export interface AstNode {
  kind: NodeKind;
  /** Tag name / dotted path, or literal text for "text" nodes. */
  value: string;
  children: AstNode[];
  line: number;
  column: number;
}

function node(kind: NodeKind, value: string, token: Token): AstNode {
  return { kind, value, children: [], line: token.line, column: token.column };
}

const NAME_PATTERN = /^[A-Za-z0-9_.$]+$/;

/** A valid tag name is a dotted path (`user.name`, `.` for the current context). */
export function isValidName(name: string): boolean {
  return name === "." || NAME_PATTERN.test(name);
}

/**
 * Parse a template into an AST.
 *
 * Sections nest; every `{{#name}}` must be closed by a matching
 * `{{/name}}`. Comments and delimiter-change tags are dropped — they
 * carry no runtime meaning. A standalone tag line (a section, partial,
 * comment, or delimiter tag alone on a line, padded only with spaces)
 * has its line break removed, so templates stay readable without
 * leaking blank lines into the output.
 */
export function parse(template: string): AstNode[] {
  const tokens = lex(template);
  const root: AstNode[] = [];
  const stack: AstNode[] = [];
  let current = root;

  const standaloneKinds = new Set(["section", "inverted", "close", "partial", "comment", "delimiter"]);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Standalone-line handling: if a section/partial/comment tag is the
    // only thing on its line, drop the trailing newline from the
    // preceding text node and skip the leading whitespace of the next.
    if (standaloneKinds.has(token.kind)) {
      const prev = current[current.length - 1];
      if (prev && prev.kind === "text") {
        const lastNl = prev.value.lastIndexOf("\n");
        if (lastNl !== -1 && prev.value.slice(lastNl + 1).trim() === "") {
          prev.value = prev.value.slice(0, lastNl + 1);
        }
      }
      const next = tokens[i + 1];
      if (next && next.kind === "text") {
        next.value = next.value.replace(/^[ \t]*\r?\n/, "");
      }
    }

    switch (token.kind) {
      case "text":
        if (token.value.length > 0) current.push(node("text", token.value, token));
        break;

      case "variable":
      case "unescaped":
        if (!isValidName(token.value)) {
          throw new TemplateError(`Invalid variable name "${token.value}"`, token.line, token.column);
        }
        current.push(node(token.kind, token.value, token));
        break;

      case "section":
      case "inverted": {
        if (!isValidName(token.value)) {
          throw new TemplateError(`Invalid section name "${token.value}"`, token.line, token.column);
        }
        const section = node(token.kind, token.value, token);
        current.push(section);
        stack.push(section);
        current = section.children;
        break;
      }

      case "close": {
        const open = stack.pop();
        if (!open) {
          throw new TemplateError(`Closing tag "{{/${token.value}}}" has no matching opener`, token.line, token.column);
        }
        if (open.value !== token.value) {
          throw new TemplateError(
            `Mismatched section: opened "{{#${open.value}}}" (line ${open.line}) but closed with "{{/${token.value}}}"`,
            token.line,
            token.column,
          );
        }
        current = stack.length > 0 ? stack[stack.length - 1].children : root;
        break;
      }

      case "partial":
        if (!isValidName(token.value)) {
          throw new TemplateError(`Invalid partial name "${token.value}"`, token.line, token.column);
        }
        current.push(node("partial", token.value, token));
        break;

      case "comment":
      case "delimiter":
        // No runtime effect.
        break;
    }
  }

  if (stack.length > 0) {
    const open = stack[stack.length - 1];
    throw new TemplateError(`Unclosed section "{{#${open.value}}}"`, open.line, open.column);
  }

  return root;
}
