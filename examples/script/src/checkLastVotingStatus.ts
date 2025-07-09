// examples/script/src/checkLastVoted.ts

import 'dotenv/config'
import { VocdoniApiService } from '../../../src/sequencer'

const {
  API_URL,           // e.g. "http://localhost:3000/v1"
  ORGANIZATION_ID,   // your org’s hex ID
  VOTER_ADDRESS,     // the address you want to check
} = process.env

if (!API_URL || !ORGANIZATION_ID || !VOTER_ADDRESS) {
  console.error(
    '❌ Please set API_URL, ORGANIZATION_ID and VOTER_ADDRESS in your .env'
  )
  process.exit(1)
}

async function main() {
  const api = new VocdoniApiService(API_URL)

  // 1️⃣ Fetch all process IDs
  console.log('🔍 Fetching all processes…')
  const allIds = await api.listProcesses()

  // 2️⃣ Fetch details, filter to your org
  const details = await Promise.all(
    allIds.map((id) =>
      api.getProcess(id).catch(() => null)
    )
  )
  const ours = details.filter(
    (d): d is Awaited<ReturnType<typeof api.getProcess>> =>
      !!d && d.organizationId.toLowerCase() === ORGANIZATION_ID.toLowerCase()
  )

  if (ours.length === 0) {
    console.error(`⚠️  No processes found for org ${ORGANIZATION_ID}`)
    process.exit(1)
  }

  // 3️⃣ Pick the “latest” by highest numeric ID
  const latest = ours.reduce((max, p) => {
    // convert hex strings like "0xabc..." to BigInt
    const idA = BigInt(max.id)
    const idB = BigInt(p.id)
    return idB > idA ? p : max
  }, ours[0])

  console.log(`✅ Latest (highest-ID) process: ${latest.id}`)

  // Robust startTime display (optional)
  let startedAt = '<unknown>'
  if (
    typeof latest.startTime === 'number' &&
    !isNaN(latest.startTime) &&
    latest.startTime > 0
  ) {
    startedAt = new Date(latest.startTime * 1000).toISOString()
  }
  console.log(`   Started at: ${startedAt}`)

  // 4️⃣ Check voting status
  console.log(`🔍 Checking if ${VOTER_ADDRESS} has voted…`)
  try {
    const voted = await api.hasAddressVoted(latest.id, VOTER_ADDRESS)
    if (voted) {
      console.log(
        `✅ Address ${VOTER_ADDRESS} has already voted in ${latest.id}`
      )
    } else {
      console.log(
        `⚠️  Address ${VOTER_ADDRESS} has not voted yet in ${latest.id}`
      )
    }
  } catch (err) {
    console.error('❌ Error checking voting status:', err)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('❌ Fatal error:', e)
  process.exit(1)
})
