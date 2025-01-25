import { z } from 'zod';
import {toCamelCase} from '@std/text';
const spacingOptions = z.enum(['character-cell', 'monospace', 'proportional', 'multi-cell']);
const codePointValue = z.union([
  z
    .string()
    .regex(/^[0-9]+$/)
    .transform((v) => parseInt(v)),
  z
    .string()
    .regex(/^0[xX][0-9A-F]+$/i)
    .transform((v) => parseInt(v.slice(2), 16)),
  z
    .string()
    .regex(/^0o[0-8]+$/i)
    .transform((v) => parseInt(v.slice(2), 8)),
]);
const defaultCharOptions = codePointValue.or(
  z
    .string()
    .regex(/^"?[uU]\+[0-9A-F]+"?$/i)
    .transform((str) => parseInt(str.replace(/'"/g,'').substring(2).toUpperCase(),16)),
).or(z.enum(['default', 'missing']));
const fontUsableProperties = z
  .object({
    name: z.string(),
    spacing: spacingOptions,
    encoding: z.string(),
    converter: z.string(),
    sourceFormat: z.string(),
    cellSize: z.string(),
    boundingBox: z.string(),
    rasterSize: z.string(),
    sourceName: z.string(),
    shiftUp: z.number(),
    pointSize: z.number(),
    ascent: z.number(),
    family: z.string(),
    dpi: z.number().or(z.string()),
    defaultChar: defaultCharOptions,
  })
  .partial();
const glyphUsableProperties = z
  .object({
    leftBearing: z.number(),
    shiftUp: z.number(),
    rightBearing: z.number(),
  })
  .partial().default({});
const propertyParser = z
  .object({
    type: z.literal('property'),
    key: z
      .string()
      .regex(/^[0-9A-z\-_.]+$/)
      .transform((p) => p.replaceAll(/_/g, '-').toLowerCase()),
    val: z.string(),
  })
  .transform((inputObject) => {
    const isNum = !/[^0-9.-]/.test(inputObject.val);
    return [
      toCamelCase(inputObject.key),
      isNum ? parseFloat(inputObject.val) : inputObject.val,
    ] as const;
  });

const validUnicodeLabel = z
  .object({
    type: z.literal('character'),
    label: z.tuple([
      z
        .string()
        .regex(/^[uU]\+[0-9A-F]+$/i)
        .transform((str) => str.substring(2).toUpperCase()),
    ]),
  })
  .transform((data) => ({ type: 'character', subType: 'unicode', value: data.label[0] }) as const);
const validCharLabel = z.object({
  type: z.literal('character'),
  label: z
    .string()
    .regex(/^'.'$/)
    .transform((s) => s.slice(1, s.length - 1)),
});
const charLabelParser = z.union([validUnicodeLabel, validCharLabel]);
const validTagParser = z.object({
  type: z.literal('tag'),
  label: z.string(),
});

const validDefaultParser = z.object({
  type: z.literal('default'),
});

const validMissingParser = z
  .object({
    type: z.literal('missing'),
  })
  .transform(() => null);

const codePointParser = z.object({
  type: z.literal('codePoint'),
  label: z.array(codePointValue).nonempty(),
});
const labelParser = z
  .union([codePointParser, charLabelParser, validTagParser, validMissingParser, validDefaultParser])
  .catch(null);
const labelArray = z
  .array(labelParser)
  .transform((arr) => arr.filter(Boolean))
  .refine((arr) => arr.length > 0);
const propertyArrayParser = z.array(propertyParser).transform((p) => Object.fromEntries(p));
const inkParser = z
  .array(z.string().regex(/[.@]+/))
  .nonempty()
  .refine((starr) => starr.map((s) => s.length).every((v, i, a) => v === a[0]), {
    message: "ink isn't rectangle",
  })
  .transform((star) => {
    const width = star[0].length;
    const height = star.length;
    const data = new Uint8ClampedArray(
      star
        .map((line) =>
          line.split('').map((ch) => (ch === '@' ? [255, 255, 255, 255] : [0, 0, 0, 0]))
        )
        .flat(2)
    );
    return { width, height, data };
  });

const glyphParser = z
  .object({
    labels: labelArray,
    ink: inkParser.or(z.literal('-')),
    props: propertyArrayParser.pipe(glyphUsableProperties),
  })
  .refine((g) => g.labels.length > 0, 'Glyph has no valid labels');

const fontEntry = z.union([glyphParser, propertyParser]).nullable().catch(null);
export const schema = fontEntry
  .array()
  .transform((a) => a.filter(Boolean))
  .transform((inputArray) => {
    const properties: Array<z.infer<typeof propertyParser>> = inputArray.filter(
      (entry): entry is z.infer<typeof propertyParser> => Array.isArray(entry)
    );
    const glyphs: Array<z.infer<typeof glyphParser>> = inputArray.filter(
      (entry): entry is z.infer<typeof glyphParser> =>
        Object.hasOwn(entry as NonNullable<typeof entry>, 'ink')
    );
    return { properties: fontUsableProperties.parse(Object.fromEntries(properties)), glyphs };
  });
export const definitions = {fontEntry,glyph:glyphParser,property:propertyParser,fontProperties:fontUsableProperties}