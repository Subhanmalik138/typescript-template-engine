import { lex } from "../src/lexer";

describe("lexer", () => {
  it("tokenizes text and variables", () => {
    const tokens = lex("Hi {{name}}!");
    expect(tokens.map((t) => t.kind)).toEqual(["text", "variable", "text"]);
    expect(tokens[1].value).toBe("name");
  });

  it("recognises triple-mustache unescaped tags", () => {
    const tokens = lex("{{{html}}}");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("unescaped");
    expect(tokens[0].value).toBe("html");
  });

  it("recognises section, inverted, close, partial and comment tags", () => {
    const tokens = lex("{{#a}}{{^b}}{{>p}}{{!c}}{{/a}}");
    expect(tokens.map((t) => t.kind)).toEqual(["section", "inverted", "partial", "comment", "close"]);
  });

  it("tracks line and column numbers", () => {
    const tokens = lex("first\n  {{name}}");
    expect(tokens[1].line).toBe(2);
    expect(tokens[1].column).toBe(3);
  });

  it("trims whitespace inside tags", () => {
    const tokens = lex("{{  name  }}");
    expect(tokens[0].value).toBe("name");
  });

  it("returns an empty list for an empty template", () => {
    expect(lex("")).toEqual([]);
  });
});
