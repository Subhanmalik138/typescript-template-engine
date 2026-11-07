import { render, compile, TemplateEngine, TemplateError } from "../src";

describe("variables", () => {
  it("interpolates a simple variable", () => {
    expect(render("Hello, {{name}}!", { name: "World" })).toBe("Hello, World!");
  });

  it("renders missing variables as empty", () => {
    expect(render("Hello, {{name}}!", {})).toBe("Hello, !");
  });

  it("renders numbers and booleans", () => {
    expect(render("{{count}} items, {{ok}}", { count: 3, ok: true })).toBe("3 items, true");
  });

  it("resolves dotted paths", () => {
    expect(render("{{user.address.city}}", { user: { address: { city: "Lahore" } } })).toBe("Lahore");
  });

  it("renders {{.}} as the current context", () => {
    expect(render("{{#items}}{{.}} {{/items}}", { items: ["a", "b", "c"] })).toBe("a b c ");
  });

  it("does not crash on a path through a scalar", () => {
    expect(render("{{user.name}}", { user: "plain" })).toBe("");
  });
});

describe("escaping", () => {
  it("escapes HTML in {{var}}", () => {
    expect(render("{{x}}", { x: "<b>&\"'</b>" })).toBe("&lt;b&gt;&amp;&quot;&#39;&lt;&#x2F;b&gt;");
  });

  it("leaves HTML raw in {{{var}}} and {{& var}}", () => {
    expect(render("{{{x}}}|{{& x}}", { x: "<b>hi</b>" })).toBe("<b>hi</b>|<b>hi</b>");
  });
});

describe("sections", () => {
  it("renders a truthy section once", () => {
    expect(render("{{#show}}yes{{/show}}", { show: true })).toBe("yes");
  });

  it("skips a falsy section", () => {
    expect(render("{{#show}}yes{{/show}}", { show: false })).toBe("");
    expect(render("{{#show}}yes{{/show}}", {})).toBe("");
  });

  it("iterates over arrays, pushing each item as context", () => {
    const out = render("{{#users}}{{name}} ({{age}}); {{/users}}", {
      users: [
        { name: "Ana", age: 30 },
        { name: "Bo", age: 25 },
      ],
    });
    expect(out).toBe("Ana (30); Bo (25); ");
  });

  it("pushes an object section as context", () => {
    expect(render("{{#user}}{{name}} from {{city}}{{/user}}", { user: { name: "Ana", city: "Izmir" } })).toBe(
      "Ana from Izmir",
    );
  });

  it("falls back to outer contexts for missing keys", () => {
    expect(render("{{#user}}{{title}} {{name}}{{/user}}", { title: "Dr.", user: { name: "Ana" } })).toBe("Dr. Ana");
  });

  it("renders a truthy scalar section once with the same context", () => {
    expect(render("{{#count}}got {{count}}{{/count}}", { count: 5 })).toBe("got 5");
  });

  it("nests sections", () => {
    const out = render("{{#a}}{{#b}}{{x}}{{/b}}{{/a}}", { a: { b: { x: "deep" } } });
    expect(out).toBe("deep");
  });
});

describe("inverted sections", () => {
  it("renders when the value is falsy or missing", () => {
    expect(render("{{^items}}empty{{/items}}", { items: [] })).toBe("empty");
    expect(render("{{^items}}empty{{/items}}", {})).toBe("empty");
  });

  it("skips when the value is truthy", () => {
    expect(render("{{^items}}empty{{/items}}", { items: [1] })).toBe("");
  });
});

describe("comments and partials", () => {
  it("drops comments", () => {
    expect(render("a{{! hidden}}b", {})).toBe("ab");
  });

  it("renders partials from the options map", () => {
    const out = render("Hello {{>greet}}", { name: "Ana" }, { partials: { greet: "{{name}}!" } });
    expect(out).toBe("Hello Ana!");
  });

  it("renders unknown partials as nothing", () => {
    expect(render("a{{>missing}}b", {})).toBe("ab");
  });

  it("rejects recursive partials at the depth limit", () => {
    expect(() =>
      render("{{>loop}}", {}, { partials: { loop: "{{>loop}}" }, maxPartialDepth: 3 }),
    ).toThrow(/max nesting depth/);
  });
});

describe("lambdas", () => {
  it("calls a section lambda with the raw text and a render helper", () => {
    const view = {
      name: "ana",
      shout: (text: string, renderFn: (t: string) => string) => renderFn(text).toUpperCase(),
    };
    expect(render("{{#shout}}hello {{name}}{{/shout}}", view)).toBe("HELLO ANA");
  });

  it("calls a variable lambda", () => {
    const view = { now: () => "2026-11-07" };
    expect(render("Today is {{now}}", view)).toBe("Today is 2026-11-07");
  });
});

describe("delimiters and standalone lines", () => {
  it("supports custom delimiters", () => {
    expect(render("{{=<% %>=}}<%name%>", { name: "Ana" })).toBe("Ana");
  });

  it("removes the line of a standalone section tag", () => {
    const template = "A\n{{#show}}\nB\n{{/show}}\nC";
    expect(render(template, { show: true })).toBe("A\nB\nC");
  });
});

describe("errors", () => {
  it("throws on an unclosed section with the line number", () => {
    expect(() => render("line1\n{{#a}}oops", {})).toThrow(TemplateError);
    expect(() => render("line1\n{{#a}}oops", {})).toThrow(/line 2/);
  });

  it("throws on a mismatched close tag", () => {
    expect(() => render("{{#a}}x{{/b}}", {})).toThrow(/Mismatched section/);
  });

  it("throws on a close tag with no opener", () => {
    expect(() => render("x{{/a}}", {})).toThrow(/no matching opener/);
  });

  it("throws on an unclosed tag", () => {
    expect(() => render("Hello {{name", {})).toThrow(/Unclosed tag/);
  });

  it("throws on an invalid variable name", () => {
    expect(() => render("{{na me}}", {})).toThrow(/Invalid variable name/);
  });
});

describe("compile", () => {
  it("returns a reusable render function", () => {
    const tpl = compile("Hello, {{name}}!");
    expect(tpl({ name: "Ana" })).toBe("Hello, Ana!");
    expect(tpl({ name: "Bo" })).toBe("Hello, Bo!");
  });

  it("a fresh engine does not share compiled state", () => {
    const engine = new TemplateEngine({ cache: false });
    expect(engine.render("{{x}}", { x: 1 })).toBe("1");
  });
});
