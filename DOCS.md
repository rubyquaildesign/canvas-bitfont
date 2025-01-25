## :factory: Font

Main font class to generate and use yaff font

[:link: Source](https://github.com/rubyquaildesign/canvas-bitfont/tree/main/src/Font.ts#L83)

### Methods

- [load](#gear-load)
- [getGlyphForCharacter](#gear-getglyphforcharacter)
- [getGlyphForCharcode](#gear-getglyphforcharcode)
- [boundingBoxForString](#gear-boundingboxforstring)
- [boundingBoxForCharCodeArray](#gear-boundingboxforcharcodearray)
- [fillText](#gear-filltext)

#### :gear: load

Loads a yaff font from source

| Method | Type |
| ---------- | ---------- |
| `load` | `(yaffSource: string, canvas?: HTMLCanvasElement or OffscreenCanvas or undefined) => Promise<Font>` |

Parameters:

* `yaffSource`: The source yaff string
* `canvas`: An optional canvas to use internally, otherwise an offscreen canvas will be created


[:link: Source](https://github.com/rubyquaildesign/canvas-bitfont/tree/main/src/Font.ts#L177)

#### :gear: getGlyphForCharacter

Get the glyph for a character (returns default glyph if none found and undefined if there is no default glyph)

| Method | Type |
| ---------- | ---------- |
| `getGlyphForCharacter` | `(character: string) => Glyph or undefined` |

Parameters:

* `character`: the string character to find


[:link: Source](https://github.com/rubyquaildesign/canvas-bitfont/tree/main/src/Font.ts#L242)

#### :gear: getGlyphForCharcode

Get the glyph for a character code (returns default glyph if none found and undefined if there is no default glyph)

| Method | Type |
| ---------- | ---------- |
| `getGlyphForCharcode` | `(code: number) => Glyph or undefined` |

Parameters:

* `code`: the codepoint or character code to fetch


[:link: Source](https://github.com/rubyquaildesign/canvas-bitfont/tree/main/src/Font.ts#L263)

#### :gear: boundingBoxForString

Returns the {@link TextLineBoundingBox} for a line of text

| Method | Type |
| ---------- | ---------- |
| `boundingBoxForString` | `(string: string) => TextLineBoundingBox` |

Parameters:

* `string`: the line of text to get the bounds of


[:link: Source](https://github.com/rubyquaildesign/canvas-bitfont/tree/main/src/Font.ts#L279)

#### :gear: boundingBoxForCharCodeArray

Returns the {@link TextLineBoundingBox} for a line of character codes

| Method | Type |
| ---------- | ---------- |
| `boundingBoxForCharCodeArray` | `(charArray: number[]) => TextLineBoundingBox` |

Parameters:

* `charArray`: the array of codes to get the bounds of


[:link: Source](https://github.com/rubyquaildesign/canvas-bitfont/tree/main/src/Font.ts#L291)

#### :gear: fillText

Setsup the internal canvas and draws the text in the fill colour for the particular line of text

| Method | Type |
| ---------- | ---------- |
| `fillText` | `(text: string or number[], fill: string or CanvasGradient or CanvasPattern) => { canvas: HTMLCanvasElement or OffscreenCanvas; baseline: number; }` |

Parameters:

* `text`: text string (or code point array) to draw
* `fill`: fill style


[:link: Source](https://github.com/rubyquaildesign/canvas-bitfont/tree/main/src/Font.ts#L323)


## :cocktail: Types

- [TextLineBoundingBox](#gear-textlineboundingbox)

### :gear: TextLineBoundingBox

Returned data from a text size query

| Type | Type |
| ---------- | ---------- |
| `TextLineBoundingBox` | `{ width: number; height: number; baseline: number; }` |

[:link: Source](https://github.com/rubyquaildesign/canvas-bitfont/tree/main/src/Font.ts#L18)

