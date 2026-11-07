export type TokenKind = "text" | "variable" | "unescaped" | "section" | "inverted" | "close" | "partial" | "comment" | "delimiter";
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
export declare class TemplateError extends Error {
    readonly line: number;
    readonly column: number;
    constructor(message: string, line?: number, column?: number);
}
/** Escape a value for safe interpolation into HTML. */
export declare function escapeHtml(value: string): string;
/**
 * Split a template into tokens.
 *
 * Tags are recognised between the current delimiters (default `{{` / `}}`).
 * A `{{{name}}}` triple-mustache tag is an unescaped variable; whitespace
 * inside a tag is trimmed. Anything that is not a well-formed tag is left
 * as literal text — the parser, not the lexer, decides what is an error.
 */
export declare function lex(template: string): Token[];
