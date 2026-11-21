import { describe, expect, it } from "vitest";
import { splitSpeechText } from "./pocketTtsHelpers";

const encode = (text: string) => Array.from(text.replace(/\s/g, ""), (character) => character.codePointAt(0)!);

describe("splitSpeechText", () => {
  it("groups complete sentences within the token budget", () => {
    const chunks = splitSpeechText("One. Two. Three.", 8, encode);
    expect(chunks.map(({ text }) => text)).toEqual(["One. Two.", "Three."]);
  });

  it("splits long sentences and unbroken words without dropping tokens", () => {
    const text = "First extraordinary word. 😀😀😀😀😀";
    const chunks = splitSpeechText(text, 4, encode);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(({ tokens }) => tokens.length <= 4)).toBe(true);
    expect(chunks.flatMap(({ tokens }) => tokens)).toEqual(encode(text));
  });
});
