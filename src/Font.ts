import { schema } from './schema';
import { parse, SyntaxError } from './parser.mjs';
import { ZodError } from 'zod';
import { fromError } from 'zod-validation-error';

type TextLineBoundingBox = {
  width: number;
  height: number;
  vertOffset: number;
};

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
  public static async compile(glyphSource: any, globalShiftUp = 0): Promise<Glyph> {
    const bitmap = await window.createImageBitmap(
      typeof glyphSource.ink === 'string'
        ? new ImageData(1, 1)
        : new ImageData(glyphSource.ink.data, glyphSource.ink.width, glyphSource.ink.height)
    );
    return new Glyph(glyphSource, bitmap, globalShiftUp, typeof glyphSource.ink === 'string');
  }
}

export class Font {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  #sourceData: any;
  properties: any;
  glyphs: Glyph[] = [];
  codePointMap: Map<number, Glyph> = new Map<number, Glyph>();
  unicodeMap: Map<number, Glyph> = new Map<number, Glyph>();
  characterMap: Map<string, Glyph> = new Map<string, Glyph>();
  tagMap: Map<string, Glyph> = new Map<string, Glyph>();
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
      console.log(parsedSource);
      const transformedData = schema.parse(parsedSource);
      this.#sourceData = transformedData;
    } catch (pError) {
      if (pError instanceof SyntaxError) {
        console.error(pError.format([{ text: yaffSource, source: 'input' }]));
        throw new Error('error');
      } else if (pError instanceof ZodError) {
        const validationError = fromError(pError);
        throw validationError;
      }
      console.log(JSON.stringify(pError, null, 2));
      throw pError;
    }
    this.properties = this.#sourceData.properties;
  }

  public static async load(
    yaffSource: string,
    canvas?: HTMLCanvasElement | OffscreenCanvas
  ): Promise<Font> {
    const f = new Font(yaffSource, canvas);
    const globalShiftUp = f.properties.shiftUp ?? 0;
    f.glyphs = await Promise.all(
      f.#sourceData.glyphs.map((g: any) => {
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
    return f;
  }

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

  getGlyphForCharcode(code: number): Glyph | undefined {
    let glyph = this.codePointMap.get(code);
    if (glyph) return glyph;
    glyph = this.unicodeMap.get(code);
    if (glyph) return glyph;
    if (this.default) return this.default;
    return undefined;
  }

  boundingBoxForString(string: string): TextLineBoundingBox {
    const strArray = string.split('');
    return this.reduceString(strArray);
  }

  boundingBoxForCharCodeArray(charArray: number[]): TextLineBoundingBox {
    return this.reduceString(charArray);
  }

  private reduceString(strArray: string[] | number[]) {
    let vertOffset: number = 0;

    const bounds = strArray.reduce<{ width: number; height: number }>(
      (sum, cur) => {
        const glyph =
          typeof cur === 'string' ? this.getGlyphForCharacter(cur) : this.getGlyphForCharcode(cur);
        if (!glyph) return sum;
        vertOffset = Math.max(vertOffset, glyph.rasterHeight + glyph.shiftUp);
        return {
          ...sum,
          width: sum.width + glyph.boundingWidth,
          height: Math.max(sum.height, glyph.boundingHeight),
        };
      },
      { width: 0, height: 0 }
    );
    return { ...bounds, vertOffset };
  }

  fillText(
    text: string | number[],
    fill: CanvasRenderingContext2D['fillStyle']
  ): { canvas: Font['canvas']; verticalOffset: number } {
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
    for (const char of array) {
      const glyph =
        typeof char === 'string' ? this.getGlyphForCharacter(char) : this.getGlyphForCharcode(char);
      if (!glyph) continue;
      const y = bb.vertOffset - glyph.rasterHeight - glyph.shiftUp;
      console.log({ bb, glyph, char });

      this.ctx.drawImage(glyph.image, x + glyph.leftBearing, y);
      x += glyph.boundingWidth;
    }
    this.ctx.globalCompositeOperation = 'source-in';
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(0, 0, bb.width, bb.height);
    this.ctx.globalCompositeOperation = 'source-over';
    return { canvas: this.canvas, verticalOffset: bb.vertOffset };
  }
}
