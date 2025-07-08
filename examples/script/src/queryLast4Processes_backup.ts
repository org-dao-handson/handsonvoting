// src/queryLast4Processes.ts
import 'dotenv/config'
import { VocdoniApiService } from '../../../src/sequencer'

const { API_URL, ORGANIZATION_ID } = process.env
if (!API_URL || !ORGANIZATION_ID) {
  console.error('❌ set API_URL and ORGANIZATION_ID in .env')
  process.exit(1)
}

async function main() {
  const api = new VocdoniApiService(API_URL!)

  console.log(`🔍 fetching all process IDs…`)
  let allIds: string[] = []
  try {
    allIds = await api.listProcesses()
  } catch (err) {
    console.error('❌ error listing processes:', err)
    process.exit(1)
  }

  console.log(`ℹ️  found ${allIds.length} total processes; fetching details…`)
  const details = await Promise.all(
    allIds.map(async id => {
      try {
        return await api.getProcess(id)
      } catch (err) {
        console.error(`❌ error fetching process ${id}:`, err)
        return null
      }
    })
  )

  const validDetails = details.filter(
    (d): d is { id: string; organizationId: string; creationTime?: string; duration?: number; status: string; metadataURI?: string } => Boolean(d)
  )

  // Filter to your org, then sort by creationTime if available, else by processId numeric value
  const filtered = validDetails.filter(
    p => p.organizationId.toLowerCase() === ORGANIZATION_ID.toLowerCase()
  )
  const sorted = filtered.sort((a, b) => {
    const aTime = pDateValue(a.creationTime)
    const bTime = pDateValue(b.creationTime)
    if (!isNaN(aTime) || !isNaN(bTime)) {
      return bTime - aTime
    }
    // fallback: sort by numeric processId
    try {
      return BigInt(b.id) > BigInt(a.id) ? 1 : BigInt(b.id) < BigInt(a.id) ? -1 : 0
    } catch {
      return 0
    }
  })
  const last4 = sorted.slice(0, 4)

  if (last4.length === 0) {
    console.log(`⚠️ no processes found for org ${ORGANIZATION_ID}`)
    return
  }

  console.log(`✅ Last ${last4.length} processes for ${ORGANIZATION_ID}:`)
  last4.forEach((p, i) => {
    console.log(`\n— #${i+1} —`)
    console.log(`ID:         ${p.id}`)
    console.log(`Status:     ${p.status}`)

    // Created at
    if (p.creationTime) {
      const cd = new Date(p.creationTime)
      console.log(`Created at: ${!isNaN(cd.valueOf()) ? cd.toISOString() : `<invalid> ${p.creationTime}`}`)
    } else {
      console.log(`Created at: <unknown>`)      
    }

    // Duration & end time
    if (typeof p.duration === 'number') {
      console.log(`Duration:   ${p.duration}s`)
      const startMs = p.creationTime ? new Date(p.creationTime).valueOf() : NaN
      if (!isNaN(startMs)) {
        const endMs = startMs + p.duration * 1000
        const ed = new Date(endMs)
        console.log(`Ends at:    ${!isNaN(ed.valueOf()) ? ed.toISOString() : `<invalid end>`}`)
      }
    }

    console.log(`Metadata:   ${p.metadataURI || '<none>'}`)
  })
}

function pDateValue(val?: string): number {
  if (!val) return NaN
  const d = new Date(val)
  return isNaN(d.valueOf()) ? NaN : d.valueOf()
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
