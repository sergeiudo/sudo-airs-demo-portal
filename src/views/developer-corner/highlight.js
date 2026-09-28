/**
 * highlight.js — a small, dependency-free syntax highlighter for the code the
 * Developer Corner shows: bash, python, javascript, json and yaml.
 *
 * One regex pass per language, first match wins, so strings and comments are
 * never re-coloured from the inside. Returns [{ text, kind }] tokens; the
 * viewer maps kinds to colours. Good enough for documentation, not a parser.
 */

const KEYWORDS = {
  python: 'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|None|True|False',
  javascript: 'async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|switch|throw|try|typeof|var|void|while|yield|null|undefined|true|false|this',
  bash: 'if|then|else|elif|fi|for|while|do|done|in|case|esac|function|export|set|local|return|echo|exit',
  yaml: 'true|false|null|yes|no|on|off',
  go: 'break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var|nil|true|false|any|string|int|error',
  java: 'abstract|boolean|break|case|catch|class|else|extends|final|finally|for|if|implements|import|instanceof|int|interface|new|null|package|private|protected|public|return|static|String|super|switch|this|throw|throws|try|var|void|while|true|false',
}

function rules(lang) {
  const kw = KEYWORDS[lang]
  if (lang === 'json') {
    return [
      ['key', /"(?:[^"\\]|\\.)*"(?=\s*:)/y],
      ['string', /"(?:[^"\\]|\\.)*"/y],
      ['number', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y],
      ['keyword', /\b(?:true|false|null)\b/y],
    ]
  }
  if (lang === 'yaml') {
    return [
      ['comment', /#[^\n]*/y],
      ['key', /[A-Za-z_][\w.-]*(?=\s*:(?:\s|$))/y],
      ['string', /"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/y],
      ['variable', /\$\{\{[^}]*\}\}|\$\{[^}]*\}|\$[A-Za-z_]\w*/y],
      ['number', /\b\d+(?:\.\d+)?\b/y],
      ['keyword', new RegExp(`\\b(?:${kw})\\b`, 'y')],
    ]
  }
  if (lang === 'bash') {
    return [
      ['comment', /#[^\n]*/y],
      ['string', /"(?:[^"\\]|\\.)*"|'[^']*'/y],
      ['variable', /\$\{[^}]*\}|\$[A-Za-z_]\w*|\$\(/y],
      ['flag', /(?<=\s)--?[A-Za-z][\w-]*/y],
      ['keyword', new RegExp(`\\b(?:${kw})\\b`, 'y')],
      ['function', /\b(?:curl|pip|uv|python3?|node|npm|npx|jq|kubectl|helm|model-security|export|terraform|git)\b/y],
      ['number', /\b\d+\b/y],
    ]
  }
  // python + javascript
  const str = lang === 'python'
    ? /(?:[rbfu]{0,2})(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/y
    : /`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y
  return [
    ['comment', lang === 'python' ? /#[^\n]*/y : /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
    ['string', str],
    ['keyword', new RegExp(`\\b(?:${kw})\\b`, 'y')],
    ['number', /\b\d+(?:\.\d+)?\b/y],
    ['function', /\b[A-Za-z_]\w*(?=\s*\()/y],
    ['property', /(?<=\.)[A-Za-z_]\w*/y],
  ]
}

export function tokenize(code, lang) {
  const text = String(code ?? '')
  const rs = rules(lang === 'shell' || lang === 'sh' ? 'bash' : lang === 'js' || lang === 'node' || lang === 'typescript' ? 'javascript' : KEYWORDS[lang] || lang === 'json' ? lang : 'javascript')
  if (!rs.length) return [{ text, kind: 'plain' }]
  const out = []
  let plain = ''
  let i = 0
  while (i < text.length) {
    let hit = null
    for (const [kind, re] of rs) {
      re.lastIndex = i
      const m = re.exec(text)
      if (m && m.index === i && m[0].length) { hit = { kind, text: m[0] }; break }
    }
    if (hit) {
      if (plain) { out.push({ text: plain, kind: 'plain' }); plain = '' }
      out.push(hit)
      i += hit.text.length
    } else {
      plain += text[i]
      i += 1
    }
  }
  if (plain) out.push({ text: plain, kind: 'plain' })
  return out
}

// GitHub-dark palette — the code panel is forced dark in both themes (CLAUDE.md).
export const TOKEN_COLOR = {
  plain: '#c9d1d9',
  comment: '#8b949e',
  string: '#a5d6ff',
  keyword: '#ff7b72',
  number: '#79c0ff',
  function: '#d2a8ff',
  property: '#79c0ff',
  key: '#7ee787',
  variable: '#ffa657',
  flag: '#79c0ff',
}
