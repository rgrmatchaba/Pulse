import Groq from 'groq-sdk'
import type { ChatCompletionTool } from 'groq-sdk/resources/chat'
import { getActiveSprint, updateTicketStatus, addComment, JiraTicket } from './jira'


export interface CommitInfo {
    id: string
    message: string
    timestamp: string
    filesChanged: string[]
    additions: number
    deletions: number
  }
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
  })


  const tools: ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name:"get_sprint_tickets",
            description: "Get all the tickets in the current active sprint",
            parameters: {
                type: 'object',
                properties:{},
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_ticket_status",
            description: "Move the Jira ticket to a different status",
            parameters: {
                type: 'object',
                properties: {
                    issueKey:{
                        type: 'string',
                        description: 'The Jira ticket key e.g. JR-123',
                    },
                    status:{
                        type: 'string',
                        description: 'The target status e.g. In Progress, In Review, Done',
                    }
                },
                required: ['issueKey', 'status']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'add_comment',
            description: 'Add a comment to a jira ticket',
            parameters: {
                type: 'object',
                properties: {
                    issueKey: {
                        type: 'string',
                        description: 'The Jira ticket key eg JR-123',
                    }, 
                    comment: {
                        type: 'string',
                        description: 'The comment to add to the ticket',
                    }
                }, 
                required: ['issueKey', 'comment']
            }
        }
    }
  ]


  async function executeTool(name: string, args: Record<string, string>): Promise<string> {
    switch(name) {
        case 'get_sprint_tickets' : {
            const ticekts = await getActiveSprint();
            return JSON.stringify(ticekts);
        }
        case "update_ticket_status" : {
            await updateTicketStatus(args.issueKey, args.status);
            return 'Successfully moved ${args.issueKey} to ${args.status}';
        }
        case 'add_comment' : {
            await addComment(args.issueKey, args.comment);
            return 'Successfully added comment to ${args.issueKey}';
        }
        default: {
            throw new Error(`Unknown tool: ${name}`);
        }
    }
  }


  export interface Message {
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: string;
    tool_call_id?: string;
    name?: string;
  }




  export async function runAgent( userMessage: string, conversationHistory: Message[] = []): Promise<{response: string; history: Message[]}> {
    const systemPrompt = `You are Pulse, an AI engineering co-pilot.
    You help developers manage their Jira sprint through voice and text commands.
    You have access to their active sprint tickets and can update statuses and add comments.
    Be concise and direct. Confirm actions clearly.
    When reading tickets, mention the key, summary, status and how many days it has been open.
    Never make up ticket keys — only use tickets returned by get_sprint_tickets.`

    const messages: any[] = [ 
        { role: 'system', content: systemPrompt},
        ...conversationHistory,
        {role : 'user', content: userMessage}
    ]


    while(true)
    {
        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages,
            tools,
            tool_choice: 'auto',
            max_tokens: 1024
        })

        const assistantMessage = response.choices[0].message

        // Always push what Groq returned into the messages array
        // This is how the agent remembers what it already did
        messages.push(assistantMessage)

        // If Groq wants to call tools, execute them
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name
          const toolArgs = JSON.parse(toolCall.function.arguments)
  
          console.log(`Agent calling tool: ${toolName}`, toolArgs)
  
          const toolResult = await executeTool(toolName, toolArgs)
  
          // Push the tool result back — Groq needs to see
          // what the tool returned before it can continue
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: toolResult
          })
        }
        // Loop again — Groq will now process the tool results
        continue
      }

      // No tool calls means Groq is done — return the final response
    const finalResponse = assistantMessage.content ?? 'Done.'

    // Return response + updated history (excluding system prompt)
    const updatedHistory: Message[] = messages
      .slice(1) // remove system prompt
      .filter(m => m.role !== 'tool') // keep it clean for the client
      .map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : ''
      }))

    return { response: finalResponse, history: updatedHistory }
        
    }
    const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 1000,
    })
    
  }


  export async function mapCommitToTicket(
    commit: CommitInfo,
    tickets: JiraTicket[]
  ): Promise<{ ticketKey: string | null; confidence: string; reasoning: string }> {
  
    const prompt = `You are analyzing a Git commit to determine which Jira ticket it relates to.
  
  Commit message: "${commit.message}"
  Files changed: ${commit.filesChanged.join(', ')}
  
  Open Jira tickets:
  ${tickets.map(t => `- ${t.key}: ${t.summary} (status: ${t.status})`).join('\n')}
  
  Based on the commit message and files changed, which Jira ticket does this commit most likely relate to?
  Respond with JSON only in this exact format:
  {
    "ticketKey": "PWP-1 or null if no match",
    "confidence": "high/medium/low",
    "reasoning": "one sentence very detailed explanation of why you think this commit relates to the ticket"
  }`
  
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.1  // low temperature = more deterministic matching
    })
  
    const content = response.choices[0].message.content ?? '{}'
  
    try {
      // Strip any markdown fences if Groq adds them
      const clean = content.replace(/```json|```/g, '').trim()
      return JSON.parse(clean)
    } catch {
      return { ticketKey: null, confidence: 'low', reasoning: 'Failed to parse response' }
    }
  }