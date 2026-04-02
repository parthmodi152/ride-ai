import * as readline from 'node:readline'
import { RequestContext } from '@mastra/core/request-context'
import { MockUberAdapter } from './mastra/adapters/uber-mock.js'
import { mastra } from './mastra/index.js'

const adapter = new MockUberAdapter()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer)
    })
  })
}

async function askApproval(toolName: string, args: Record<string, unknown>): Promise<boolean> {
  console.log(`\n[APPROVAL REQUIRED] Tool: ${toolName}`)
  console.log(`  Args: ${JSON.stringify(args, null, 2)}`)
  const answer = await prompt('  Approve? (y/n): ')
  return answer.trim().toLowerCase() === 'y'
}

async function main() {
  const agent = mastra.getAgent('uberAgent')
  const threadId = `thread-${Date.now()}`
  const resourceId = 'cli-user'

  console.log('Agentic Uber CLI')
  console.log('Type "quit" to exit.\n')

  while (true) {
    const userInput = await prompt('You: ')
    if (userInput.trim().toLowerCase() === 'quit') {
      console.log('Goodbye!')
      break
    }
    if (!userInput.trim()) continue

    const requestContext = new RequestContext()
    requestContext.set('adapter', adapter)

    const stream = await agent.stream(userInput, {
      requestContext,
      requireToolApproval: true,
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    })

    process.stdout.write('\nAgent: ')

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.payload.text)
      } else if (chunk.type === 'tool-call-approval') {
        const approved = await askApproval(
          chunk.payload.toolName,
          chunk.payload.args,
        )

        if (approved) {
          const resumeStream = await agent.approveToolCall({
            runId: stream.runId!,
            toolCallId: chunk.payload.toolCallId,
          })
          for await (const c of resumeStream.textStream) {
            process.stdout.write(c)
          }
        } else {
          const resumeStream = await agent.declineToolCall({
            runId: stream.runId!,
            toolCallId: chunk.payload.toolCallId,
          })
          for await (const c of resumeStream.textStream) {
            process.stdout.write(c)
          }
        }
      } else if (chunk.type === 'error') {
        console.error('\n[ERROR]', chunk.payload.error)
      }
    }

    process.stdout.write('\n\n')
  }

  rl.close()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
