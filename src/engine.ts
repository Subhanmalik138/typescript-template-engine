import { parse, AstNode } from "./parser";
import { Context, renderNodes, Partials, RenderOptions, View } from "./renderer";

export { TemplateError, escapeHtml } from "./lexer";
export { parse } from "./parser";
export type { AstNode } from "./parser";
export type { View, ViewValue, ViewObject, Lambda, Partials, RenderOptions } from "./renderer";

/** A pre-compiled template: parse once, render many times. */
export type CompiledTemplate = (view: View, options?: RenderOptions) => string;

export interface EngineOptions {
  /** Cache compiled templates by source string (default: true). */
  cache?: boolean;
}

/**
 * The template engine. `render` is the one-shot path; `compile` parses
 * once and returns a reusable render function for hot loops.
 */
export class TemplateEngine {
  private readonly cache = new Map<string, AstNode[]>();
  private readonly useCache: boolean;

  constructor(options: EngineOptions = {}) {
    this.useCache = options.cache ?? true;
  }

  compile(template: string): CompiledTemplate {
    const ast = this.parse(template);
    return (view: View, options: RenderOptions = {}) => this.renderAst(ast, view, options);
  }

  render(template: string, view: View = {}, options: RenderOptions = {}): string {
    return this.renderAst(this.parse(template), view, options);
  }

  /** Parse without rendering — useful for validating a template. */
  validate(template: string): AstNode[] {
    return this.parse(template);
  }

  private parse(template: string): AstNode[] {
    if (this.useCache) {
      const cached = this.cache.get(template);
      if (cached) return cached;
      const ast = parse(template);
      this.cache.set(template, ast);
      return ast;
    }
    return parse(template);
  }

  private renderAst(ast: AstNode[], view: View, options: RenderOptions): string {
    const renderTemplate = (template: string, ctx: Context, depth: number): string =>
      renderNodes(this.parse(template), ctx, renderTemplate, options, depth);
    return renderNodes(ast, new Context(view), renderTemplate, options, 0);
  }
}

/** Default engine instance for the one-shot helpers below. */
export const engine = new TemplateEngine();

/** Render a template string against a view in one call. */
export function render(template: string, view: View = {}, options: RenderOptions = {}): string {
  return engine.render(template, view, options);
}

/** Compile a template into a reusable render function. */
export function compile(template: string): CompiledTemplate {
  return engine.compile(template);
}
