// Three-language copy-paste-runnable snippets for the Integration Guide tab.
// Each language has the same 5 steps. Placeholders are intentional — users
// drop their own keys into .env before running.
//
// IMPORTANT: strict OpenAI compliance must be DISABLED (header
// x-portkey-strict-open-ai-compliance: false) or Portkey strips hook_results
// from allowed responses and you only ever see guardrail verdicts on blocks.

export const GUIDE_STEPS = ['Set env vars', 'Init client', 'Chat request', 'Read hook_results', 'Stream tokens']

export const GUIDE_SNIPPETS = {
  curl: {
    'Set env vars': {
      lang: 'bash',
      code:
`export PORTKEY_API_KEY="pk-..."
export PORTKEY_CONFIG_AIRS="pc-sudo-a-315f92"
export PORTKEY_MODEL="@sudo-vertexai/gemini-2.5-flash"`,
    },
    'Init client': {
      lang: 'bash',
      code: `# curl is stateless — no client init step. Move on to the chat request.`,
    },
    'Chat request': {
      lang: 'bash',
      code:
`# strict-open-ai-compliance:false ⇒ hook_results included even when allowed
curl https://api.portkey.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-portkey-api-key: $PORTKEY_API_KEY" \\
  -H "x-portkey-config: $PORTKEY_CONFIG_AIRS" \\
  -H "x-portkey-strict-open-ai-compliance: false" \\
  -d '{
    "model": "'$PORTKEY_MODEL'",
    "messages": [
      {"role": "user", "content": "Explain OAuth2 client credentials in two sentences."}
    ]
  }'`,
    },
    'Read hook_results': {
      lang: 'bash',
      code:
`# hook_results is a TOP-LEVEL field on the response body:
curl ... | jq '.hook_results'

# Allowed response — verdict true, full AIRS scan report included:
# {
#   "before_request_hooks": [
#     { "verdict": true, "checks": [{ "id": "panw-prisma-airs.intercept",
#       "data": { "action": "allow", "category": "benign",
#                 "profile_name": "...", "scan_id": "..." } }] }
#   ],
#   "after_request_hooks": [ { "verdict": true, ... } ]
# }
#
# When AIRS DENIES the prompt, Portkey returns an error body instead:
# { "error": { "type": "hooks_failed", ... }, "hook_results": { ... } }`,
    },
    'Stream tokens': {
      lang: 'bash',
      code:
`# With streaming, hook_results arrive as dedicated SSE chunks:
# input-scan results BEFORE the first token, output-scan after the last.
curl -N https://api.portkey.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-portkey-api-key: $PORTKEY_API_KEY" \\
  -H "x-portkey-config: $PORTKEY_CONFIG_AIRS" \\
  -H "x-portkey-strict-open-ai-compliance: false" \\
  -d '{
    "model": "'$PORTKEY_MODEL'",
    "stream": true,
    "messages": [{"role":"user","content":"Say hi."}]
  }'`,
    },
  },

  node: {
    'Set env vars': {
      lang: 'bash',
      code:
`# .env (do not commit)
PORTKEY_API_KEY=pk-...
PORTKEY_CONFIG_AIRS=pc-sudo-a-315f92
PORTKEY_MODEL=@sudo-vertexai/gemini-2.5-flash`,
    },
    'Init client': {
      lang: 'javascript',
      code:
`import { Portkey } from 'portkey-ai'
import 'dotenv/config'

const portkey = new Portkey({
  apiKey: process.env.PORTKEY_API_KEY,
  config: process.env.PORTKEY_CONFIG_AIRS,
  // Required to receive hook_results (AIRS verdicts) on allowed responses
  strictOpenAiCompliance: false,
})`,
    },
    'Chat request': {
      lang: 'javascript',
      code:
`const completion = await portkey.chat.completions.create({
  model: process.env.PORTKEY_MODEL,
  messages: [
    { role: 'user', content: 'Explain OAuth2 client credentials in two sentences.' },
  ],
})

console.log(completion.choices[0].message.content)`,
    },
    'Read hook_results': {
      lang: 'javascript',
      code:
`// Node SDK: hook_results is a top-level field on the completion object.
const hookResults = completion.hook_results
for (const h of hookResults?.before_request_hooks || []) {
  const airs = h.checks?.find(c => c.id === 'panw-prisma-airs.intercept')
  console.log('AIRS input scan:', airs?.data?.action, airs?.data?.category)
}

// When AIRS DENIES the prompt, the SDK THROWS — the error message is a
// JSON string carrying the same hook_results:
try {
  await portkey.chat.completions.create({ /* hostile prompt */ })
} catch (e) {
  const parsed = JSON.parse(e.message)
  console.warn('Blocked by AIRS:', parsed.hook_results.before_request_hooks)
}`,
    },
    'Stream tokens': {
      lang: 'javascript',
      code:
`const stream = await portkey.chat.completions.create({
  model: process.env.PORTKEY_MODEL,
  messages: [{ role: 'user', content: 'Say hi.' }],
  stream: true,
  stream_options: { include_usage: true },  // real token counts in final chunk
})

// hook_results arrive as dedicated chunks: input scan BEFORE the first
// token, output scan after the last.
let hookResults = null
for await (const chunk of stream) {
  if (chunk.hook_results) { hookResults = chunk.hook_results; continue }
  if (chunk.usage) console.log('\\ntokens:', chunk.usage.completion_tokens)
  const token = chunk.choices?.[0]?.delta?.content || ''
  if (token) process.stdout.write(token)
}
console.log('\\nhook_results:', JSON.stringify(hookResults, null, 2))`,
    },
  },

  python: {
    'Set env vars': {
      lang: 'bash',
      code:
`# .env (do not commit)
PORTKEY_API_KEY=pk-...
PORTKEY_CONFIG_AIRS=pc-sudo-a-315f92
PORTKEY_MODEL=@sudo-vertexai/gemini-2.5-flash`,
    },
    'Init client': {
      lang: 'python',
      code:
`import os
from dotenv import load_dotenv
from portkey_ai import Portkey

load_dotenv()
portkey = Portkey(
    api_key=os.environ["PORTKEY_API_KEY"],
    config=os.environ["PORTKEY_CONFIG_AIRS"],
    # Required to receive hook_results (AIRS verdicts) on allowed responses
    strict_open_ai_compliance=False,
)`,
    },
    'Chat request': {
      lang: 'python',
      code:
`completion = portkey.chat.completions.create(
    model=os.environ["PORTKEY_MODEL"],
    messages=[{"role": "user", "content": "Explain OAuth2 client credentials in two sentences."}],
)
print(completion.choices[0].message.content)`,
    },
    'Read hook_results': {
      lang: 'python',
      code:
`# Python SDK (pydantic): extension fields live under model_extra.
hook_results = completion.model_extra.get("hook_results") if completion.model_extra else None
for h in (hook_results or {}).get("before_request_hooks", []):
    airs = next((c for c in h.get("checks", []) if c.get("id") == "panw-prisma-airs.intercept"), None)
    if airs:
        print("AIRS input scan:", airs["data"]["action"], airs["data"]["category"])

# When AIRS DENIES the prompt the SDK raises — the exception body carries
# the same hook_results payload.`,
    },
    'Stream tokens': {
      lang: 'python',
      code:
`stream = portkey.chat.completions.create(
    model=os.environ["PORTKEY_MODEL"],
    messages=[{"role": "user", "content": "Say hi."}],
    stream=True,
    stream_options={"include_usage": True},
)

# hook_results arrive as dedicated chunks: input scan before the first
# token, output scan after the last.
hook_results = None
for chunk in stream:
    extra = chunk.model_extra or {}
    if extra.get("hook_results"):
        hook_results = extra["hook_results"]
        continue
    if chunk.choices and chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
print("\\n\\nhook_results:", hook_results)`,
    },
  },
}
