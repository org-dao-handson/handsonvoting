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

  // 1️⃣ List & fetch details
  console.log('🔍 Fetching all processes…')
  const allIds = await api.listProcesses()
  const details = await Promise.all(
    allIds.map((id) =>
      api.getProcess(id).catch(() => null)
    )
  )
  const ours = details
    .filter((d): d is Awaited<ReturnType<typeof api.getProcess>> => !!d)
    .filter((p) => p.organizationId.toLowerCase() === ORGANIZATION_ID.toLowerCase())
    .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))

  if (ours.length === 0) {
    console.error(`⚠️  No processes found for org ${ORGANIZATION_ID}`)
    process.exit(1)
  }

  // 2️⃣ Pick the most recent
  const latest = ours[0]
  console.log(`✅ Latest process ID: ${latest.id}`)
  console.log(
    `   Started at: ${
      latest.startTime
        ? new Date(latest.startTime * 1000).toISOString()
        : '<unknown>'
    }`
  )

  // 3️⃣ Check voting status
  console.log(`🔍 Checking if ${VOTER_ADDRESS} has voted…`)
  const voted = await api.hasAddressVoted(latest.id, VOTER_ADDRESS)
  if (voted) {
    console.log(`✅ Address ${VOTER_ADDRESS} has already voted in ${latest.id}`)
  } else {
    console.log(`⚠️  Address ${VOTER_ADDRESS} has not voted yet in ${latest.id}`)
  }
}

main().catch((e) => {
  console.error('❌ Fatal error:', e)
  process.exit(1)
})
