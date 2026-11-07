/** AST node kinds. */
export type NodeKind = "text" | "variable" | "unescaped" | "section" | "inverted" | "partial";
export interface AstNode {
    kind: NodeKind;
    /** Tag name / dotted path, or literal text for "text" nodes. */
    value: string;
    children: AstNode[];
    line: number;
    column: number;
}
/** A valid tag name is a dotted path (`user.name`, `.` for the current context). */
export declare function isValidName(name: string): boolean;
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
export declare function parse(template: string): AstNode[];
