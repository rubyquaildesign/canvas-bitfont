import { generateDocumentation } from 'tsdoc-markdown';

generateDocumentation({
  inputFiles: ['./src/Font.ts'],
  outputFile: './DOCS.md',
  buildOptions: {
    explore: false,
    types:true,
    repo: {
      url:'https://github.com/rubyquaildesign/canvas-bitfont'
    }
  }
});
