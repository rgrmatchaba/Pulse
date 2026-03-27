const baseHeaders = {
    'Authorization': `Basic ${Buffer.from(
      `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
    ).toString('base64')}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  
  export interface JiraTicket {
    id: string
    key: string
    summary: string
    status: string
    assignee: string | null
    priority: string
    updatedAt: string
    daysOpen: number
  }
  
  export async function getActiveSprint(): Promise<JiraTicket[]> {
    // Step 1: get the active sprint for our board
    const sprintRes = await fetch(
      `${process.env.JIRA_BASE_URL}/rest/agile/1.0/board/${process.env.JIRA_BOARD_ID}/sprint?state=active`,
      { headers: baseHeaders }
    )
  
    if (!sprintRes.ok) {
      throw new Error(`Failed to fetch sprint: ${sprintRes.status}`)
    }
  
    const sprintData = await sprintRes.json()
    const sprint = sprintData.values[0]
  
    if (!sprint) throw new Error('No active sprint found')
  
    // Step 2: get all issues in that sprint
    const issuesRes = await fetch(
      `${process.env.JIRA_BASE_URL}/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=50`,
      { headers: baseHeaders }
    )
  
    if (!issuesRes.ok) {
      throw new Error(`Failed to fetch issues: ${issuesRes.status}`)
    }
  
    const issuesData = await issuesRes.json()
  
    // Step 3: shape the data into what Pulse needs
    return issuesData.issues.map((issue: any): JiraTicket => {
      const created = new Date(issue.fields.created)
      const now = new Date()
      const daysOpen = Math.floor(
        (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      )
  
      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        assignee: issue.fields.assignee?.displayName ?? null,
        priority: issue.fields.priority?.name ?? 'None',
        updatedAt: issue.fields.updated,
        daysOpen
      }
    })
  }
  
  export async function getTransitions(issueKey: string) {
    const res = await fetch(
      `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`,
      { headers: baseHeaders }
    )
    const data = await res.json()
    return data.transitions
  }
  
  export async function updateTicketStatus(issueKey: string, transitionName: string) {
    // First fetch available transitions — we can't hardcode IDs
    const transitions = await getTransitions(issueKey)
    const transition = transitions.find(
      (t: any) => t.name.toLowerCase() === transitionName.toLowerCase()
    )
  
    if (!transition) {
      throw new Error(`Transition "${transitionName}" not found for ${issueKey}`)
    }
  
    const res = await fetch(
      `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`,
      {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ transition: { id: transition.id } })
      }
    )
  
    if (!res.ok) throw new Error(`Failed to transition ${issueKey}: ${res.status}`)
    return true
  }
  
  export async function addComment(issueKey: string, comment: string) {
    const res = await fetch(
      `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/comment`,
      {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          body: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: comment }]
            }]
          }
        })
      }
    )
  
    if (!res.ok) throw new Error(`Failed to add comment to ${issueKey}: ${res.status}`)
    return true
  }

  export function detectStaleTickets(tickets: JiraTicket[]): JiraTicket[] {
    return tickets.filter(ticket => {
      const isActive = !ticket.status.toLowerCase().includes('done') &&
                       !ticket.status.toLowerCase().includes('backlog')
      const isStale = ticket.daysOpen >= 3
      return isActive && isStale
    })
  }