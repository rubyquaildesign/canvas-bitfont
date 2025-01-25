import { schema } from './schema';
import { parse, SyntaxError } from './parser.mjs';
import { ZodError } from 'zod';
import { fromError } from 'zod-validation-error';
/**
 * @module
 * This module contains the font class
 *
 * @example
 * ```ts
 * const myFont = await Font.load(myFontYaffSource);
 *
 * myCanvas2DContext.drawImage(myFont.fillText('Hello World', '#FFFFFF').canvas, x, y);
 * ```
 */

/** Returned data from a text size query */
export type TextLineBoundingBox = {
  width: number;
  height: number;
  baseline: number;
};
const cellSizeRegex = /^(?:(\d+)\s+(\d+))$|^(?:(\d+)x(\d+))$/;
/**
 * A class to represent a single glyph in a font
 *
 * @class Glyph
 */
class Glyph {
  image: ImageBitmap;
  rasterWidth: number;
  rasterHeight: number;
  boundingWidth: number;
  boundingHeight: number;
  leftBearing: number;
  rightBearing: number;
  shiftUp: number;
  labels: any[];
  blank = false;
  private constructor(
    glyphSource: any,
    bitmap: ImageBitmap,
    globalShiftUp: number,
    isBlank: boolean
  ) {
    this.image = bitmap;
    this.rasterWidth = isBlank ? 0 : this.image.width;
    this.rasterHeight = isBlank ? 0 : this.image.height;
    this.leftBearing = glyphSource.props.leftBearing ?? 0;
    this.rightBearing = glyphSource.props.rightBearing ?? 0;
    this.shiftUp = glyphSource.props.shiftUp ?? globalShiftUp;
    this.boundingWidth = this.leftBearing + this.rasterWidth + this.rightBearing;
    this.boundingHeight = this.rasterHeight + Math.abs(this.shiftUp);
    this.labels = glyphSource.labels;
    this.blank = isBlank;
  }

  /**
   * Compile's a glyph from raw font object
   *
   * @static
   * @param glyphSource raw font object
   * @param [globalShiftUp=0] a global shift value from the font definition
   * @return {*} Returns a promise that resolves into the glyph
   * @memberof Glyph
   */
  public static async compile(glyphSource: any, globalShiftUp = 0): Promise<Glyph> {
    const bitmap = await globalThis.createImageBitmap(
      typeof glyphSource.ink === 'string'
        ? new ImageData(1, 1)
        : new ImageData(glyphSource.ink.data, glyphSource.ink.width, glyphSource.ink.height)
    );
    return new Glyph(glyphSource, bitmap, globalShiftUp, typeof glyphSource.ink === 'string');
  }
}

/**
 * Main font class to generate and use yaff font
 *
 * @export
 * @class Font
 */
export class Font {
  /** Internal canvas */
  canvas: HTMLCanvasElement | OffscreenCanvas;

  /** Internal canvas context */
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  /** Source data from the schema */
  sourceData: any;

  /** Properties of the font from the source yaff file */
  properties: Record<string, string | number>;

  /** A default cell size if there is one */
  defaultCellSize?: { width: number; height: number };

  /** Content of the raw lexer */
  rawLexer: any;

  /** An array of all the glyphs in the font */
  glyphs: Glyph[] = [];

  /** global character spacing used to bluntly space all the characters apart
   */
  globalCharacterSpacing = 0;

  /** Maps codePoints to glyphs */
  codePointMap: Map<number, Glyph> = new Map<number, Glyph>();
  /** Maps unicode values to glyphs */
  unicodeMap: Map<number, Glyph> = new Map<number, Glyph>();
  /** Maps characters to glyphs */
  characterMap: Map<string, Glyph> = new Map<string, Glyph>();
  /** Maps yaff tags to glyphs */
  tagMap: Map<string, Glyph> = new Map<string, Glyph>();
  /** Default glyph (if the font has one) */
  default?: Glyph;

  private constructor(yaffSource: string, canvas?: HTMLCanvasElement | OffscreenCanvas) {
    canvas = canvas ?? new OffscreenCanvas(100, 100);
    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) {
      throw new Error(`Error creating context, needs offscreen canvas support`);
    }
    this.canvas = canvas;
    this.ctx = ctx;
    try {
      const parsedSource = parse(yaffSource);
      const transformedData = schema.parse(parsedSource);
      this.sourceData = transformedData;
      this.rawLexer = parsedSource;
    } catch (pError) {
      if (pError instanceof SyntaxError) {
        console.error(pError.format([{ text: yaffSource, source: 'input' }]));
        throw new Error('error');
      } else if (pError instanceof ZodError) {
        const validationError = fromError(pError);
        throw validationError;
      }
      throw pError;
    }
    this.properties = this.sourceData.properties;
    const sizeValues = [
      this.properties.cellSize,
      this.properties.boundingBox,
      this.properties.rasterSize,
    ]
      .map((v) => {
        if (v === undefined) return v;
        const result = cellSizeRegex.exec(v);
        if (result === null) return undefined;
        const width = result[1] ?? result[3];
        if (width === undefined) return undefined;
        const height = result[2] ?? result[4];
        if (height === undefined) return undefined;
        const size = { width: parseFloat(width), height: parseFloat(height) };
        if (!isFinite(size.width) || !isFinite(size.height)) return undefined;
        return size;
      })
      .filter((v) => v !== undefined);
    this.defaultCellSize = sizeValues.length ? sizeValues[0] : undefined;
  }

  /**
   * Loads a yaff font from source
   *
   * @static
   * @param yaffSource The source yaff string
   * @param [canvas] An optional canvas to use internally, otherwise an offscreen canvas will be created
   * @return {*} A promise that resolves into a font object
   * @memberof Font
   */
  public static async load(
    yaffSource: string,
    canvas?: HTMLCanvasElement | OffscreenCanvas
  ): Promise<Font> {
    const f = new Font(yaffSource, canvas);
    const globalShiftUp: number = parseFloat((f.properties.shiftUp as any) ?? 0);
    f.glyphs = await Promise.all(
      f.sourceData.glyphs.map((g: any) => {
        return Glyph.compile(g, globalShiftUp);
      })
    );
    for (const glyph of f.glyphs) {
      for (const label of glyph.labels) {
        if (!label) continue;
        else if (label.type === 'default') f.default = glyph;
        else if (label.type === 'character' && 'subType' in label) {
          f.unicodeMap.set(parseInt(label.value, 16), glyph);
        } else if (label.type === 'character') {
          f.characterMap.set(label.label, glyph);
        } else if (label.type === 'codePoint') {
          f.codePointMap.set(label.label[0], glyph);
        } else {
          if (/^[Uu]\+[0-9A-F]+$/.test(label.label)) {
            f.unicodeMap.set(parseInt(label.label.replaceAll(/^[Uu]\+/g, ''), 16), glyph);
          }
          f.tagMap.set(label.label, glyph);
        }
      }
    }
    if (f.properties.defaultChar !== undefined) {
      if (f.properties.defaultChar === 'missing') {
        const missing = f.tagMap.get('missing');
        if (missing) f.default = missing;
      } else if (typeof f.properties.defaultChar === 'number') {
        const gly = f.getGlyphForCharacter(String.fromCharCode(f.properties.defaultChar));
        if (gly) f.default = gly;
      }
    }
    if (
      !f.characterMap.has(' ') &&
      !f.unicodeMap.has(' '.charCodeAt(0)) &&
      !f.tagMap.has(' ') &&
      f.defaultCellSize
    ) {
      const { width, height } = f.defaultCellSize;
      const data = new Uint8ClampedArray(width * height * 4).fill(0);
      const glyph = await Glyph.compile(
        { ink: { width, height, data }, props: {}, labels: [{ type: 'character', label: "' '" }] },
        globalShiftUp
      );
      f.glyphs.push(glyph);
      f.characterMap.set(' ', glyph);
      f.unicodeMap.set(32, glyph);
      f.tagMap.set(' ', glyph);
    }
    return f;
  }

  /**
   * Get the glyph for a character (returns default glyph if none found and undefined if there is no default glyph)
   *
   * @param character the string character to find
   * @return {*} Default glyph if none found and undefined if there is no default glyph
   * @memberof Font
   */
  getGlyphForCharacter(character: string): Glyph | undefined {
    let glyph = this.characterMap.get(character.charAt(0));
    if (glyph) return glyph;
    const cp = character.charCodeAt(0);
    glyph = this.unicodeMap.get(cp);
    if (glyph) return glyph;
    glyph = this.codePointMap.get(cp);
    if (glyph) return glyph;
    glyph = this.tagMap.get(character);
    if (glyph) return glyph;
    if (this.default) return this.default;
    return undefined;
  }

  /**
   * Get the glyph for a character code (returns default glyph if none found and undefined if there is no default glyph)
   *
   * @param code the codepoint or character code to fetch
   * @return {*} Default glyph if none found and undefined if there is no default glyph
   * @memberof Font
   */
  getGlyphForCharcode(code: number): Glyph | undefined {
    let glyph = this.codePointMap.get(code);
    if (glyph) return glyph;
    glyph = this.unicodeMap.get(code);
    if (glyph) return glyph;
    if (this.default) return this.default;
    return undefined;
  }

  /**
   * Returns the {@link TextLineBoundingBox} for a line of text
   *
   * @param string the line of text to get the bounds of
   * @return {*} TextLine Bounds
   * @memberof Font
   */
  boundingBoxForString(string: string): TextLineBoundingBox {
    const strArray = string.split('');
    return this.reduceString(strArray);
  }

  /**
   * Returns the {@link TextLineBoundingBox} for a line of character codes
   *
   * @param charArray the array of codes to get the bounds of
   * @return {*} TextLine Bounds
   * @memberof Font
   */
  boundingBoxForCharCodeArray(charArray: number[]): TextLineBoundingBox {
    return this.reduceString(charArray);
  }

  private reduceString(strArray: string[] | number[]) {
    let vertOffset: number = 0;

    const bounds = strArray.reduce<{ width: number; height: number }>(
      (sum, cur, i) => {
        const glyph =
          typeof cur === 'string' ? this.getGlyphForCharacter(cur) : this.getGlyphForCharcode(cur);
        if (!glyph) return sum;
        vertOffset = Math.max(vertOffset, glyph.rasterHeight + glyph.shiftUp);

        return {
          ...sum,
          width: sum.width + (i !== 0 ? this.globalCharacterSpacing : 0) + glyph.boundingWidth,
          height: Math.max(sum.height, glyph.boundingHeight),
        };
      },
      { width: 0, height: 0 }
    );
    return { ...bounds, baseline: vertOffset };
  }

  /**
   * Setsup the internal canvas and draws the text in the fill colour for the particular line of text
   *
   * @param text text string (or code point array) to draw
   * @param fill fill style
   * @returns a reference to the internal canvas and the baseline y value
   */
  fillText(
    text: string | number[],
    fill: CanvasRenderingContext2D['fillStyle']
  ): { canvas: Font['canvas']; baseline: number } {
    const bb =
      typeof text === 'string'
        ? this.boundingBoxForString(text)
        : this.boundingBoxForCharCodeArray(text);
    this.canvas.width = bb.width;
    this.canvas.height = bb.height;
    this.ctx.clearRect(0, 0, bb.width, bb.height);
    this.ctx.globalCompositeOperation = 'source-over';
    const array = typeof text === 'string' ? text.split('') : text;
    let x = 0;
    for (const [i, char] of array.entries()) {
      const isFirst = i === 0;
      const glyph =
        typeof char === 'string' ? this.getGlyphForCharacter(char) : this.getGlyphForCharcode(char);
      if (!glyph) continue;
      const y = bb.baseline - glyph.rasterHeight - glyph.shiftUp;

      this.ctx.drawImage(
        glyph.image,
        x + (isFirst ? 0 : this.globalCharacterSpacing) + glyph.leftBearing,
        y
      );
      x += (isFirst ? 0 : this.globalCharacterSpacing) + glyph.boundingWidth;
    }
    this.ctx.globalCompositeOperation = 'source-in';
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(0, 0, bb.width, bb.height);
    this.ctx.globalCompositeOperation = 'source-over';
    return { canvas: this.canvas, baseline: bb.baseline };
  }
}

export default Font;
