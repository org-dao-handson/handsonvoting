import dotenv from 'dotenv'
import { ethers } from 'ethers'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// --- ESM-compatible __dirname ---
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Always resolve .env relative to project root (parent of 'src')
const envPath = path.resolve(__dirname, '../.env')
dotenv.config({ path: envPath })

// Debug: print the env file location and POOL_A variable
console.log('Loaded .env from:', envPath)
console.log('POOL_A at script start:', process.env.POOL_A)

// Inputs
const mode = process.argv[2]    // e.g. 'A', 'B', 'C', 'D'
const abiPath = process.argv[3] // e.g. '../../../eth-public-goods/contracts/pot_abi.json'

if (!mode || !abiPath) {
  console.error('❌ Usage: tsx src/createConfig.ts <MODE> <ABI_PATH>')
  process.exit(1)
}

// Load ABI and config
const configPath = path.resolve(__dirname, 'config.json')
const abi = JSON.parse(fs.readFileSync(abiPath, 'utf-8'))
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

// Environment variables
const rpcUrl = process.env.RPC_URL
const poolEnvKey = `POOL_${mode}`
const address = process.env[poolEnvKey]

console.log(`Looking up ${poolEnvKey}:`, address)

if (!rpcUrl) {
  console.error('❌ Set RPC_URL in .env')
  process.exit(1)
}
if (!address) {
  console.error(`❌ No address found for mode ${mode}. Check your .env (need ${poolEnvKey})`)
  process.exit(1)
}

// --- Set DECIMALS for your token ---
const DECIMALS = 18 // change this if your contract uses different decimals

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const contract = new ethers.Contract(address, abi, provider)

  let totalDeposits
  try {
    totalDeposits = await contract.totalDeposits()
  } catch (err) {
    console.error('❌ Error calling totalDeposits:', err)
    process.exit(1)
  }

  // Convert to standard units (divide by 10**18 if DECIMALS is 18)
  const moneyInPoolStr = ethers.formatUnits(totalDeposits, DECIMALS)
  // If you want to output as a number, be careful with large numbers! Use parseFloat for display only.
  const moneyInPoolNum = parseFloat(moneyInPoolStr)

  const titleTemplate: string = config[mode]?.title
  const descriptionTemplate: string = config[mode]?.description
  if (!titleTemplate || !descriptionTemplate) {
    console.error(`❌ src/config.json missing title or description for mode ${mode}`)
    process.exit(1)
  }

  // If you want the displayed amount to look like a rounded number (optional)
  const displayMoney = moneyInPoolNum.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })

  const title = titleTemplate.replace(/%%MONEY%%/g, displayMoney)
  const description = descriptionTemplate.replace(/%%MONEY%%/g, displayMoney)

  const entry = {
    moneyInPool: moneyInPoolNum,
    title,
    description
  }

  const output = JSON.stringify([entry], null, 2)
  const outputFile = `src/config_${mode}.json`
  fs.writeFileSync(outputFile, output, 'utf-8')
  console.log(`✅ Written output to ${outputFile}`)
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
