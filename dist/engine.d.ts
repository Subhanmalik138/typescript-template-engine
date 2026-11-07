import { AstNode } from "./parser";
import { RenderOptions, View } from "./renderer";
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
export declare class TemplateEngine {
    private readonly cache;
    private readonly useCache;
    constructor(options?: EngineOptions);
    compile(template: string): CompiledTemplate;
    render(template: string, view?: View, options?: RenderOptions): string;
    /** Parse without rendering — useful for validating a template. */
    validate(template: string): AstNode[];
    private parse;
    private renderAst;
}
/** Default engine instance for the one-shot helpers below. */
export declare const engine: TemplateEngine;
/** Render a template string against a view in one call. */
export declare function render(template: string, view?: View, options?: RenderOptions): string;
/** Compile a template into a reusable render function. */
export declare function compile(template: string): CompiledTemplate;
