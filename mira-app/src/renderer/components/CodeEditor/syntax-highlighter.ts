/**
 * Lightweight syntax highlighter using regex-based tokenization.
 * Returns an array of tokens with type and content for rendering.
 */

export type TokenType =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'function'
  | 'operator'
  | 'punctuation'
  | 'property'
  | 'type'
  | 'tag'
  | 'attribute'
  | 'plain'

export interface Token {
  type: TokenType
  content: string
}

const JS_KEYWORDS = new Set([
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'of',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'as',
  'implements',
  'interface',
  'package',
  'private',
  'protected',
  'public',
  'type',
  'enum',
  'declare',
  'readonly',
  'abstract',
])

const PYTHON_KEYWORDS = new Set([
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'False',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'None',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'True',
  'try',
  'while',
  'with',
  'yield',
])

export function tokenizeLine(line: string, language: string): Token[] {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return tokenizeJS(line)
    case 'python':
      return tokenizePython(line)
    case 'json':
      return tokenizeJSON(line)
    case 'html':
    case 'xml':
      return tokenizeHTML(line)
    case 'css':
      return tokenizeCSS(line)
    case 'markdown':
      return tokenizeMarkdown(line)
    default:
      return [{ type: 'plain', content: line }]
  }
}

function tokenizeJS(line: string): Token[] {
  const tokens: Token[] = []
  let remaining = line

  while (remaining.length > 0) {
    // Single-line comment
    if (remaining.startsWith('//')) {
      tokens.push({ type: 'comment', content: remaining })
      break
    }

    // Multi-line comment start (simplified - doesn't track state across lines)
    const blockComment = remaining.match(/^\/\*.*?\*\//)
    if (blockComment) {
      tokens.push({ type: 'comment', content: blockComment[0] })
      remaining = remaining.slice(blockComment[0].length)
      continue
    }

    // Template literal
    const template = remaining.match(/^`(?:[^`\\]|\\.)*`/)
    if (template) {
      tokens.push({ type: 'string', content: template[0] })
      remaining = remaining.slice(template[0].length)
      continue
    }

    // String (double or single quotes)
    const str = remaining.match(/^(['"])(?:[^\\]|\\.)*?\1/)
    if (str) {
      tokens.push({ type: 'string', content: str[0] })
      remaining = remaining.slice(str[0].length)
      continue
    }

    // Number
    const num = remaining.match(
      /^(?:0x[\da-fA-F]+|0b[01]+|0o[0-7]+|\d+\.?\d*(?:e[+-]?\d+)?n?)/
    )
    if (num) {
      tokens.push({ type: 'number', content: num[0] })
      remaining = remaining.slice(num[0].length)
      continue
    }

    // Identifier or keyword
    const ident = remaining.match(/^[a-zA-Z_$][\w$]*/)
    if (ident) {
      const word = ident[0]
      if (JS_KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', content: word })
      } else if (remaining[word.length] === '(') {
        tokens.push({ type: 'function', content: word })
      } else if (/^[A-Z]/.test(word)) {
        tokens.push({ type: 'type', content: word })
      } else {
        tokens.push({ type: 'plain', content: word })
      }
      remaining = remaining.slice(word.length)
      continue
    }

    // Operators
    const op = remaining.match(/^(?:=>|\.{3}|[+\-*/%=<>!&|^~?:]+)/)
    if (op) {
      tokens.push({ type: 'operator', content: op[0] })
      remaining = remaining.slice(op[0].length)
      continue
    }

    // Punctuation
    const punct = remaining.match(/^[{}[\]();,.]/)
    if (punct) {
      tokens.push({ type: 'punctuation', content: punct[0] })
      remaining = remaining.slice(1)
      continue
    }

    // Whitespace or unknown
    tokens.push({ type: 'plain', content: remaining[0] })
    remaining = remaining.slice(1)
  }

  return tokens
}

function tokenizePython(line: string): Token[] {
  const tokens: Token[] = []
  let remaining = line

  while (remaining.length > 0) {
    // Comment
    if (remaining.startsWith('#')) {
      tokens.push({ type: 'comment', content: remaining })
      break
    }

    // Triple-quoted string
    const tripleStr = remaining.match(/^(?:'''[\s\S]*?'''|"""[\s\S]*?""")/)
    if (tripleStr) {
      tokens.push({ type: 'string', content: tripleStr[0] })
      remaining = remaining.slice(tripleStr[0].length)
      continue
    }

    // String
    const str = remaining.match(/^(?:f?r?['"])(?:[^\\]|\\.)*?['"]/)
    if (str) {
      tokens.push({ type: 'string', content: str[0] })
      remaining = remaining.slice(str[0].length)
      continue
    }

    // Number
    const num = remaining.match(
      /^(?:0x[\da-fA-F]+|0b[01]+|0o[0-7]+|\d+\.?\d*(?:e[+-]?\d+)?j?)/
    )
    if (num) {
      tokens.push({ type: 'number', content: num[0] })
      remaining = remaining.slice(num[0].length)
      continue
    }

    // Identifier or keyword
    const ident = remaining.match(/^[a-zA-Z_]\w*/)
    if (ident) {
      const word = ident[0]
      if (PYTHON_KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', content: word })
      } else if (remaining[word.length] === '(') {
        tokens.push({ type: 'function', content: word })
      } else {
        tokens.push({ type: 'plain', content: word })
      }
      remaining = remaining.slice(word.length)
      continue
    }

    // Operators
    const op = remaining.match(/^(?:->|[+\-*/%=<>!&|^~@:]+)/)
    if (op) {
      tokens.push({ type: 'operator', content: op[0] })
      remaining = remaining.slice(op[0].length)
      continue
    }

    // Punctuation
    const punct = remaining.match(/^[{}[\]();,.]/)
    if (punct) {
      tokens.push({ type: 'punctuation', content: punct[0] })
      remaining = remaining.slice(1)
      continue
    }

    tokens.push({ type: 'plain', content: remaining[0] })
    remaining = remaining.slice(1)
  }

  return tokens
}

function tokenizeJSON(line: string): Token[] {
  const tokens: Token[] = []
  let remaining = line

  while (remaining.length > 0) {
    // String (property key or value)
    const str = remaining.match(/^"(?:[^"\\]|\\.)*"/)
    if (str) {
      // Check if it's a property key (followed by :)
      const afterStr = remaining.slice(str[0].length).trimStart()
      if (afterStr.startsWith(':')) {
        tokens.push({ type: 'property', content: str[0] })
      } else {
        tokens.push({ type: 'string', content: str[0] })
      }
      remaining = remaining.slice(str[0].length)
      continue
    }

    // Number
    const num = remaining.match(/^-?\d+\.?\d*(?:e[+-]?\d+)?/)
    if (num) {
      tokens.push({ type: 'number', content: num[0] })
      remaining = remaining.slice(num[0].length)
      continue
    }

    // Boolean/null
    const keyword = remaining.match(/^(?:true|false|null)/)
    if (keyword) {
      tokens.push({ type: 'keyword', content: keyword[0] })
      remaining = remaining.slice(keyword[0].length)
      continue
    }

    // Punctuation
    const punct = remaining.match(/^[{}[\]:,]/)
    if (punct) {
      tokens.push({ type: 'punctuation', content: punct[0] })
      remaining = remaining.slice(1)
      continue
    }

    tokens.push({ type: 'plain', content: remaining[0] })
    remaining = remaining.slice(1)
  }

  return tokens
}

function tokenizeHTML(line: string): Token[] {
  const tokens: Token[] = []
  let remaining = line

  while (remaining.length > 0) {
    // Comment
    const comment = remaining.match(/^<!--[\s\S]*?-->/)
    if (comment) {
      tokens.push({ type: 'comment', content: comment[0] })
      remaining = remaining.slice(comment[0].length)
      continue
    }

    // Tag
    const tag = remaining.match(/^<\/?[\w-]+/)
    if (tag) {
      tokens.push({ type: 'tag', content: tag[0] })
      remaining = remaining.slice(tag[0].length)
      continue
    }

    // Attribute
    const attr = remaining.match(/^[\w-]+(?==)/)
    if (attr) {
      tokens.push({ type: 'attribute', content: attr[0] })
      remaining = remaining.slice(attr[0].length)
      continue
    }

    // String
    const str = remaining.match(/^(['"])(?:[^\\]|\\.)*?\1/)
    if (str) {
      tokens.push({ type: 'string', content: str[0] })
      remaining = remaining.slice(str[0].length)
      continue
    }

    // Closing bracket
    if (remaining[0] === '>' || remaining.startsWith('/>')) {
      const close = remaining.startsWith('/>') ? '/>' : '>'
      tokens.push({ type: 'tag', content: close })
      remaining = remaining.slice(close.length)
      continue
    }

    tokens.push({ type: 'plain', content: remaining[0] })
    remaining = remaining.slice(1)
  }

  return tokens
}

function tokenizeCSS(line: string): Token[] {
  const tokens: Token[] = []
  let remaining = line

  while (remaining.length > 0) {
    // Comment
    const comment = remaining.match(/^\/\*[\s\S]*?\*\//)
    if (comment) {
      tokens.push({ type: 'comment', content: comment[0] })
      remaining = remaining.slice(comment[0].length)
      continue
    }

    // String
    const str = remaining.match(/^(['"])(?:[^\\]|\\.)*?\1/)
    if (str) {
      tokens.push({ type: 'string', content: str[0] })
      remaining = remaining.slice(str[0].length)
      continue
    }

    // Property
    const prop = remaining.match(/^[\w-]+(?=\s*:)/)
    if (prop) {
      tokens.push({ type: 'property', content: prop[0] })
      remaining = remaining.slice(prop[0].length)
      continue
    }

    // Number with unit
    const num = remaining.match(/^-?\d+\.?\d*(?:px|em|rem|%|vh|vw|deg|s|ms)?/)
    if (num) {
      tokens.push({ type: 'number', content: num[0] })
      remaining = remaining.slice(num[0].length)
      continue
    }

    // Selector or keyword
    const ident = remaining.match(/^[.#@]?[\w-]+/)
    if (ident) {
      const word = ident[0]
      if (
        word.startsWith('.') ||
        word.startsWith('#') ||
        word.startsWith('@')
      ) {
        tokens.push({ type: 'keyword', content: word })
      } else {
        tokens.push({ type: 'plain', content: word })
      }
      remaining = remaining.slice(word.length)
      continue
    }

    // Punctuation
    const punct = remaining.match(/^[{}();:,]/)
    if (punct) {
      tokens.push({ type: 'punctuation', content: punct[0] })
      remaining = remaining.slice(1)
      continue
    }

    tokens.push({ type: 'plain', content: remaining[0] })
    remaining = remaining.slice(1)
  }

  return tokens
}

function tokenizeMarkdown(line: string): Token[] {
  const tokens: Token[] = []

  // Headings
  if (/^#{1,6}\s/.test(line)) {
    tokens.push({ type: 'keyword', content: line })
    return tokens
  }

  // Code block fence
  if (line.startsWith('```')) {
    tokens.push({ type: 'comment', content: line })
    return tokens
  }

  // Inline code, bold, italic
  let remaining = line
  while (remaining.length > 0) {
    // Inline code
    const code = remaining.match(/^`[^`]+`/)
    if (code) {
      tokens.push({ type: 'string', content: code[0] })
      remaining = remaining.slice(code[0].length)
      continue
    }

    // Bold
    const bold = remaining.match(/^\*\*[^*]+\*\*/)
    if (bold) {
      tokens.push({ type: 'keyword', content: bold[0] })
      remaining = remaining.slice(bold[0].length)
      continue
    }

    // Link
    const link = remaining.match(/^\[[^\]]+\]\([^)]+\)/)
    if (link) {
      tokens.push({ type: 'function', content: link[0] })
      remaining = remaining.slice(link[0].length)
      continue
    }

    tokens.push({ type: 'plain', content: remaining[0] })
    remaining = remaining.slice(1)
  }

  return tokens
}
