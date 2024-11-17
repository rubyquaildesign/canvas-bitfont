
![NPM Version](https://img.shields.io/npm/v/canvas-bitfont)
[![JSR](https://jsr.io/badges/@rubyquaildesign/canvas-bitfont)](https://jsr.io/@rubyquaildesign/canvas-bitfont)
[![JSR](https://jsr.io/badges/@rubyquaildesign/canvas-bitfont/score)](https://jsr.io/@rubyquaildesign/canvas-bitfont)
# Canvas Bitfont

Canvas bitfont is designed to draw bitmap fonts onto the canvas, it contains a simple (and probably bad) parser for [Rob Hagemans' `yaff` font format](https://github.com/robhagemans/monobit/blob/master/YAFF.md)

It's still very barebones and has no tests, so I don't believe it fully conforms to the `yaff` standard. It also doesn't support kerning, or other parts of the yaff standard, I believe. However, it does fulfil my needs, so I don't think I'll be working on any new features, but I may fix reported bugs if I have time, and I am accepting PRs.

## Code Example

```javascript
import { Font } from 'canvas-bitfont'

const myFont = await Font.load(myFontYaffSource);

myCanvas2DContext.drawImage(myFont.fillText('Hello World', '#FFFFFF').canvas, x, y);
```
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/V7V23WA1Z)