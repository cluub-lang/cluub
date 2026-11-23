// Lexer: turns Cluub source into tokens. Indentation (2 spaces) defines blocks,
// so it emits `indent` / `dedent` tokens. Inside (), [] and {} newlines are ignored.
import { CluubError } from './diagnostics.js';

const TWO = ['->', '=>', '<=', '>=', '==', '!=', '&&', '||'];
const ONE = '()[]{},:.=+-*/%<>?!';
const WORDY = {
  '==': 'Cluub uses the word `is` for comparison. Write `a is b`.',
  '!=': 'Cluub uses `is not`. Write `a is not b`.',
  '&&': 'Cluub uses the word `and`.',
  '||': 'Cluub uses the word `or`.',
  '!': 'Cluub uses the word `not`. Write `not done`.',
};

export function lex(src, file = 'main.clb', base = { line: 1, col: 1, inline: false }) {
  const toks = [];
  const indents = [0];
  let i = 0, line = base.line, col = base.col, depth = 0, atLineStart = !base.inline;
  const fail = (code, message, hint, l = line, c = col, length = 1) => {
    throw new CluubError({ code, message, hint, file, line: l, col: c, length });
  };
  const push = (type, value, l, c, len) => toks.push({ type, value, line: l, col: c, len, file });
  const last = () => toks[toks.length - 1];

  while (i < src.length) {
    if (atLineStart && depth === 0) {
      let j = i, width = 0;
      while (src[j] === ' ' || src[j] === '\t') {
        if (src[j] === '\t') fail('E001', 'Tabs are not allowed for indentation.',
          'Use 2 spaces per level. Your editor can convert tabs to spaces ("Indent using spaces").', line, width + 1);
        width++; j++;
      }
      if (j >= src.length || src[j] === '\n' || src[j] === '\r' || src[j] === '#') {
        while (j < src.length && src[j] !== '\n') j++;
        i = j < src.length ? j + 1 : j;
        if (j < src.length) line++;
        col = 1;
        continue;
      }
      i = j; col = width + 1; atLineStart = false;
      const top = indents[indents.length - 1];
      if (width > top) {
        if (width - top !== 2) fail('E002', `Indent each block by exactly 2 spaces (this line is indented ${width - top} more than the line above).`,
          `Use ${top + 2} spaces here.`, line, 1, width);
        indents.push(width);
        push('indent', null, line, 1, width);
      } else if (width < top) {
        while (width < indents[indents.length - 1]) { indents.pop(); push('dedent', null, line, 1, 0); }
        if (width !== indents[indents.length - 1]) fail('E003', "This line's indentation doesn't line up with any block above it.",
          `Use ${indents[indents.length - 1]} spaces to continue the outer block.`, line, 1, width);
      }
      continue;
    }

    const ch = src[i];
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') {
      if (depth === 0 && toks.length && last().type !== 'newline') push('newline', null, line, col, 1);
      if (depth === 0) atLineStart = true;
      i++; line++; col = 1; continue;
    }
    if (ch === ' ' || ch === '\t') { i++; col++; continue; }
    if (ch === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }

    const l = line, c = col;
    // Numbers: 42, 3.14, 1_000
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9_]/.test(src[j])) j++;
      if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) { j++; while (j < src.length && /[0-9_]/.test(src[j])) j++; }
      const raw = src.slice(i, j);
      push('number', Number(raw.replace(/_/g, '')), l, c, raw.length);
      col += j - i; i = j; continue;
    }
    // Names and keywords
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      push('name', src.slice(i, j), l, c, j - i);
      col += j - i; i = j; continue;
    }
    // Text: "..." single line, """...""" multi-line (great for AI prompts)
    if (ch === '"') {
      const triple = src.startsWith('"""', i);
      const open = triple ? 3 : 1;
      let j = i + open, cl = line, cc = col + open;
      let raw = '';
      const startLine = line, startCol = col;
      let closed = false;
      while (j < src.length) {
        if (triple ? src.startsWith('"""', j) : src[j] === '"') { closed = true; break; }
        if (src[j] === '\n') {
          if (!triple) fail('E004', 'This text is missing its closing quote (").',
            'Close it on the same line, or use """triple quotes""" for text that spans lines.', startLine, startCol, 1);
          raw += '\n'; j++; cl++; cc = 1; continue;
        }
        if (src[j] === '\\' && j + 1 < src.length) { raw += src[j] + src[j + 1]; j += 2; cc += 2; continue; }
        raw += src[j]; j++; cc++;
      }
      if (!closed) fail('E004', 'This text is missing its closing quote.', 'Add the closing quote.', startLine, startCol, 1);
      if (triple) raw = dedentBlock(raw);
      push('string', splitInterpolation(raw, file, startLine, startCol + open, fail), l, c, j + open - i);
      i = j + open; line = cl; col = cc + open; continue;
    }
    // Operators and punctuation
    const two = src.slice(i, i + 2);
    if (TWO.includes(two)) {
      if (WORDY[two]) fail('E006', `\`${two}\` is not used in Cluub.`, WORDY[two], l, c, 2);
      push('op', two, l, c, 2); i += 2; col += 2; continue;
    }
    if (ONE.includes(ch)) {
      if (ch === '!') fail('E006', '`!` is not used in Cluub.', WORDY['!'], l, c, 1);
      if ('([{'.includes(ch)) depth++;
      if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
      push('op', ch, l, c, 1); i++; col++; continue;
    }
    fail('E005', `Unexpected character \`${ch}\`.`, ch === "'" ? 'Use double quotes (") for text.' : 'Remove this character.', l, c, 1);
  }
  if (toks.length && last().type !== 'newline' && !base.inline) push('newline', null, line, col, 1);
  while (indents.length > 1) { indents.pop(); push('dedent', null, line, 1, 0); }
  push('eof', null, line, col, 0);
  return toks;
}

function dedentBlock(raw) {
  let lines = raw.split('\n');
  if (lines[0].trim() === '') lines = lines.slice(1);
  if (lines.length && lines[lines.length - 1].trim() === '') lines = lines.slice(0, -1);
  const min = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length), Infinity);
  return lines.map((l) => l.slice(min === Infinity ? 0 : min)).join('\n');
}

const ESC = { n: '\n', t: '\t', '"': '"', '\\': '\\', '{': '{', '}': '}' };

// "Hello {name}!" -> [{text:'Hello '}, {expr:'name', line, col}, {text:'!'}]
function splitInterpolation(raw, file, line, col, fail) {
  const parts = [];
  let buf = '', i = 0, l = line, c = col;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '\\') { buf += ESC[raw[i + 1]] ?? raw[i + 1]; i += 2; c += 2; continue; }
    if (ch === '{') {
      let depth = 1, j = i + 1, inStr = false;
      while (j < raw.length && depth) {
        if (raw[j] === '"') inStr = !inStr;
        else if (!inStr && raw[j] === '{') depth++;
        else if (!inStr && raw[j] === '}') depth--;
        if (depth) j++;
      }
      if (depth) fail('E004', 'A `{` inside this text is never closed with `}`.', 'Close it, or write \\{ for a literal brace.', l, c, 1);
      if (buf) parts.push({ text: buf });
      buf = '';
      parts.push({ expr: raw.slice(i + 1, j), line: l, col: c + 1 });
      c += j - i + 1; i = j + 1; continue;
    }
    if (ch === '\n') { l++; c = 1; } else c++;
    buf += ch; i++;
  }
  if (buf || !parts.length) parts.push({ text: buf });
  return parts;
}
