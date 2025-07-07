#!/usr/bin/env ts-node
import { config } from "dotenv";
import { JsonRpcProvider, Wallet } from "ethers";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";
import { Chain } from "@ethereumjs/common";
import {
  VocdoniApiService,
  // Types below are only needed if you use them farther down – keep for consistency
  VoteBallot,
  BallotProofOutput,
  CircomProof,
  Groth16Proof,
  ProofInputs as Groth16ProofInputs,
  BallotProof,
  BallotProofInputs,
  // InfoResponse is returned by api.getInfo(); importing avoids TS errors
  InfoResponse,
} from "../../../src/sequencer";
import {
  SmartContractService,
  ProcessRegistryService,
  OrganizationRegistryService,
  ProcessStatus,
} from "../../../src/contracts";
import { Census, EncryptionKey } from "../../../src/core";

// -----------------------------------------------------------------------------
//  TYPES & HELPERS
// -----------------------------------------------------------------------------
interface ConfigEntry {
  /** Amount of money in the pool for this election */
  moneyInPool: number;
  /** Title template containing the placeholder %%MONEY%% */
  title: string;
  /** Description template containing the placeholder %%MONEY%% */
  description: string;
}

interface Question {
  title: { [lang: string]: string };
  description: { [lang: string]: string };
  meta: Record<string, unknown>;
  choices: { title: { [lang: string]: string }; value: number; meta: Record<string, unknown> }[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// -----------------------------------------------------------------------------
//  ENV & BASIC VALIDATION
// -----------------------------------------------------------------------------
config();

const {
  API_URL,
  SEPOLIA_RPC,
  PRIVATE_KEY,
  PROCESS_REGISTRY_ADDRESS,
  ORGANIZATION_REGISTRY_ADDRESS,
  ORG_ID,
  // Four census CSV paths (one per election)
  CENSUS_CSV_PATH_1,
  CENSUS_CSV_PATH_2,
  CENSUS_CSV_PATH_3,
  CENSUS_CSV_PATH_4,
  // Path to the JSON config that defines moneyInPool, title, description for each election
  ELECTION_CONFIG_PATH,
} = process.env;

const REQUIRED_VARS = [
  "API_URL",
  "SEPOLIA_RPC",
  "PRIVATE_KEY",
  "PROCESS_REGISTRY_ADDRESS",
  "ORGANIZATION_REGISTRY_ADDRESS",
  "ORG_ID",
  "CENSUS_CSV_PATH_1",
  "CENSUS_CSV_PATH_2",
  "CENSUS_CSV_PATH_3",
  "CENSUS_CSV_PATH_4",
  "ELECTION_CONFIG_PATH",
] as const;

for (const v of REQUIRED_VARS) {
  if (!process.env[v]) {
    throw new Error(`${v} environment variable is required`);
  }
}

// -----------------------------------------------------------------------------
//  CONSTANTS & STATIC DATA
// -----------------------------------------------------------------------------
const CENSUS_PATHS = [
  CENSUS_CSV_PATH_1!,
  CENSUS_CSV_PATH_2!,
  CENSUS_CSV_PATH_3!,
  CENSUS_CSV_PATH_4!,
];

/**
 * Choices are constant across elections – update here if you need different ones.
 */
const CHOICES: Question["choices"] = [
  { title: { default: "Equal redistribution" }, value: 0, meta: {} },
  { title: { default: "Proportional to what one has put in" }, value: 1, meta: {} },
  { title: { default: "Random person takes all" }, value: 2, meta: {} },
  { title: { default: "The richest 10% in UZHPOS" }, value: 3, meta: {} },
];

// -----------------------------------------------------------------------------
//  LOGGING HELPERS
// -----------------------------------------------------------------------------
const info = (msg: string) => console.log(chalk.cyan("ℹ"), msg);
const success = (msg: string) => console.log(chalk.green("✔"), msg);
const step = (election: number, n: number, msg: string) =>
  console.log(chalk.yellow.bold(`\n[Election ${election}] [Step ${n}]`), chalk.white(msg));

// -----------------------------------------------------------------------------
//  UTILITY FUNCTIONS
// -----------------------------------------------------------------------------
function initClients() {
  const provider = new JsonRpcProvider(SEPOLIA_RPC!);
  const wallet = new Wallet(PRIVATE_KEY!, provider);
  const api = new VocdoniApiService(API_URL!);
  return { api, provider, wallet };
}

/**
 * CSV loader – expects "key,weight" per line.
 */
function loadCensus(filePath: string): Array<{ key: string; weight: string }> {
  const csv = fs.readFileSync(filePath, "utf-8");
  return csv
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const [key, weight] = line.split(",").map((s) => s.trim());
      return { key, weight };
    });
}

function replaceMoney(template: string, amount: number) {
  return template.replace(/%%MONEY%%/g, amount.toString());
}

function buildQuestions(cfg: ConfigEntry): Question[] {
  return [
    {
      title: { default: replaceMoney(cfg.title, cfg.moneyInPool) },
      description: { default: replaceMoney(cfg.description, cfg.moneyInPool) },
      meta: {},
      choices: CHOICES,
    },
  ];
}

// -----------------------------------------------------------------------------
//  CORE – CREATE ONE ELECTION
// -----------------------------------------------------------------------------
async function createElection(index: number, censusPath: string, cfg: ConfigEntry) {
  console.log(chalk.bold.cyan(`\n🚀 Creating election ${index + 1}…`));

  const { api, provider, wallet } = initClients();
  const orgId = ORG_ID!;

  // 1️⃣ Ping API -----------------------------------------------------------------
  step(index + 1, 1, "Ping Vocdoni API");
  await api.ping();
  success("API reachable");

  // 2️⃣ Fetch circuit & on‑chain info -------------------------------------------
  step(index + 1, 2, "Fetch zk‑circuit & contract info");
  const _info: InfoResponse = await api.getInfo();
  success("Fetched info from API");

  // 3️⃣ Create census ------------------------------------------------------------
  step(index + 1, 3, "Create census on Vocdoni");
  const censusId = await api.createCensus();
  success(`Census created: ${censusId}`);

  // 4️⃣ Add participants ---------------------------------------------------------
  step(index + 1, 4, "Load and add participants");
  const participants = loadCensus(censusPath);
  await api.addParticipants(censusId, participants);
  success(`Added ${participants.length} participants`);

  // 5️⃣ Verify participants ------------------------------------------------------
  step(index + 1, 5, "Verify participants stored");
  const stored = await api.getParticipants(censusId);
  console.log(
    `        Participants: ${stored.map((p) => `${p.key}(${p.weight})`).join(", ")}`
  );

  // 6️⃣ Fetch census root & size -------------------------------------------------
  step(index + 1, 6, "Fetch census root & size");
  const censusRoot = await api.getCensusRoot(censusId);
  const censusSize = await api.getCensusSize(censusId);
  success(`Census ready (root=${censusRoot}, size=${censusSize})`);

  // 7️⃣ Push election metadata ---------------------------------------------------
  const QUESTIONS = buildQuestions(cfg);
  step(index + 1, 7, "Push election metadata");
  const metadata = {
    title: { default: `Election ${index + 1}` },
    description: { default: `Automatically created election ${index + 1}` },
    questions: QUESTIONS,
  };
  const hash = await api.pushMetadata(metadata);
  const metadataUrl = api.getMetadataUrl(hash);
  success(`Metadata pushed: ${metadataUrl}`);

  // 8️⃣ Create process on Sequencer ---------------------------------------------
  step(index + 1, 8, "Create process via Sequencer API");
  const chainId = Chain.Sepolia;
  const nonce = await provider.getTransactionCount(wallet.address);
  const signature = await wallet.signMessage(`${chainId}${nonce}`);
  const ballotMode = {
    maxCount: QUESTIONS.length,
    maxValue: "3",
    minValue: "0",
    forceUniqueness: false,
    costFromWeight: false,
    costExponent: 0,
    maxTotalCost: "6",
    minTotalCost: "0",
  };

  const { processId, encryptionPubKey, stateRoot } = await api.createProcess({
    censusRoot,
    ballotMode,
    nonce,
    chainId,
    signature,
  });
  success(`Process created: ${processId}`);

  // 9️⃣ Verify admin rights ------------------------------------------------------
  step(index + 1, 9, "Verify admin on‑chain");
  const orgSvc = new OrganizationRegistryService(
    ORGANIZATION_REGISTRY_ADDRESS!,
    wallet
  );
  const isAdmin = await orgSvc.isAdministrator(orgId, wallet.address);
  if (!isAdmin) throw new Error("Caller is not an organization admin");
  success("Admin rights confirmed");

  // 🔟 Submit newProcess on‑chain -----------------------------------------------
  step(index + 1, 10, "Submit new process to ProcessRegistry");
  const procSvc = new ProcessRegistryService(PROCESS_REGISTRY_ADDRESS!, wallet);
  await SmartContractService.executeTx(
    procSvc.newProcess(
      ProcessStatus.READY,
      Math.floor(Date.now() / 1000) + 60, // start 1 min from now
      3600 * 8, // duration 8 h
      ballotMode,
      {
        censusOrigin: 1,
        maxVotes: censusSize.toString(),
        censusRoot,
        censusURI: `${API_URL!}/censuses/${censusRoot}`,
      } as Census,
      metadataUrl,
      orgId,
      processId,
      { x: encryptionPubKey[0], y: encryptionPubKey[1] } as EncryptionKey,
      BigInt(stateRoot)
    )
  );
  success("Process submitted on‑chain");

  // 1️⃣1️⃣ Save election details --------------------------------------------------
  step(index + 1, 11, "Save election details to file");
  const details = {
    processId,
    encryptionPubKey,
    censusRoot,
    metadataUrl,
    censusId,
  };
  const outFile = resolve(__dirname, `election_${index + 1}.json`);
  fs.writeFileSync(outFile, JSON.stringify(details, null, 2));
  success(`Election details saved to ${outFile}`);
}

// -----------------------------------------------------------------------------
//  MAIN – BOOTSTRAP ALL ELECTIONS
// -----------------------------------------------------------------------------
async function main() {
  // Load external configuration (an array of 4 entries)
  const rawCfg = fs.readFileSync(ELECTION_CONFIG_PATH!, "utf-8");
  const cfgEntries: ConfigEntry[] = JSON.parse(rawCfg);
  if (cfgEntries.length !== 4) {
    throw new Error(
      `ELECTION_CONFIG_PATH must contain exactly 4 entries; found ${cfgEntries.length}`
    );
  }

  for (let i = 0; i < 4; i++) {
    await createElection(i, CENSUS_PATHS[i], cfgEntries[i]);
  }

  console.log(chalk.bold.green("\n✅ All elections created successfully\n"));
  process.exit(0);
}

main().catch((err) => {
  console.error(chalk.red("❌ Fatal error:"), err);
  process.exit(1);
});
