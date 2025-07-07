// src/queryProcess.ts
import 'dotenv/config'
import { ethers } from 'ethers'

const {
  RPC_URL,
  PRIVATE_KEY,
  PROCESS_REGISTRY_ADDRESS
} = process.env

if (!RPC_URL || !PRIVATE_KEY || !PROCESS_REGISTRY_ADDRESS) {
  console.error('❌ Missing RPC_URL, PRIVATE_KEY or PROCESS_REGISTRY_ADDRESS in .env')
  process.exit(1)
}

const IProcessRegistryABI = [
  `function getProcess(bytes32)
     view
     returns (
       tuple(
         uint8 status,
         address organizationId,
         tuple(uint256 x, uint256 y) encryptionKey,
         uint256 latestStateRoot,
         uint256[] result,
         uint256 startTime,
         uint256 duration,
         uint256 voteCount,
         uint256 voteOverwriteCount,
         string metadataURI,
         tuple(
           bool costFromWeight,
           bool forceUniqueness,
           uint8 maxCount,
           uint8 costExponent,
           uint256 maxValue,
           uint256 minValue,
           uint256 maxTotalCost,
           uint256 minTotalCost
         ) ballotMode,
         tuple(
           uint8 censusOrigin,
           uint256 maxVotes,
           bytes32 censusRoot,
           string censusURI
         ) census
       )
     )`
]

async function main() {
  const [rawPid] = process.argv.slice(2)
  if (!rawPid) {
    console.error('Usage: yarn query <processId>')
    process.exit(1)
  }

  const processId = ethers.isHexString(rawPid, 32)
    ? rawPid
    : ethers.hexZeroPad(ethers.hexlify(rawPid), 32)

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider)
  const registry = new ethers.Contract(
    PROCESS_REGISTRY_ADDRESS,
    IProcessRegistryABI,
    wallet
  )

  console.log(`🔍 querying getProcess(${processId})…`)
  const p = await registry.getProcess(processId)

  console.log('📦 full Process struct:')
  console.dir({
    status:     p.status,
    organizationId: p.organizationId,
    encryptionKey:  { x: p.encryptionKey.x.toString(), y: p.encryptionKey.y.toString() },
    latestStateRoot: p.latestStateRoot.toString(),
    result:     p.result.map((r: bigint) => r.toString()),
    // ← here: use Number() instead of .toNumber()
    startTime:  new Date(Number(p.startTime) * 1_000).toISOString(),
    duration:   p.duration.toString(),
    voteCount:  p.voteCount.toString(),
    voteOverwriteCount: p.voteOverwriteCount.toString(),
    metadataURI:p.metadataURI,
    ballotMode: {
      costFromWeight:  p.ballotMode.costFromWeight,
      forceUniqueness: p.ballotMode.forceUniqueness,
      maxCount:        p.ballotMode.maxCount,
      costExponent:    p.ballotMode.costExponent,
      maxValue:        p.ballotMode.maxValue.toString(),
      minValue:        p.ballotMode.minValue.toString(),
      maxTotalCost:    p.ballotMode.maxTotalCost.toString(),
      minTotalCost:    p.ballotMode.minTotalCost.toString(),
    },
    census: {
      censusOrigin: p.census.censusOrigin,
      maxVotes:     p.census.maxVotes.toString(),
      censusRoot:   p.census.censusRoot,
      censusURI:    p.census.censusURI,
    }
  }, { depth: 2 })

  // same here: wrap endTs in Number()
  const endTs = await registry.getProcessEndTime(processId)
  console.log('⏱  computed endTime:', new Date(Number(endTs) * 1_000).toISOString())
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
