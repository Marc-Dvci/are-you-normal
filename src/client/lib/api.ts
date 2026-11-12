import type {
  AnswerResponse,
  CommentResponse,
  ErrorResponse,
  FlairResponse,
  GuessResponse,
  JoinResponse,
  ProposalResponse,
  StateResponse,
} from '../../shared/types';

export class ApiError extends Error {}

const request = async <T>(path: string, body?: unknown): Promise<T> => {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as ErrorResponse).message)
        : 'The server did not answer. Try again.';
    throw new ApiError(message);
  }
  return data as T;
};

export const api = {
  state: () => request<StateResponse>('/api/state'),
  answer: (q: number, option: number) =>
    request<AnswerResponse>('/api/answer', { q, option }),
  guess: (q: number, guess: number, option: number) =>
    request<GuessResponse>('/api/guess', { q, guess, option }),
  verdict: () => request<CommentResponse>('/api/verdict', {}),
  flair: () => request<FlairResponse>('/api/flair', {}),
  join: () => request<JoinResponse>('/api/join', {}),
  propose: (question: string, options: string[]) =>
    request<ProposalResponse>('/api/propose', { question, options }),
};
