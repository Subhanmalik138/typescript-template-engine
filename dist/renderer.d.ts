import { AstNode } from "./parser";
/** Any value a template can interpolate: primitives, objects, arrays, lambdas. */
export type ViewValue = string | number | boolean | null | undefined | ViewObject | ViewValue[] | Lambda;
export type ViewObject = {
    [key: string]: ViewValue;
};
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
/**
 * A stack of contexts. Lookups walk from the innermost context outward,
 * so a section over an object shadows outer names with its own keys —
 * the same scoping rule Mustache uses.
 */
export declare class Context {
    private readonly stack;
    constructor(view: View);
    private constructorFrom;
    push(view: View): Context;
    /** Resolve a dotted path (`user.address.city`, or `.` for the context itself). */
    lookup(name: string): ViewValue;
}
/** Render already-parsed nodes against a context. */
export declare function renderNodes(nodes: AstNode[], context: Context, renderTemplate: (template: string, ctx: Context, depth: number) => string, options: RenderOptions, depth: number): string;
