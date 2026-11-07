import { escapeHtml } from "./lexer";
import { AstNode } from "./parser";

/** Any value a template can interpolate: primitives, objects, arrays, lambdas. */
export type ViewValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ViewObject
  | ViewValue[]
  | Lambda;
export type ViewObject = { [key: string]: ViewValue };
export type View = ViewObject | ViewValue;

/** A lambda is called with the raw section text and a render helper. */
export type Lambda = (text: string, render: (text: string) => string) => string;

/** Named partial templates, resolved at render time. */
export type Partials = Record<string, string>;

export interface RenderOptions {
  partials?: Partials;
  /** Cap how deep partials may nest, so a self-referencing partial cannot loop forever. */
  maxPartialDepth?: number;
}

const DEFAULT_MAX_PARTIAL_DEPTH = 10;

/**
 * A stack of contexts. Lookups walk from the innermost context outward,
 * so a section over an object shadows outer names with its own keys —
 * the same scoping rule Mustache uses.
 */
export class Context {
  private readonly stack: View[];

  constructor(view: View) {
    this.stack = [view];
  }

  private constructorFrom(stack: View[]) {
    const ctx = Object.create(Context.prototype) as Context;
    (ctx as unknown as { stack: View[] }).stack = stack;
    return ctx;
  }

  push(view: View): Context {
    return this.constructorFrom([...this.stack, view]);
  }

  /** Resolve a dotted path (`user.address.city`, or `.` for the context itself). */
  lookup(name: string): ViewValue {
    if (name === ".") {
      return this.stack[this.stack.length - 1] as ViewValue;
    }
    const parts = name.split(".");
    for (let i = this.stack.length - 1; i >= 0; i--) {
      let value: ViewValue = this.stack[i] as ViewValue;
      let found = true;
      for (const part of parts) {
        if (value !== null && typeof value === "object" && part in (value as ViewObject)) {
          value = (value as ViewObject)[part];
        } else {
          found = false;
          break;
        }
      }
      if (found) return value;
    }
    return undefined;
  }
}

/** Render already-parsed nodes against a context. */
export function renderNodes(
  nodes: AstNode[],
  context: Context,
  renderTemplate: (template: string, ctx: Context, depth: number) => string,
  options: RenderOptions,
  depth: number,
): string {
  let out = "";

  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        out += node.value;
        break;

      case "variable": {
        const value = context.lookup(node.value);
        if (value === undefined || value === null) break;
        if (typeof value === "function") {
          out += escapeHtml(String((value as Lambda).call(context.lookup("."), "", (t) => renderTemplate(t, context, depth))));
        } else {
          out += escapeHtml(String(value));
        }
        break;
      }

      case "unescaped": {
        const value = context.lookup(node.value);
        if (value === undefined || value === null) break;
        if (typeof value === "function") {
          out += String((value as Lambda).call(context.lookup("."), "", (t) => renderTemplate(t, context, depth)));
        } else {
          out += String(value);
        }
        break;
      }

      case "section": {
        const value = context.lookup(node.value);
        out += renderSection(node, value, context, renderTemplate, options, depth);
        break;
      }

      case "inverted": {
        const value = context.lookup(node.value);
        const falsy =
          value === undefined ||
          value === null ||
          value === false ||
          (Array.isArray(value) && value.length === 0);
        if (falsy) {
          out += renderNodes(node.children, context, renderTemplate, options, depth);
        }
        break;
      }

      case "partial": {
        const partial = options.partials?.[node.value];
        if (partial === undefined) break; // unknown partials render as nothing
        if (depth >= (options.maxPartialDepth ?? DEFAULT_MAX_PARTIAL_DEPTH)) {
          throw new Error(`Partial "${node.value}" exceeded max nesting depth (${options.maxPartialDepth ?? DEFAULT_MAX_PARTIAL_DEPTH})`);
        }
        out += renderTemplate(partial, context, depth + 1);
        break;
      }
    }
  }

  return out;
}

function renderSection(
  node: AstNode,
  value: ViewValue,
  context: Context,
  renderTemplate: (template: string, ctx: Context, depth: number) => string,
  options: RenderOptions,
  depth: number,
): string {
  // Lambdas receive the raw section source and a render helper.
  if (typeof value === "function") {
    const raw = sectionSource(node);
    return (value as Lambda).call(context.lookup("."), raw, (text) => renderTemplate(text, context, depth));
  }
  if (value === undefined || value === null || value === false) return "";
  if (Array.isArray(value)) {
    return value.map((item) => renderNodes(node.children, context.push(item), renderTemplate, options, depth)).join("");
  }
  if (typeof value === "object") {
    return renderNodes(node.children, context.push(value), renderTemplate, options, depth);
  }
  // Truthy scalar: render the section once with the same context.
  return renderNodes(node.children, context, renderTemplate, options, depth);
}

/** Reconstruct the raw source of a section's children (used for lambdas). */
function sectionSource(node: AstNode): string {
  return node.children
    .map((child) => {
      switch (child.kind) {
        case "text":
          return child.value;
        case "variable":
          return `{{${child.value}}}`;
        case "unescaped":
          return `{{{${child.value}}}}`;
        case "section":
          return `{{#${child.value}}}${sectionSource(child)}{{/${child.value}}}`;
        case "inverted":
          return `{{^${child.value}}}${sectionSource(child)}{{/${child.value}}}`;
        case "partial":
          return `{{>${child.value}}}`;
      }
    })
    .join("");
}
