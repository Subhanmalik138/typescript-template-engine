"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = void 0;
exports.renderNodes = renderNodes;
const lexer_1 = require("./lexer");
const DEFAULT_MAX_PARTIAL_DEPTH = 10;
/**
 * A stack of contexts. Lookups walk from the innermost context outward,
 * so a section over an object shadows outer names with its own keys —
 * the same scoping rule Mustache uses.
 */
class Context {
    constructor(view) {
        this.stack = [view];
    }
    constructorFrom(stack) {
        const ctx = Object.create(Context.prototype);
        ctx.stack = stack;
        return ctx;
    }
    push(view) {
        return this.constructorFrom([...this.stack, view]);
    }
    /** Resolve a dotted path (`user.address.city`, or `.` for the context itself). */
    lookup(name) {
        if (name === ".") {
            return this.stack[this.stack.length - 1];
        }
        const parts = name.split(".");
        for (let i = this.stack.length - 1; i >= 0; i--) {
            let value = this.stack[i];
            let found = true;
            for (const part of parts) {
                if (value !== null && typeof value === "object" && part in value) {
                    value = value[part];
                }
                else {
                    found = false;
                    break;
                }
            }
            if (found)
                return value;
        }
        return undefined;
    }
}
exports.Context = Context;
/** Render already-parsed nodes against a context. */
function renderNodes(nodes, context, renderTemplate, options, depth) {
    let out = "";
    for (const node of nodes) {
        switch (node.kind) {
            case "text":
                out += node.value;
                break;
            case "variable": {
                const value = context.lookup(node.value);
                if (value === undefined || value === null)
                    break;
                if (typeof value === "function") {
                    out += (0, lexer_1.escapeHtml)(String(value.call(context.lookup("."), "", (t) => renderTemplate(t, context, depth))));
                }
                else {
                    out += (0, lexer_1.escapeHtml)(String(value));
                }
                break;
            }
            case "unescaped": {
                const value = context.lookup(node.value);
                if (value === undefined || value === null)
                    break;
                if (typeof value === "function") {
                    out += String(value.call(context.lookup("."), "", (t) => renderTemplate(t, context, depth)));
                }
                else {
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
                const falsy = value === undefined ||
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
                if (partial === undefined)
                    break; // unknown partials render as nothing
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
function renderSection(node, value, context, renderTemplate, options, depth) {
    // Lambdas receive the raw section source and a render helper.
    if (typeof value === "function") {
        const raw = sectionSource(node);
        return value.call(context.lookup("."), raw, (text) => renderTemplate(text, context, depth));
    }
    if (value === undefined || value === null || value === false)
        return "";
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
function sectionSource(node) {
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
