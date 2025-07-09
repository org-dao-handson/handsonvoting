#!/usr/bin/env ts-node

import { config } from "dotenv";
import { JsonRpcProvider, Wallet, isAddress } from "ethers";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";
import {
  VocdoniApiService,
  InfoResponse,
  signProcessCreation,
} from "../../../src/sequencer";
import {
  SmartContractService,
  ProcessRegistryService,
  ProcessStatus,
  deployedAddresses as addresses,
} from "../../../src/contracts";
import { Census, EncryptionKey, BallotMode as ApiBallotMode } from "../../../src/core";

// ────────────────────────────────────────────────────────────
//  LOGGING HELPERS
// ────────────────────────────────────────────────────────────
const info = (msg: string) => console.log(chalk.cyan("ℹ"), msg);
const success = (msg: string) => console.log(chalk.green("✔"), msg);
const step = (msg: string) =>
  console.log(chalk.yellow.bold(`[Step]`), chalk.white(msg));

// ────────────────────────────────────────────────────────────
//  TYPES & STATIC DATA
// ────────────────────────────────────────────────────────────
interface ConfigEntry {
  moneyInPool: number;
  title: string;
  description: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ────────────────────────────────────────────────────────────
//  ENV & VALIDATION
// ────────────────────────────────────────────────────────────
config();
const {
  API_URL,
  SEPOLIA_RPC,
  PRIVATE_KEY,
  PROCESS_REGISTRY_ADDRESS: ENV_PROCESS_REGISTRY,
  ORGANIZATION_REGISTRY_ADDRESS: ENV_ORG_REGISTRY,
} = process.env;

["API_URL", "SEPOLIA_RPC", "PRIVATE_KEY"].forEach(v => {
  if (!process.env[v]) throw new Error(`${v} environment variable is required`);
});

// ────────────────────────────────────────────────────────────
//  ADDRESS HELPERS
// ────────────────────────────────────────────────────────────
function getProcessRegistryAddress(): string {
  if (ENV_PROCESS_REGISTRY && isAddress(ENV_PROCESS_REGISTRY)) {
    info(`Using PROCESS_REGISTRY_ADDRESS from environment: ${ENV_PROCESS_REGISTRY}`);
    return ENV_PROCESS_REGISTRY;
  }
  info(`Using default process registry address: ${addresses.processRegistry.sepolia}`);
  return addresses.processRegistry.sepolia;
}

function getOrganizationRegistryAddress(): string {
  if (ENV_ORG_REGISTRY && isAddress(ENV_ORG_REGISTRY)) {
    info(`Using ORGANIZATION_REGISTRY_ADDRESS from environment: ${ENV_ORG_REGISTRY}`);
    return ENV_ORG_REGISTRY;
  }
  info(`Using default organization registry address: ${addresses.organizationRegistry.sepolia}`);
  return addresses.organizationRegistry.sepolia;
}

const PROCESS_REGISTRY_ADDR = getProcessRegistryAddress();
const ORGANIZATION_REGISTRY_ADDR = getOrganizationRegistryAddress();

const CHOICES = [
  { title: { default: "Equal redistribution" }, value: 0, meta: {} },
  { title: { default: "Proportional to contributions" }, value: 1, meta: {} },
  { title: { default: "Random person takes all" }, value: 2, meta: {} },
  { title: { default: "Top 10% richest" }, value: 3, meta: {} },
];

// ────────────────────────────────────────────────────────────
//  UTILITIES
// ────────────────────────────────────────────────────────────
function initClients() {
  const provider = new JsonRpcProvider(SEPOLIA_RPC!);
  const wallet = new Wallet(PRIVATE_KEY!, provider);
  const api = new VocdoniApiService(API_URL!);
  return { api, provider, wallet };
}

function loadCensus(path: string): { key: string; weight: string }[] {
  return fs
    .readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map(l => {
      const [key, weight] = l.split(',').map(s => s.trim());
      return { key, weight };
    });
}

function buildQuestions(cfg: ConfigEntry) {
  return [{
    title: { default: cfg.title.replace(/%%MONEY%%/g, String(cfg.moneyInPool)) },
    description: { default: cfg.description.replace(/%%MONEY%%/g, String(cfg.moneyInPool)) },
    meta: {},
    choices: CHOICES,
  }];
}

// ────────────────────────────────────────────────────────────
//  CORE – CREATE ONE ELECTION
// ────────────────────────────────────────────────────────────
async function createElection(censusPath: string, cfg: ConfigEntry) {
  console.log(chalk.bold.cyan(`\n🚀 Creating election…`));
  const { api, wallet } = initClients();
  const orgId = wallet.address;

  step('Ping API');
  await api.ping();
  success('API reachable');

  step('Fetch info');
  const _info: InfoResponse = await api.getInfo();
  success('Info fetched');

  step('Create census');
  const censusId = await api.createCensus();
  success(`censusId=${censusId}`);

  step('Add participants');
  const participants = loadCensus(censusPath);
  await api.addParticipants(censusId, participants);
  success(`Added ${participants.length}`);

  step('Verify participants');
  const stored = await api.getParticipants(censusId);
  console.log(`Participants: ${stored.map(p => `${p.key}(${p.weight})`).join(',')}`);

  const maxWeight = participants.map(p => BigInt(p.weight)).reduce((a, b) => (a > b ? a : b), BigInt(0)).toString();

  step('Fetch root & size');
  const censusRoot = await api.getCensusRoot(censusId);
  const censusSize = await api.getCensusSize(censusId);
  success(`root=${censusRoot}, size=${censusSize}`);

  const questions = buildQuestions(cfg);
  step('Push metadata');
  const meta = {
    title: { default: cfg.title },
    description: { default: cfg.description },
    questions,
  };
  const hash = await api.pushMetadata(meta);
  const metadataUrl = api.getMetadataUrl(hash);
  success(`metadataUrl=${metadataUrl}`);

  step('Create process');
  const procSvc = new ProcessRegistryService(PROCESS_REGISTRY_ADDR, wallet);
  const rawProcessId = await procSvc.getNextProcessId(orgId);
  const processIdStr = rawProcessId.toString();
  console.log(`nextProcessId=${processIdStr}`);

  const sig = await signProcessCreation(processIdStr, wallet);

  const {
    processId: returnedProcessId,
    encryptionPubKey,
    stateRoot
  } = await api.createProcess({
    processId: processIdStr,
    censusRoot,
    ballotMode: { maxCount: 1, maxValue: maxWeight, minValue: '0', forceUniqueness: true, costFromWeight: true, costExponent: 1, maxTotalCost: '0', minTotalCost: '0' } as ApiBallotMode,
    signature: sig
  });
  success(`processId=${returnedProcessId}`);

  step('Submit on-chain');
  await SmartContractService.executeTx(
    procSvc.newProcess(
      ProcessStatus.READY,
      Math.floor(Date.now() / 1000) + 60,
      3600 * 8,
      { maxCount: 1, maxValue: maxWeight, minValue: '0', forceUniqueness: true, costFromWeight: true, costExponent: 1, maxTotalCost: '0', minTotalCost: '0' } as ApiBallotMode,
      { censusOrigin: 1, maxVotes: String(censusSize), censusRoot, censusURI: `${API_URL}/censuses/${censusRoot}` } as Census,
      metadataUrl,
      { x: encryptionPubKey[0], y: encryptionPubKey[1] } as EncryptionKey,
      BigInt(stateRoot)
    )
  );
  success('Submitted');

  step('Save details');
  fs.writeFileSync(
    resolve(__dirname, `election.json`),
    JSON.stringify({ processId: returnedProcessId, encryptionPubKey, censusRoot, metadataUrl, censusId }, null, 2)
  );
  success('Saved');
}

// ────────────────────────────────────────────────────────────
//  MAIN
// ────────────────────────────────────────────────────────────
(async () => {
  // Expect mode as first argument (A, B, C, D)
  const mode = process.argv[2];
  if (!mode || !["A", "B", "C", "D"].includes(mode)) {
    console.error(`Usage: ts-node script.ts <mode>    (where <mode> is one of: A, B, C, D)`);
    process.exit(1);
  }

  const configPath = resolve(__dirname, `config_${mode}.json`);
  const censusPath = resolve(__dirname, `census_${mode}.csv`);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  if (!fs.existsSync(censusPath)) {
    throw new Error(`Census file not found: ${censusPath}`);
  }

  const cfgArr: ConfigEntry[] = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (cfgArr.length !== 1) throw new Error(`Config must have 1 entry, got ${cfgArr.length}`);
  await createElection(censusPath, cfgArr[0]);

  console.log(chalk.bold.green(`\n✅ Election created successfully\n`));
})();

// EOF
