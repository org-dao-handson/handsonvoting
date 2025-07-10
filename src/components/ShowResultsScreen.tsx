import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Divider,
  LinearProgress,
} from '@mui/material';
import { 
  ProcessRegistryService,
} from '@vocdoni/davinci-sdk';
import { getProcessRegistryAddress } from '../utils/contractAddresses';
import { Wallet, JsonRpcSigner } from 'ethers';

const ELECTION_JSON_PATH = process.env.NEXT_PUBLIC_ELECTION_JSON_PATH || '/election_1.json';

interface ShowResultsScreenProps {
  onBack: () => void;
  onNext: () => void;
  wallet: Wallet | JsonRpcSigner;
}

interface ElectionDetails {
  processId: string;
  metadataUrl: string;
}

export default function ShowResultsScreen({ onBack, onNext, wallet }: ShowResultsScreenProps) {
  const [questions, setQuestions] = useState<Array<{
    title: string;
    choices: Array<{ title: string; votes: number }>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  (async () => {
    try {
      const resp = await fetch(ELECTION_JSON_PATH);
      if (!resp.ok) throw new Error(`Failed to fetch election file: ${resp.statusText}`);
      const { processId, metadataUrl } = await resp.json() as ElectionDetails;
      console.log("processId", processId);

      const registry = new ProcessRegistryService(getProcessRegistryAddress(), wallet);
      const process = await registry.getProcess(processId);
      console.log("Fetched process", process);

      const metaResp = await fetch(metadataUrl);
      if (!metaResp.ok) throw new Error(`Failed to fetch metadata: ${metaResp.statusText}`);
      const metadata = await metaResp.json();
      console.log("Metadata", metadata);

      const resultsArray = process.result ? Array.from(process.result) : [];
      console.log("resultsArray", resultsArray); // See what's inside!

      let resultIndex = 0;
      const questionsData = metadata.questions.map((q: any) => {
        const choices = q.choices.map((c: any) => {
          const votes = resultsArray[resultIndex] ?? 0;
          resultIndex++;
          return {
            title: c.title.default,
            votes: Number(votes),
          };
        });
        return {
          title: q.title.default,
          choices,
        };
      });

      setQuestions(questionsData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  })();
}, [wallet]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="outlined" onClick={onBack}>Back</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom>
        Election Results
      </Typography>
      <Card sx={{ mb: 4 }}>
        <CardContent>
          {questions.map((question, qi) => {
            const totalVotes = question.choices.reduce((sum, c) => sum + c.votes, 0) || 1;
            return (
              <Box key={qi} sx={{ mb: 4 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" align="left">{question.title}</Typography>
                  <Typography variant="body2" color="text.secondary" align="left">
                    Total votes: {totalVotes}
                  </Typography>
                </Box>
                {question.choices.map((choice, ci) => {
                  const percent = Math.round((choice.votes / totalVotes) * 100);
                  return (
                    <Box key={ci} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography>{choice.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {choice.votes} votes ({percent}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(choice.votes / totalVotes) * 100}
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 5,
                            backgroundColor: [
                              '#2B6CB0','#38A169','#805AD5',
                              '#D53F8C','#DD6B20','#718096',
                            ][ci % 6],
                          },
                        }}
                      />
                    </Box>
                  );
                })}
                {qi < questions.length - 1 && <Divider sx={{ my: 2 }} />}
              </Box>
            );
          })}
        </CardContent>
      </Card>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button variant="outlined" onClick={onBack}>Back</Button>
        <Button variant="contained" onClick={onNext}>Finish</Button>
      </Box>
    </Box>
  );
}
