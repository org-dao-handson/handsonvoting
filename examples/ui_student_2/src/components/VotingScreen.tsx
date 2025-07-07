'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  VocdoniApiService,
  BallotProof,
  CircomProof,
  VoteBallot,
  BallotProofInputs,
  InfoResponse,
  IQuestion,
  MultiLanguage,
  BallotProofOutput,
  type VoteRequest
} from '@vocdoni/davinci-sdk';
import { BrowserProvider } from 'ethers';

// Helper: pad an array of "0"/"1" strings to a fixed length
function padTo(arr: string[], length: number): string[] {
  return arr.concat(Array(length - arr.length).fill('0')).slice(0, length);
}

// Helper: fetches and logs a census proof, normalizing key and root
async function fetchAndLogCensusProof(
  api: VocdoniApiService,
  censusRoot: string,
  address: string,
  participants: Array<{ key: string; weight: string }>
) {
  // Clean inputs: strip 0x and lowercase
  const cleanRoot = censusRoot.replace(/^0x/, '').toLowerCase();
  const cleanKey  = address.replace(/^0x/, '').toLowerCase();

  // Debug logs
  console.log('▶️  Raw censusRoot:', censusRoot);
  console.log('▶️  Raw address   :', address);
  console.log('▶️  Clean root    :', cleanRoot);
  console.log('▶️  Clean key     :', cleanKey);
  console.log(
    '▶️  Participants (first 5 keys):',
    participants.slice(0, 5).map(p => p.key)
  );

  // Request proof
  const proof = await api.getCensusProof(cleanRoot, cleanKey);
  console.log('✅  Received censusProof:', proof);
  return proof;
}

interface ElectionDetails {
  processId: string;
  encryptionPubKey: [string, string];
  censusRoot: string;
  metadataUrl: string;
  censusId: string;
}

interface Question extends IQuestion {
  title: MultiLanguage<string>;
  description: MultiLanguage<string>;
  choices: Array<{ title: MultiLanguage<string>; value: number }>;
}

const VOTE_STEPS = [
  'Generate Census Proof',
  'Generate ZK Inputs',
  'Generate & Verify Proof',
  'Submit Vote',
];

function getCircuitUrls(info: InfoResponse) {
  return {
    ballotProofExec: info.ballotProofWasmHelperExecJsUrl,
    ballotProof: info.ballotProofWasmHelperUrl,
    circuit: info.circuitUrl,
    provingKey: info.provingKeyUrl,
    verificationKey: info.verificationKeyUrl,
  };
}

export default function VotingScreen({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  if (!apiUrl) throw new Error('API_URL is required');

  const [details, setDetails] = useState<ElectionDetails | null>(null);
  const [participants, setParticipants] = useState<Array<{ key: string; weight: string }>>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [activeStep, setActiveStep] = useState(-1);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [voteId, setVoteId] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/election_1.json');
        if (!res.ok) throw new Error(`Config load error: ${res.statusText}`);
        const cfgJson = await res.json();
        const cfg: ElectionDetails = {
          processId: cfgJson.processId,
          encryptionPubKey: cfgJson.encryptionPubKey,
          censusRoot: cfgJson.censusRoot,
          metadataUrl: cfgJson.metadataUrl,
          censusId: cfgJson.censusId,
        };
        setDetails(cfg);

        const api = new VocdoniApiService(apiUrl);
        const census = await api.getParticipants(cfg.censusId);
        setParticipants(census.map(p => ({ key: p.key, weight: p.weight })));

        if ((window as any).ethereum) {
          const prov = new BrowserProvider((window as any).ethereum);
          const signer = await prov.getSigner();
          const acct = await signer.getAddress();
          setAddress(acct);
          setEligible(census.some(p => p.key.toLowerCase() === acct.toLowerCase()));
        }

        const hash = cfg.metadataUrl.split('/').pop() || '';
        const meta = await api.getMetadata(hash);
        setQuestions(
          meta.questions.map(q => ({
            ...q,
            title: q.title || { default: '' },
            description: q.description || { default: '' },
            choices: q.choices.map(c => ({ ...c, title: c.title || { default: '' } })),
          }))
        );

        const init: Record<number, number> = {};
        meta.questions.forEach((_, i) => { init[i] = -1; });
        setAnswers(init);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [apiUrl]);

  useEffect(() => {
    if (!voteSubmitted || !voteId || !details) return;

    const api = new VocdoniApiService(apiUrl);
    const interval = setInterval(async () => {
      try {
        const { status } = await api.getVoteStatus(
          details.processId.replace(/^0x/, ''),
          voteId
        );
        setVoteStatus(status);
        if (status === 'settled' || status === 'error') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Status polling failed', err);
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [voteSubmitted, voteId, details, apiUrl]);

  const castVote = async () => {
    if (!details || !eligible) return;
    if (Object.values(answers).some(v => v < 0)) {
      setError('Please answer all questions');
      return;
    }
    setError(null);
    setLoading(true);
    setActiveStep(0);

    try {
      const api = new VocdoniApiService(apiUrl);
      // 1️⃣ Fetch canonical process
      const proc = await api.getProcess(details.processId.replace(/^0x/, ''));

      // 2️⃣ Census proof (with logging)
      const censusProof = await fetchAndLogCensusProof(
        api,
        details.censusRoot,
        address,
        participants
      );
      setActiveStep(1);

      // 3️⃣ Nonce k
      const kHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const kStr = BigInt('0x'+kHex).toString();

      // 4️⃣ Init BallotProof SDK
      const info = await api.getInfo();
      const urls = getCircuitUrls(info);
      const sdk = new BallotProof({ wasmExecUrl: urls.ballotProofExec, wasmUrl: urls.ballotProof });
      await sdk.init();
      setActiveStep(2);

      // 5️⃣ Build & pad fieldValues (use actual weight instead of '1')
      const myWeight = participants
        .find(p => p.key.toLowerCase() === address.toLowerCase())
        ?.weight || '0';

      const flat = questions.flatMap((q, i) => {
        const values = Array(q.choices.length).fill('0');
        values[answers[i]] = myWeight;
        return values;
      });
      const fieldValues = padTo(flat, 8);

      // 6️⃣ Assemble inputs
      const inputs: BallotProofInputs = {
        address: address.replace(/^0x/, ''),
        processID: proc.id,
        encryptionKey: [proc.encryptionKey.x, proc.encryptionKey.y],
        k: kStr,
        ballotMode: proc.ballotMode,
        weight: myWeight,
        fieldValues,
      };
      setActiveStep(3);

      // 7️⃣ Generate & verify proofInputs
      const out = (await sdk.proofInputs(inputs)) as BallotProofOutput;
      const circom = new CircomProof({
        wasmUrl: urls.circuit,
        zkeyUrl: urls.provingKey,
        vkeyUrl: urls.verificationKey
      });
      const { proof, publicSignals } = await circom.generate(out.circomInputs);
      if (!(await circom.verify(proof, publicSignals))) throw new Error('Proof verification failed');
      setActiveStep(4);

      // 8️⃣ Sign & submit vote
      const prov = new BrowserProvider((window as any).ethereum);
      const signer = await prov.getSigner();
      const sigBytes = hexStringToUint8Array(out.voteId);
      const signature = await signer.signMessage(sigBytes);

      const voteRequest: VoteRequest = {
        address,
        ballot: { curveType: out.ballot.curveType, ciphertexts: out.ballot.ciphertexts },
        ballotInputsHash: out.ballotInputsHash,
        ballotProof: proof,
        censusProof,
        processId: proc.id.replace(/^0x/, ''),
        signature,
        voteId: out.voteId,
      };
      await api.submitVote(voteRequest);
      setVoteId(out.voteId.replace(/^0x/, ''));
      setVoteSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Box textAlign="center"><CircularProgress/></Box>;
  if (error) return <Alert severity="error" sx={{ mx: 2 }}>{error}</Alert>;

  function hexStringToUint8Array(hex: string): Uint8Array {
    const clean = hex.replace(/^0x/, '');
    return new Uint8Array(clean.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', my: 4 }}>
      <Typography variant="h4" gutterBottom>
        Cast Your Vote
      </Typography>

      {!address ? (
        <Alert severity="info">Connect your wallet</Alert>
      ) : !eligible ? (
        <Alert severity="warning">{address} not eligible</Alert>
      ) : voteSubmitted ? (
        <>
          <Alert severity="success">Vote submitted!</Alert>
          {voteStatus && (
            <Alert
              severity={
                voteStatus === 'settled'
                  ? 'success'
                  : voteStatus === 'error'
                  ? 'error'
                  : 'info'
              }
              sx={{ mt: 2 }}
            >
              Vote status: {voteStatus}
            </Alert>
          )}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="outlined" onClick={onBack}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={onNext}
              disabled={voteStatus !== 'settled'}
            >
              Next
            </Button>
          </Box>
        </>
      ) : (
        <>
          {questions.map((q, i) => (
            <Box key={i} sx={{ mb: 2 }}>
              <Typography variant="h6">{q.title.default}</Typography>
              <RadioGroup
                value={answers[i]}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [i]: +e.target.value }))
                }
              >
                {q.choices.map((c, ci) => (
                  <FormControlLabel
                    key={ci}
                    value={ci}
                    control={<Radio />}
                    label={c.title.default}
                  />
                ))}
              </RadioGroup>
            </Box>
          ))}

          <Stepper activeStep={activeStep} sx={{ my: 3 }}>
            {VOTE_STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Button
            variant="contained"
            fullWidth
            onClick={castVote}
            disabled={
              activeStep >= VOTE_STEPS.length ||
              Object.values(answers).some((v) => v < 0)
            }
          >
            {activeStep >= VOTE_STEPS.length ? 'Submitting…' : 'Cast Vote'}
          </Button>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="outlined" onClick={onBack}>
              Back
            </Button>
            <Button variant="contained" onClick={onNext} disabled={!voteSubmitted}>
              Next
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
