import { Agent } from '@mastra/core/agent'
import { ToolSearchProcessor } from '@mastra/core/processors'
import { Workspace, LocalFilesystem } from '@mastra/core/workspace'
import { Memory } from '@mastra/memory'
import {
  geocodeAddressTool,
  getEstimatesTool,
  bookRideTool,
  trackRideTool,
  cancelRideTool,
} from '../tools/index.js'

const toolSearch = new ToolSearchProcessor({
  tools: {
    'geocode-address': geocodeAddressTool,
    'get-estimates': getEstimatesTool,
    'book-ride': bookRideTool,
    'track-ride': trackRideTool,
    'cancel-ride': cancelRideTool,
  },
  search: {
    topK: 5,
    minScore: 0.1,
  },
})

const workspace = new Workspace({
  id: 'uber-skills',
  name: 'Uber Skills',
  filesystem: new LocalFilesystem({
    basePath: './src/skills',
  }),
  skills: ['./booking-flow'],
})

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      scope: 'resource',
      template: `# Rider Profile
- **Name**:
- **Preferred Ride Type**: [e.g., UberX, UberXL, Black]
- **Saved Addresses**:
  - Home:
  - Work:
  - Other:
- **Payment Preference**:
- **Special Instructions**:
`,
    },
  },
})

export const uberAgent = new Agent({
  id: 'uber-agent',
  name: 'Uber Agent',
  instructions: `You are a ride-booking assistant. You help users discover ride options, compare prices, book rides, track them, and cancel if needed.

IMPORTANT RULES:
- At the start of a conversation, load the "booking-flow" skill to understand the full booking workflow.
- Always use search_tools to find the right tool before acting.
- Always geocode addresses before getting estimates.
- NEVER book a ride without the user explicitly confirming.
- Present price comparisons clearly in a table format.
- Warn users about surge pricing before proceeding.
- Check ride status before cancelling so you can warn about fees.
- If you learn the user's name, home address, or preferences, update your working memory.`,
  model: process.env.MODEL_PROVIDER || 'anthropic/claude-sonnet-4-5',
  inputProcessors: [toolSearch],
  workspace,
  memory,
})
