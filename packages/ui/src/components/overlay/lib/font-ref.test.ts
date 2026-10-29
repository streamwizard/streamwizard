import { describe, expect, it } from "bun:test";
import {
  isUploadedFontRef,
  uploadedFontFaceCss,
  uploadedFontName,
  uploadedFontRef,
  uploadedFontUrl,
} from "./font-ref";
import { isValidGoogleFontFamilyName } from "../types/base";
import { normalizeAlertWidgetConfig } from "../widgets/alert/alert-widget-config";

const URL = "https://assets.example.org/assets/u1/a1/Brand-Display_Bold.woff2";
const REF = `sw-font:${URL}`;

describe("uploaded font refs", () => {
  it("wraps a media library font URL and reads it back", () => {
    expect(uploadedFontRef(URL)).toBe(REF);
    expect(isUploadedFontRef(REF)).toBe(true);
    expect(uploadedFontUrl(REF)).toBe(URL);
    expect(uploadedFontName(REF)).toBe("Brand Display Bold");
  });

  it("refuses anything that isn't a plain .woff/.woff2 URL", () => {
    expect(uploadedFontRef("https://assets.example.org/a/b.ttf")).toBeNull();
    expect(uploadedFontRef("javascript:alert(1)//.woff2")).toBeNull();
    // Each of these could end the CSS string or url() it lands in.
    expect(uploadedFontRef('https://x.org/a".woff2')).toBeNull();
    expect(uploadedFontRef("https://x.org/a).woff2")).toBeNull();
    expect(uploadedFontRef("https://x.org/a b.woff2")).toBeNull();
    expect(uploadedFontRef("https://x.org/a\\.woff2")).toBeNull();
  });

  it("declares the font for every weight, in its own format", () => {
    expect(uploadedFontFaceCss(REF)).toBe(
      `@font-face{font-family:"${REF}";src:url("${URL}") format("woff2");font-weight:100 900;font-display:swap}`
    );
    expect(uploadedFontFaceCss("sw-font:https://x.org/a/b.woff")).toContain('format("woff")');
    expect(uploadedFontFaceCss("Inter")).toBeNull();
  });

  it("is a family the widget settings keep, where a mangled one is not", () => {
    expect(isValidGoogleFontFamilyName(REF)).toBe(true);
    expect(isValidGoogleFontFamilyName("Inter")).toBe(true);
    expect(isValidGoogleFontFamilyName('sw-font:https://x.org/a".woff2')).toBe(false);

    const kept = normalizeAlertWidgetConfig({ variants: { follow: { fontFamily: REF } } });
    expect(kept.variants.follow.fontFamily).toBe(REF);
    const dropped = normalizeAlertWidgetConfig({ variants: { follow: { fontFamily: "sw-font:nope" } } });
    expect(dropped.variants.follow.fontFamily).toBe("Inter");
  });
});
