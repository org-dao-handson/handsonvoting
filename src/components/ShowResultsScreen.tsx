import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { VocdoniApiService, ProcessRegistryService } from '@vocdoni/davinci-sdk';
import { getProcessRegistryAddress } from '../utils/contractAddresses';
import { Wallet, JsonRpcSigner } from 'ethers';

interface ShowResultsScreenProps {
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly wallet: Wallet | JsonRpcSigner;
}

interface QuestionResult {
  title: string;
  choices: Array<{ title: string; votes: number }>;
}

interface ProcessDetails {
  id: string;
  organizationId: string;
  metadataURI: string;
}

interface MetadataQuestion {
  title: { default: string };
  choices: Array<{ title: { default: string }; value: number }>;
}

interface Metadata {
  questions: MetadataQuestion[];
}

export default function ShowResultsScreen({ onBack, wallet }: Readonly<Omit<ShowResultsScreenProps, 'onNext'>>) {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;
  const orgId = process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? process.env.ORGANIZATION_ID;
  if (!apiUrl || !orgId) throw new Error('API_URL and ORGANIZATION_ID are required');

  const [questions, setQuestions] = useState<QuestionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to map metadata questions to results
  const mapQuestionsFromMetadata = (metadata: Metadata, resultsArray: readonly unknown[]): QuestionResult[] => {
    let idx = 0;
    return metadata.questions.map((q: MetadataQuestion) => {
      const choices = q.choices.map((c) => {
        const votes = resultsArray[idx] ?? 0;
        idx++;
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
  };

  useEffect(() => {
    (async () => {
      try {
        const api = new VocdoniApiService(apiUrl);
        // 1. discover latest process for this org
        const allIds = await api.listProcesses();
        const allDetails = await Promise.all(
          allIds.map(async (id) => {
            try {
              return await api.getProcess(id);
            } catch {
              return null;
            }
          })
        );
        const filtered = (allDetails.filter(Boolean) as ProcessDetails[]).filter(
          (p) => p.organizationId.toLowerCase() === orgId.toLowerCase()
        );
        if (!filtered.length) {
          const errorMsg = `No processes found for org ${orgId}`;
          setError(errorMsg);
          return;
        }
        filtered.sort((a, b) => {
          try {
            return BigInt(a.id) > BigInt(b.id) ? -1 : 1;
          } catch {
            return b.id.localeCompare(a.id);
          }
        });
        const latest = filtered[0];
        const processId = latest.id;

        // 2. fetch on-chain results
        const registry = new ProcessRegistryService(getProcessRegistryAddress(), wallet);
        const onChain = await registry.getProcess(processId);
        const resultsArray = onChain.result ? Array.from(onChain.result) : [];

        // 3. fetch metadata questions
        const metadataUrl = latest.metadataURI;
        const metaResp = await fetch(metadataUrl);
        if (!metaResp.ok) {
          const errorMsg = `Failed to fetch metadata: ${metaResp.statusText}`;
          setError(errorMsg);
          return;
        }
        const metadata = await metaResp.json() as Metadata;

        // 4. map results into questions
        const questionsData = mapQuestionsFromMetadata(metadata, resultsArray);
        setQuestions(questionsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [apiUrl, orgId, wallet]);

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
      <Typography variant="h4" gutterBottom>Election Results</Typography>
      <Card sx={{ mb: 4 }}>
        <CardContent>
          {questions.map((question, qi) => {
            const total = question.choices.reduce((sum, c) => sum + c.votes, 0) || 1;
            const questionKey = `question-${qi}-${question.title}`;
            return (
              <Box key={questionKey} sx={{ mb: 4 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" align="left">{question.title}</Typography>
                  <Typography variant="body2" color="text.secondary" align="left">
                    Total votes: {total}
                  </Typography>
                </Box>
                {question.choices.map((choice, ci) => {
                  const percent = Math.round((choice.votes / total) * 100);
                  const choiceKey = `choice-${qi}-${ci}-${choice.title}`;
                  return (
                    <Box key={choiceKey} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography>{choice.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {choice.votes} votes ({percent}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(choice.votes / total) * 100}
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

      {/* Participate in next voting button */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => router.push('/')}
          sx={{
            px: 4,
            py: 1.5,
            fontSize: '1.1rem',
            borderRadius: 2,
            textTransform: 'none',
          }}
        >
          Participate in the next voting
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        
      </Box>
    </Box>
  );
}
