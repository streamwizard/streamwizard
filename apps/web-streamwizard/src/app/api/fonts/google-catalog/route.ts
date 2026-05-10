import { NextResponse } from "next/server";
import { FALLBACK_GOOGLE_FONT_FAMILIES } from "@/constants/google-fonts";
import { parseGoogleFontsMetadataText } from "@/lib/google-fonts-catalog";

export const revalidate = 86400;

export async function GET() {
  try {
    const res = await fetch("https://fonts.google.com/metadata/fonts", {
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json([...FALLBACK_GOOGLE_FONT_FAMILIES], {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
        },
      });
    }

    const text = await res.text();
    const fonts = parseGoogleFontsMetadataText(text);

    return NextResponse.json(fonts, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json([...FALLBACK_GOOGLE_FONT_FAMILIES], { status: 200 });
  }
}
