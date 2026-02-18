import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { AgentWallet } from '@veridex/agentic-payments';

export interface ToolDefinition {
  declaration: FunctionDeclaration;
  execute: (args: any) => Promise<any>;
}

/**
 * Build Gemini-compatible function declarations from the agent's MCP tools.
 */
export function buildGeminiTools(agent: AgentWallet): ToolDefinition[] {
  const mcpTools = agent.getMCPTools();

  return mcpTools.map((tool) => ({
    declaration: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties: tool.inputSchema.properties as any,
        required: tool.inputSchema.required || [],
      },
    },
    execute: async (args: any) => {
      // Sanitize decimal amounts for veridex_pay
      if (
        tool.name === 'veridex_pay' &&
        typeof args.amount === 'string' &&
        args.amount.includes('.')
      ) {
        args.amount = BigInt(Math.floor(parseFloat(args.amount))).toString();
      }

      const result = await tool.handler(args);

      // Serialize BigInts for JSON
      return JSON.parse(
        JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
      );
    },
  }));
}

/**
 * Stateful Gemini chat agent with function calling.
 */
export class GeminiAgent {
  private chat: any;
  private tools: ToolDefinition[] = [];

  constructor(
    private apiKey: string,
    private agentWallet: AgentWallet
  ) {}

  async initialize(): Promise<void> {
    this.tools = buildGeminiTools(this.agentWallet);

    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ functionDeclarations: this.tools.map((t) => t.declaration) }],
    });

    this.chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [
            {
              text: `You are VeriAgent, an AI assistant with a crypto wallet powered by Veridex.

RULES for 'veridex_pay':
1. AMOUNTS: Convert to atomic units (integers, no decimals).
   - USDC (6 decimals): multiply by 1,000,000. Example: 10 USDC → "10000000"
   - ETH (18 decimals): multiply by 10^18.
2. CHAIN IDs (Wormhole): Base Sepolia=10004, Ethereum Sepolia=10002, Arbitrum Sepolia=10003, Optimism Sepolia=10005
3. TOKEN: Use lowercase symbol like "usdc", "eth", "native"
4. Always check balance before large payments.
5. Report transaction hashes and remaining budget after payments.`,
            },
          ],
        },
        {
          role: 'model',
          parts: [{ text: 'Understood. I am VeriAgent, ready to assist with payments and wallet operations.' }],
        },
      ],
    });
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.chat) await this.initialize();

    let result = await this.chat.sendMessage(message);
    let response = result.response;

    // Function calling loop
    while (true) {
      const functionCalls = response.functionCalls();
      if (!functionCalls?.length) break;

      for (const call of functionCalls) {
        const tool = this.tools.find((t) => t.declaration.name === call.name);
        if (!tool) break;

        let apiResponse;
        try {
          apiResponse = await tool.execute(call.args);
        } catch (e: any) {
          apiResponse = { error: e.message };
        }

        result = await this.chat.sendMessage([
          {
            functionResponse: {
              name: call.name,
              response: { result: apiResponse },
            },
          },
        ]);
        response = result.response;
      }
    }

    return response.text();
  }
}
