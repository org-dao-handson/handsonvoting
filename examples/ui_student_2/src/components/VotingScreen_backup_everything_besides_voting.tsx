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
  type VoteRequest,
  type BallotProofInputs,
  type InfoResponse,
  type IQuestion,
  type MultiLanguage,
  type BallotProofOutput,
} from '@vocdoni/davinci-sdk';
import { BrowserProvider } from 'ethers';

// Helper: pad array to fixed length
function padTo(arr: string[], length: number): string[] {
  return arr.concat(Array(length - arr.length).fill('0')).slice(0, length);
}

// Fetch and log census proof using censusRoot
async function fetchAndLogCensusProof(
  api: VocdoniApiService,
  censusRoot: string,
  address: string,
  participants: Array<{ key: string; weight: string }>
) {
  const cleanRoot = censusRoot.replace(/^0x/, '').toLowerCase();
  const cleanKey = address.replace(/^0x/, '').toLowerCase();
  console.log('▶️ Raw censusRoot:', censusRoot);
  console.log('▶️ Clean root    :', cleanRoot);
  const proof = await api.getCensusProof(cleanRoot, cleanKey);
  console.log('✅ Received censusProof:', proof);
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
  const orgId = process.env.NEXT_PUBLIC_ORGANIZATION_ID || process.env.ORGANIZATION_ID;
  if (!apiUrl || !orgId) throw new Error('API_URL and ORGANIZATION_ID are required');

  const [details, setDetails] = useState<ElectionDetails | null>(null);
  const [participants, setParticipants] = useState<Array<{ key: string; weight: string }>>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [activeStep, setActiveStep] = useState(-1);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [address, setAddress] = useState('');
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const api = new VocdoniApiService(apiUrl);
        // list & filter processes
        const allIds = await api.listProcesses();
        const detailsList = await Promise.all(
          allIds.map(id => api.getProcess(id).catch(() => null))
        );
        const filtered = (detailsList as any[]).filter(
          p => p && p.organizationId.toLowerCase() === orgId.toLowerCase()
        );
        if (!filtered.length) throw new Error(`No processes found for org ${orgId}`);
        // sort by startTime descending
        filtered.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
        const latest = filtered[0]!;
        const cfg: ElectionDetails = {
          processId: latest.id,
          encryptionPubKey: [latest.encryptionKey.x, latest.encryptionKey.y],
          censusRoot: latest.census.censusRoot,
          metadataUrl: latest.metadataURI,
          censusId: latest.censusId,
        };
        setDetails(cfg);

        // fetch participants via censusRoot
        const census = await api.getParticipants(cfg.censusRoot);
        setParticipants(census.map(p => ({ key: p.key, weight: p.weight })));

        // wallet & eligibility
        if ((window as any).ethereum) {
          const prov = new BrowserProvider((window as any).ethereum);
          const signer = await prov.getSigner();
          const acct = await signer.getAddress();
          setAddress(acct);
          // eligibility via census array
          setEligible(census.some(p => p.key.toLowerCase() === acct.toLowerCase()));
        }

        // fetch metadata & questions
        const hash = cfg.metadataUrl.split('/').pop()!;
        const meta = await api.getMetadata(hash);
        const qs: Question[] = meta.questions.map(q => ({
          ...q,
          title: q.title || { default: '' },
          description: q.description || { default: '' },
          choices: q.choices.map(c => ({ title: c.title || { default: '' }, value: c.value })),
        }));
        setQuestions(qs);
        const init: Record<number, number> = {};
        qs.forEach((_, i) => (init[i] = -1));
        setAnswers(init);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [apiUrl, orgId]);

  const castVote = async () => {
    if (!details || !eligible) return;
    if (Object.values(answers).some(v => v < 0)) { setError('Please answer all questions'); return; }
    setError(null);
    setLoading(true);
    setActiveStep(0);

    try {
      const api = new VocdoniApiService(apiUrl);
      const proc = await api.getProcess(details.processId.replace(/^0x/, ''));
      // census proof via root
      const censusProof = await fetchAndLogCensusProof(api, details.censusRoot, address, participants);
      setActiveStep(1);

      // nonce k
      const kHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const kStr = BigInt('0x' + kHex).toString();

      // ZK init
      const info = await api.getInfo();
      const urls = getCircuitUrls(info);
      const sdk = new BallotProof({ wasmExecUrl: urls.ballotProofExec, wasmUrl: urls.ballotProof });
      await sdk.init(); setActiveStep(2);

      // ballot inputs
      const flat = questions.flatMap((q, i) => {
        const bits = Array(q.choices.length).fill('0'); bits[answers[i]] = '1'; return bits;
      });
      const fieldValues = padTo(flat, 8);
      const inputs: BallotProofInputs = {
        address: address.replace(/^0x/, ''),
        processID: proc.id,
        encryptionKey: [proc.encryptionKey.x, proc.encryptionKey.y],
        k: kStr,
        ballotMode: proc.ballotMode,
        weight: participants.find(p => p.key.toLowerCase() === address.toLowerCase())?.weight || '1',
        fieldValues,
      };
      setActiveStep(3);

      // proof gen & verify
      const out = await sdk.proofInputs(inputs) as BallotProofOutput;
      const circom = new CircomProof({ wasmUrl: urls.circuit, zkeyUrl: urls.provingKey, vkeyUrl: urls.verificationKey });
      const { proof, publicSignals } = await circom.generate(out.circomInputs);
      if (!(await circom.verify(proof, publicSignals))) throw new Error('Proof verification failed');
      setActiveStep(4);

      // sign & submit
      const prov = new BrowserProvider((window as any).ethereum);
      const signer = await prov.getSigner();
      const sigBytes = new Uint8Array(out.voteId.match(/.{1,2}/g)!.map(b => parseInt(b,16)));
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
      await api.submitVote(voteRequest); setVoteSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Box textAlign="center"><CircularProgress/></Box>;
  if (error) return <Alert severity="error" sx={{mx:2}}>{error}</Alert>;

  return (
    <Box sx={{maxWidth:600,mx:'auto',my:4}}>
      <Typography variant="h4" gutterBottom>Cast Your Vote</Typography>
      {!address ? <Alert severity="info">Connect your wallet to vote.</Alert>
      : !eligible ? <Alert severity="warning">Your address {address} is not eligible to vote.</Alert>
      : voteSubmitted ? (
        <>
          <Alert severity="success">Vote submitted!</Alert>
          <Box sx={{mt:2, display:'flex', justifyContent:'space-between'}}>
            <Button variant="outlined" onClick={onBack}>Back</Button>
            <Button variant="contained" onClick={onNext} disabled={!voteSubmitted}>Next</Button>
          </Box>
        </>
      ) : (
        <>
          {questions.map((q,i)=>(
            <Box key={i} sx={{mb:2}}>
              <Typography variant="h6">{q.title.default}</Typography>
              <RadioGroup value={answers[i]} onChange={e=>setAnswers(p=>({...p,[i]:+e.target.value}))}>
                {q.choices.map((c,ci)=>(<FormControlLabel key={ci} value={ci} control={<Radio/>} label={c.title.default}/>))}
              </RadioGroup>
            </Box>))}
          <Stepper activeStep={activeStep} sx={{my:3}}>
            {VOTE_STEPS.map(label=><Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>
          <Button variant="contained" fullWidth onClick={castVote} disabled={activeStep>=VOTE_STEPS.length||Object.values(answers).some(v=>v<0)}>
            {activeStep>=VOTE_STEPS.length?'Submitting...':'Cast Vote'}
          </Button>
          <Box sx={{mt:2, display:'flex', justifyContent:'space-between'}}>
            <Button variant="outlined" onClick={onBack}>Back</Button>
            <Button variant="contained" onClick={onNext} disabled={!voteSubmitted}>Next</Button>
          </Box>
        </>
      )}
    </Box>
  );
}
