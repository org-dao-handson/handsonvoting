// src/queryLast4Processes.ts

import 'dotenv/config'
import { VocdoniApiService } from '../../../src/sequencer'

const { API_URL, ORGANIZATION_ID } = process.env
if (!API_URL || !ORGANIZATION_ID) {
  console.error('❌ Set API_URL and ORGANIZATION_ID in .env')
  process.exit(1)
}

async function main() {
  const api = new VocdoniApiService(API_URL)

  console.log(`🔍 Fetching all process IDs…`)
  let allIds: string[] = []
  try {
    allIds = await api.listProcesses()
  } catch (err) {
    console.error('❌ Error listing processes:', err)
    process.exit(1)
  }

  console.log(`ℹ️  Found ${allIds.length} total processes; fetching details…`)
  const details = await Promise.all(
    allIds.map(async id => {
      try {
        return await api.getProcess(id)
      } catch (err) {
        console.error(`❌ Error fetching process ${id}:`, err)
        return null
      }
    })
  )

  const validDetails = details.filter(
    (d): d is {
      id: string
      organizationId: string
      status: number
      encryptionKey: any
      stateRoot: string
      result: string[]
      startTime: number
      duration: number
      metadataURI: string
      ballotMode: { type: string; config: Record<string, any> }
      census: Record<string, any>
      metadata: Record<string, any>
      voteCount: string
      voteOverwrittenCount: string
      isAcceptingVotes: boolean
      sequencerStats: Record<string, any>
    } => Boolean(d)
  )

  const filtered = validDetails.filter(
    p => p.organizationId.toLowerCase() === ORGANIZATION_ID.toLowerCase()
  )

  const sorted = filtered.sort((a, b) => {
    const aTime = a.startTime || 0
    const bTime = b.startTime || 0
    return bTime - aTime
  })

  const last4 = sorted.slice(0, 4)

  if (last4.length === 0) {
    console.log(`⚠️ No processes found for org ${ORGANIZATION_ID}`)
    return
  }

  console.log(`✅ Last ${last4.length} processes for ${ORGANIZATION_ID}:`)
  last4.forEach((p, i) => {
    console.log(`\n— #${i + 1} —`)
    console.log(`ID:             ${p.id}`)
    console.log(`Status:         ${p.status}`)

    if (typeof p.startTime === 'number' && p.startTime > 0) {
      const cd = new Date(p.startTime * 1000)
      console.log(`Created at:     ${!isNaN(cd.valueOf()) ? cd.toISOString() : `<invalid> ${p.startTime}`}`)
    } else {
      console.log(`Created at:     <unknown>`)
    }

    if (typeof p.duration === 'number') {
      if (p.duration > 60 * 60 * 24 * 365 * 100) { // >100 years
        console.log(`Duration:       <infinite> (${p.duration}s)`)
      } else {
        console.log(`Duration:       ${p.duration}s`)
        if (typeof p.startTime === 'number' && p.startTime > 0) {
          const endMs = (p.startTime + p.duration) * 1000
          const ed = new Date(endMs)
          console.log(`Ends at:        ${!isNaN(ed.valueOf()) ? ed.toISOString() : `<invalid end>`}`)
        }
      }
    } else {
      console.log(`Duration:       <unknown>`)
    }

    console.log(`MetadataURI:    ${p.metadataURI || '<none>'}`)
    console.log(`Ballot mode:    ${p.ballotMode?.type || '<unknown>'}`)

    // Raw census display for debugging
    console.log(`Raw census:     ${JSON.stringify(p.census, null, 2)}`)

    // Normalized census data
    // Normalized census data
    const censusId =
    p.census?.censusId ||               // future-proof: if Sequencer ever adds it
    p.census?.censusRoot ||             // current OFF_CHAIN_TREE origin
    p.census?.censusURI?.split('/').pop() || '<none>';

    const censusRoot = p.census?.censusRoot ?? '<none>';
    const censusURI  = p.census?.censusURI  ?? '<none>';
    const censusOrigin = p.census?.censusOrigin ?? '<unknown>';

    console.log(`Census origin:  ${censusOrigin}`);
    console.log(`Census ID:      ${censusId}`);
    console.log(`Census root:    ${censusRoot}`);
    console.log(`Census URI:     ${censusURI}`);

  })
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
