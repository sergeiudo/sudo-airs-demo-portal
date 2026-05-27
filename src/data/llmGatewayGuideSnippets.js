// Three-language copy-paste-runnable snippets for the Integration Guide tab.
// Each language has the same 5 steps. Placeholders are intentional — users
// drop their own keys into .env before running.

export const GUIDE_STEPS = ['Set env vars', 'Init client', 'Chat request', 'Read hook_results', 'Stream tokens']

export const GUIDE_SNIPPETS = {
  curl: {
    'Set env vars': {
      lang: 'bash',
      code:
`export PORTKEY_API_KEY="pk-..."
export PORTKEY_CONFIG_AIRS="pc-sudo-a-315f92"
export PORTKEY_MODEL="@sudo-vertexai/gemini-2.0-flash-001"`,
    },
    'Init client': {
      lang: 'bash',
      code: `# curl is stateless — no client init step. Move on to the chat request.`,
    },
    'Chat request': {
      lang: 'bash',
      code:
`curl https://api.portkey.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-portkey-api-key: $PORTKEY_API_KEY" \\
  -H "x-portkey-config: $PORTKEY_CONFIG_AIRS" \\
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
`# Pipe through jq to inspect the Portkey extension fields:
curl ... | jq '.model_extra.hook_results'

# Sample shape returned when the AIRS guardrail fires:
# {
#   "before_request_hooks": [
#     { "id": "pg-sudo-a-c3bfdd", "verdict": false, "transformed": false,
#       "data": { "action": "block", "prompt_detected": { "injection": true } } }
#   ],
#   "after_request_hooks": []
# }`,
    },
    'Stream tokens': {
      lang: 'bash',
      code:
`curl -N https://api.portkey.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-portkey-api-key: $PORTKEY_API_KEY" \\
  -H "x-portkey-config: $PORTKEY_CONFIG_AIRS" \\
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
PORTKEY_MODEL=@sudo-vertexai/gemini-2.0-flash-001`,
    },
    'Init client': {
      lang: 'javascript',
      code:
`import { Portkey } from 'portkey-ai'
import 'dotenv/config'

const portkey = new Portkey({
  apiKey: process.env.PORTKEY_API_KEY,
  config: process.env.PORTKEY_CONFIG_AIRS,
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
`const hookResults = completion.model_extra?.hook_results
if (hookResults) {
  const blocked = (hookResults.before_request_hooks || [])
    .some(h => h.verdict === false)
  if (blocked) {
    console.warn('Blocked by AIRS guardrail:', hookResults.before_request_hooks)
  }
}`,
    },
    'Stream tokens': {
      lang: 'javascript',
      code:
`const stream = await portkey.chat.completions.create({
  model: process.env.PORTKEY_MODEL,
  messages: [{ role: 'user', content: 'Say hi.' }],
  stream: true,
})

let hookResults = null
for await (const chunk of stream) {
  const token = chunk.choices?.[0]?.delta?.content || ''
  if (token) process.stdout.write(token)
  if (chunk.model_extra?.hook_results) hookResults = chunk.model_extra.hook_results
}
console.log('\\n\\nhook_results:', hookResults)`,
    },
  },

  python: {
    'Set env vars': {
      lang: 'bash',
      code:
`# .env (do not commit)
PORTKEY_API_KEY=pk-...
PORTKEY_CONFIG_AIRS=pc-sudo-a-315f92
PORTKEY_MODEL=@sudo-vertexai/gemini-2.0-flash-001`,
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
`hook_results = completion.model_extra.get("hook_results") if completion.model_extra else None
if hook_results:
    blocked = any(h.get("verdict") is False for h in hook_results.get("before_request_hooks", []))
    if blocked:
        print("Blocked by AIRS guardrail:", hook_results["before_request_hooks"])`,
    },
    'Stream tokens': {
      lang: 'python',
      code:
`stream = portkey.chat.completions.create(
    model=os.environ["PORTKEY_MODEL"],
    messages=[{"role": "user", "content": "Say hi."}],
    stream=True,
)

hook_results = None
for chunk in stream:
    token = chunk.choices[0].delta.content or ""
    if token:
        print(token, end="", flush=True)
    if chunk.model_extra and chunk.model_extra.get("hook_results"):
        hook_results = chunk.model_extra["hook_results"]
print("\\n\\nhook_results:", hook_results)`,
    },
  },
}
