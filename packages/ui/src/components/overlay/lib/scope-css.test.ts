import { describe, expect, it } from "bun:test";
import { scopeCss } from "./scope-css";

const S = '[data-sw-alert="a1"]';

describe("scopeCss", () => {
  it("puts the scope in front of every selector in a list", () => {
    expect(scopeCss("[data-part=title], .x > span { color: red }", S)).toBe(
      `${S} [data-part=title],${S} .x > span{color: red}`
    );
  });

  it("keeps commas inside brackets and functions as part of one selector", () => {
    expect(scopeCss(':is(.a, .b) [title="x,y"]{color:red}', S)).toBe(
      `${S} :is(.a, .b) [title="x,y"]{color:red}`
    );
  });

  it("turns the page roots into the scope itself", () => {
    expect(scopeCss(":root{--glow:#f0f}", S)).toBe(`${S}{--glow:#f0f}`);
    expect(scopeCss("body .x{color:red}", S)).toBe(`${S} .x{color:red}`);
    expect(scopeCss("html body > .x{color:red}", S)).toBe(`${S} > .x{color:red}`);
    expect(scopeCss("body.dark{color:red}", S)).toBe(`${S}.dark{color:red}`);
    // Only a whole word: .bodywork is a class like any other.
    expect(scopeCss("bodywork{color:red}", S)).toBe(`${S} bodywork{color:red}`);
  });

  it("scopes the rules inside @media and @supports", () => {
    expect(scopeCss("@media (max-width: 600px) { .x { color: red } }", S)).toBe(
      `@media (max-width: 600px){${S} .x{color: red}}`
    );
    expect(scopeCss("@supports (display:grid){@media print{.x{a:b}}}", S)).toBe(
      `@supports (display:grid){@media print{${S} .x{a:b}}}`
    );
  });

  it("leaves @keyframes as they are", () => {
    expect(scopeCss("@keyframes pop { from { opacity: 0 } to { opacity: 1 } }", S)).toBe(
      "@keyframes pop{ from { opacity: 0 } to { opacity: 1 } }"
    );
  });

  it("drops @import, @font-face and the other at-rules", () => {
    expect(scopeCss('@import url("https://evil.test/x.css"); .x{color:red}', S)).toBe(
      `${S} .x{color:red}`
    );
    expect(scopeCss("@font-face{font-family:x;src:url(a.woff2)} .x{color:red}", S)).toBe(
      `${S} .x{color:red}`
    );
    expect(scopeCss("@charset 'utf-8'; @page{margin:0}", S)).toBe("");
  });

  it("ignores comments, including one that never closes", () => {
    expect(scopeCss("/* .y{} */ .x{color:red} /* open", S)).toBe(`${S} .x{color:red}`);
  });

  it("can't be broken out of", () => {
    // A stray } can't end the scope early and start an unscoped rule.
    expect(scopeCss(".x{color:red}} body{display:none}", S)).toBe(
      `${S} .x{color:red}${S}{display:none}`
    );
    // Braces inside strings don't count.
    expect(scopeCss('.x::after{content:"}"} .y{a:b}', S)).toBe(
      `${S} .x::after{content:"}"}${S} .y{a:b}`
    );
    // Nested rules are dropped rather than guessed at.
    expect(scopeCss(".x{ .y{color:red} }", S)).toBe("");
    // An unclosed block runs to the end and is closed for it.
    expect(scopeCss(".x{color:red", S)).toBe(`${S} .x{color:red}`);
    expect(scopeCss("</style><script>alert(1)</script>", S)).not.toContain("<");
  });

  it("returns nothing for empty or garbage input", () => {
    expect(scopeCss("", S)).toBe("");
    expect(scopeCss("   ", S)).toBe("");
    expect(scopeCss("color: red;", S)).toBe("");
    expect(scopeCss("{color:red}", S)).toBe("");
    expect(scopeCss("}}}{{{", S)).toBe("");
  });
});
