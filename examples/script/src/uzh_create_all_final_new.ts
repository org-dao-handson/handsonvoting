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
  BallotProof,
  BallotProofInputs,
  ProofInputs as Groth16ProofInputs,
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
const step = (election: number, n: number, msg: string) =>
  console.log(chalk.yellow.bold(`\n[Election ${election}] [Step ${n}]`), chalk.white(msg));

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
  CENSUS_CSV_PATH_1,
  CENSUS_CSV_PATH_2,
  CENSUS_CSV_PATH_3,
  CENSUS_CSV_PATH_4,
  ELECTION_CONFIG_PATH,
  PROCESS_REGISTRY_ADDRESS: ENV_PROCESS_REGISTRY,
  ORGANIZATION_REGISTRY_ADDRESS: ENV_ORG_REGISTRY,
} = process.env;

["API_URL","SEPOLIA_RPC","PRIVATE_KEY","CENSUS_CSV_PATH_1","CENSUS_CSV_PATH_2","CENSUS_CSV_PATH_3","CENSUS_CSV_PATH_4","ELECTION_CONFIG_PATH"].forEach(v => {
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

const CENSUS_PATHS = [
  CENSUS_CSV_PATH_1!,
  CENSUS_CSV_PATH_2!,
  CENSUS_CSV_PATH_3!,
  CENSUS_CSV_PATH_4!,
];
// Example static choices; adjust as needed
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
async function createElection(index: number, censusPath: string, cfg: ConfigEntry) {
  console.log(chalk.bold.cyan(`\n🚀 Creating election ${index+1}…`));
  const { api, provider, wallet } = initClients();
  const orgId = wallet.address; // use the wallet that signs as org

  step(index+1, 1, 'Ping API');
  await api.ping();
  success('API reachable');

  step(index+1, 2, 'Fetch info');
  const _info: InfoResponse = await api.getInfo();
  success('Info fetched');

  step(index+1, 3, 'Create census');
  const censusId = await api.createCensus();
  success(`censusId=${censusId}`);

  step(index+1, 4, 'Add participants');
  const participants = loadCensus(censusPath);
  await api.addParticipants(censusId, participants);
  success(`Added ${participants.length}`);

  step(index+1, 5, 'Verify participants');
  const stored = await api.getParticipants(censusId);
  console.log(`Participants: ${stored.map(p => `${p.key}(${p.weight})`).join(',')}`);

  const maxWeight = participants.map(p => BigInt(p.weight)).reduce((a, b) => (a > b ? a : b), BigInt(0)).toString()

  step(index+1, 6, 'Fetch root & size');
  const censusRoot = await api.getCensusRoot(censusId);
  const censusSize = await api.getCensusSize(censusId);
  success(`root=${censusRoot}, size=${censusSize}`);

  const questions = buildQuestions(cfg);
  step(index+1, 7, 'Push metadata');
  const meta = {
    title: { default: `Election ${index+1}` },
    description: { default: `Auto election ${index+1}` },
    questions,
  };
  const hash = await api.pushMetadata(meta);
  const metadataUrl = api.getMetadataUrl(hash);
  success(`metadataUrl=${metadataUrl}`);

  step(index+1, 8, 'Create process');
  const procSvc = new ProcessRegistryService(PROCESS_REGISTRY_ADDR, wallet);
  // getNextProcessId returns BigNumber or string, so stringify
  const rawProcessId = await procSvc.getNextProcessId(orgId);
  const processIdStr = rawProcessId.toString();
  console.log(`nextProcessId=${processIdStr}`);

  const sig = await signProcessCreation(processIdStr, wallet);
  // capture the sequencer's returned ID to ensure consistency
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

  step(index+1, 9, 'Submit on-chain');
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

  step(index+1,10,'Save details');
  fs.writeFileSync(
    resolve(__dirname, `election_${index+1}.json`),
    JSON.stringify({ processId: returnedProcessId, encryptionPubKey, censusRoot, metadataUrl, censusId }, null, 2)
  );
  success('Saved');
}

// ────────────────────────────────────────────────────────────
//  MAIN
// ────────────────────────────────────────────────────────────
(async () => {
  const cfg: ConfigEntry[] = JSON.parse(fs.readFileSync(ELECTION_CONFIG_PATH!, 'utf8'));
  if (cfg.length !== 4) throw new Error(`Expected 4 entries, got ${cfg.length}`);
  for (let i = 0; i < 4; i++) {
    await createElection(i, CENSUS_PATHS[i], cfg[i]);
  }
  console.log(chalk.bold.green(`\n✅ All elections created successfully\n`));
})();

// EOF
