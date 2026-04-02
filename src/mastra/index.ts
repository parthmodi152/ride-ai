import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { Observability, DefaultExporter } from '@mastra/observability'
import { uberAgent } from './agents/uber-agent.js'

export const mastra = new Mastra({
  agents: { uberAgent },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'agentic-uber',
        exporters: [new DefaultExporter()],
      },
    },
  }),
})
