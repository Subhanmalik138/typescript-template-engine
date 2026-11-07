"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.engine = exports.TemplateEngine = exports.parse = exports.escapeHtml = exports.TemplateError = void 0;
exports.render = render;
exports.compile = compile;
const parser_1 = require("./parser");
const renderer_1 = require("./renderer");
var lexer_1 = require("./lexer");
Object.defineProperty(exports, "TemplateError", { enumerable: true, get: function () { return lexer_1.TemplateError; } });
Object.defineProperty(exports, "escapeHtml", { enumerable: true, get: function () { return lexer_1.escapeHtml; } });
var parser_2 = require("./parser");
Object.defineProperty(exports, "parse", { enumerable: true, get: function () { return parser_2.parse; } });
/**
 * The template engine. `render` is the one-shot path; `compile` parses
 * once and returns a reusable render function for hot loops.
 */
class TemplateEngine {
    constructor(options = {}) {
        this.cache = new Map();
        this.useCache = options.cache ?? true;
    }
    compile(template) {
        const ast = this.parse(template);
        return (view, options = {}) => this.renderAst(ast, view, options);
    }
    render(template, view = {}, options = {}) {
        return this.renderAst(this.parse(template), view, options);
    }
    /** Parse without rendering — useful for validating a template. */
    validate(template) {
        return this.parse(template);
    }
    parse(template) {
        if (this.useCache) {
            const cached = this.cache.get(template);
            if (cached)
                return cached;
            const ast = (0, parser_1.parse)(template);
            this.cache.set(template, ast);
            return ast;
        }
        return (0, parser_1.parse)(template);
    }
    renderAst(ast, view, options) {
        const renderTemplate = (template, ctx, depth) => (0, renderer_1.renderNodes)(this.parse(template), ctx, renderTemplate, options, depth);
        return (0, renderer_1.renderNodes)(ast, new renderer_1.Context(view), renderTemplate, options, 0);
    }
}
exports.TemplateEngine = TemplateEngine;
/** Default engine instance for the one-shot helpers below. */
exports.engine = new TemplateEngine();
/** Render a template string against a view in one call. */
function render(template, view = {}, options = {}) {
    return exports.engine.render(template, view, options);
}
/** Compile a template into a reusable render function. */
function compile(template) {
    return exports.engine.compile(template);
}
