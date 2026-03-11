import { crops, type CropId, type CropIssue } from '../data';
import { getIssueRecommendation, type DiagnosisProductRecommendation } from './economics';
import { getDiagnosisApiUrl } from './integrations';

export type DiagnosisSource = 'vision' | 'symptom-match' | 'manual-selection';

export interface CropDiagnosisResult {
  issue: CropIssue;
  confidence: number;
  source: DiagnosisSource;
  summary: string;
  followUp: string;
  recommendation: DiagnosisProductRecommendation;
  requiresReview: boolean;
}

export interface DiagnoseCropIssueInput {
  cropId: CropId;
  note: string;
  imageDataUrl?: string;
  fallbackIssueId?: string;
}

const diagnosisApiUrl = getDiagnosisApiUrl();

const issueKeywords: Partial<Record<CropIssue['id'], string[]>> = {
  'fall-armyworm': ['armyworm', 'frass', 'whorl', 'ragged', 'chewed', 'holes', 'caterpillar'],
  'broadleaf-weeds': ['weed', 'weeds', 'broadleaf', 'grass', 'competition', 'rows'],
  'nitrogen-deficiency': ['yellow', 'yellowing', 'pale', 'nitrogen', 'stunted', 'weak'],
  aphids: ['aphid', 'sticky', 'honeydew', 'curled', 'colonies'],
  'blue-mould': ['blue mould', 'mould', 'humid', 'patches', 'grey', 'grey-blue'],
  nutsedge: ['nutsedge', 'sedge', 'ridge weeds', 'persistent weeds'],
  rust: ['rust', 'pustules', 'orange', 'yellow streak', 'stripe'],
  'wild-oats': ['wild oats', 'grasses', 'annual grasses', 'grass weeds'],
  'nitrogen-loss': ['yellowing', 'patchy', 'over-irrigation', 'heavy watering', 'washed'],
  borer: ['borer', 'dead heart', 'shot holes', 'boring', 'stalk'],
  smut: ['smut', 'black whip', 'whip', 'weak stooling'],
  'grass-weeds': ['grass weeds', 'furrows', 'inter-row', 'weeds'],
  'soy-rust': ['rust', 'brown lesions', 'lower canopy', 'defoliation'],
  'pod-sucking-bugs': ['pod bugs', 'pod sucking', 'scarring', 'seed fill'],
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function scoreIssue(issue: CropIssue, normalizedNote: string) {
  const words = issueKeywords[issue.id] ?? [];
  let score = 0;

  words.forEach((keyword) => {
    if (normalizedNote.includes(keyword)) {
      score += keyword.includes(' ') ? 3 : 2;
    }
  });

  if (normalizedNote.includes(issue.title.toLowerCase())) {
    score += 4;
  }

  if (normalizedNote.includes(issue.category)) {
    score += 1;
  }

  return score;
}

function buildFallbackDiagnosis(input: DiagnoseCropIssueInput) {
  const crop = crops.find((entry) => entry.id === input.cropId);
  if (!crop) {
    throw new Error('Crop guide could not be loaded for diagnosis.');
  }

  const normalizedNote = normalizeText(input.note);
  const issues = crop.issues.map((issue) => ({
    issue,
    score: scoreIssue(issue, normalizedNote),
  }));
  const scoredMatch = issues.sort((left, right) => right.score - left.score)[0];
  const selectedIssue =
    (scoredMatch?.score ?? 0) > 0
      ? scoredMatch.issue
      : crop.issues.find((issue) => issue.id === input.fallbackIssueId) ?? crop.issues[0];
  const source: DiagnosisSource = (scoredMatch?.score ?? 0) > 0 ? 'symptom-match' : 'manual-selection';
  const confidence =
    source === 'symptom-match'
      ? Math.min(0.55 + (scoredMatch?.score ?? 0) * 0.06, 0.89)
      : input.imageDataUrl
        ? 0.46
        : 0.38;

  return {
    issue: selectedIssue,
    confidence,
    source,
    summary:
      source === 'symptom-match'
        ? `Symptoms in the note are closest to ${selectedIssue.title.toLowerCase()}.`
        : 'No live vision service is configured, so the app is using the selected issue guide as the starting point.',
    followUp:
      source === 'manual-selection'
        ? 'Capture the photo and save the enquiry so an agronomist or later AI service can review the case.'
        : 'Confirm the symptoms in the field and save the enquiry if damage continues spreading.',
    recommendation: getIssueRecommendation(input.cropId, selectedIssue),
    requiresReview: true,
  } satisfies CropDiagnosisResult;
}

export async function diagnoseCropIssue(input: DiagnoseCropIssueInput): Promise<CropDiagnosisResult> {
  if (diagnosisApiUrl && input.imageDataUrl) {
    try {
      const response = await fetch(diagnosisApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cropId: input.cropId,
          note: input.note,
          imageDataUrl: input.imageDataUrl,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          issueId?: string;
          confidence?: number;
          summary?: string;
          followUp?: string;
        };
        const crop = crops.find((entry) => entry.id === input.cropId);
        const issue =
          crop?.issues.find((entry) => entry.id === payload.issueId) ??
          crop?.issues.find((entry) => entry.id === input.fallbackIssueId) ??
          crop?.issues[0];

        if (crop && issue) {
          return {
            issue,
            confidence: typeof payload.confidence === 'number' ? payload.confidence : 0.78,
            source: 'vision',
            summary:
              payload.summary ?? `The image analysis service matched this case to ${issue.title.toLowerCase()}.`,
            followUp:
              payload.followUp ??
              'Confirm the recommendation in the field and keep monitoring the crop after treatment.',
            recommendation: getIssueRecommendation(input.cropId, issue),
            requiresReview: false,
          };
        }
      }
    } catch {
      return buildFallbackDiagnosis(input);
    }
  }

  return buildFallbackDiagnosis(input);
}
