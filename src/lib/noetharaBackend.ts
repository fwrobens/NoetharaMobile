// Client uses only the PUBLIC Supabase publishable key. Never add provider
// API keys, GitHub OAuth secrets, or service_role credentials to this file.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session } from '@supabase/supabase-js';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();
export const SUPABASE_URL = 'https://smiubazuuptrknffmouo.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ICF2HJRBUEPXuXgryB70tw_CG2Cyr-a";
export const API_URL = SUPABASE_URL + '/functions/v1/noethara-api';
export const AUTH_CALLBACK_URL = SUPABASE_URL + '/auth/v1/callback';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

let githubToken: string | null = null;
// Provider tokens are short-lived and never written to our project database.
export function getGitHubToken() { return githubToken; }
export function getOAuthReturnUrl() { return ExpoLinking.createURL('auth/callback'); }
export async function signInWithGitHub() {
  const redirectTo = getOAuthReturnUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'repo read:user user:email',
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw Error('GitHub authorization URL is missing.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw Error('GitHub connection was canceled or could not return to the app. Check the redirect allowlist.');
  }
  const resultUrl = new URL(result.url);
  const code = resultUrl.searchParams.get('code');
  if (!code) {
    throw Error(resultUrl.searchParams.get('error_description') ?? 'No authorization code received.');
  }
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw exchanged.error;
  githubToken = exchanged.data.session?.provider_token ?? null;
  return exchanged.data.session;
}
export async function getSession() {
  const result = await supabase.auth.getSession();
  if (result.error) throw result.error;
  if (result.data.session?.provider_token) githubToken = result.data.session.provider_token;
  return result.data.session;
}
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data.session;
}
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  return data.session;
}
export async function logout() {
  githubToken = null;
  const result = await supabase.auth.signOut();
  if (result.error) throw result.error;
}
export type ChatEntry = { role: 'user' | 'assistant'; content: string };
export type Repo = { full_name: string; private: boolean; default_branch: string; description: string | null };
export type GithubEntry = { name: string; path: string; type: string; size?: number };

async function callAPI<T>(path: string, options: {
  method?: 'GET' | 'POST'; payload?: unknown; github?: boolean;
} = {}): Promise<T> {
  const session = await getSession();
  if (!session) throw Error('Sign in with GitHub or email in Settings first.');
  const token = options.github ? githubToken : null;
  if (options.github && !token) {
    throw Error('GitHub repository access is not authorized. Connect GitHub in Settings.');
  }
  const res = await fetch(API_URL + path, {
    method: options.method ?? 'GET',
    headers: {
      'Authorization': 'Bearer ' + session.access_token,
      'apikey': SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      ...(token ? { 'x-github-token': token } : {}),
    },
    ...(options.payload ? { body: JSON.stringify(options.payload) } : {}),
  });
  const raw = await res.text();
  let data: any;
  try { data = raw ? JSON.parse(raw) : {}; } catch { throw Error('Backend returned an invalid response.'); }
  if (!res.ok) throw Error(data.error ?? ('Backend HTTP ' + res.status));
  return data as T;
}
export const noetharaAPI = {
  status: () => callAPI<{ auth: boolean; beam: boolean; fallback: boolean }>('/status'),
  chat: (messages: ChatEntry[], context?: { repo: string; path: string; branch: string }) =>
    callAPI<{ answer: string; model: string; provider: string; usage: unknown }>('/chat', {
      method: 'POST', payload: { messages, ...(context ? { context } : {}) }, github: Boolean(context),
    }),
  repos: () => callAPI<{ repos: Repo[] }>('/github/repos', { github: true }),
  contents: (repo: string, path: string, branch: string) =>
    callAPI<{ kind: 'file' | 'directory'; content?: string; entries?: GithubEntry[] }>('/github/contents?repo=' +
      encodeURIComponent(repo) + '&path=' + encodeURIComponent(path) + '&branch=' + encodeURIComponent(branch), { github: true }),
};

export async function persistChat(chatId: string | null, items: ChatEntry[]): Promise<string> {
  const session = await getSession();
  if (!session?.user) throw Error('Sign in to save messages.');
  const title = items.find(m => m.role === 'user')?.content.slice(0, 70) ?? 'New chat';
  let id = chatId;
  if (!id) {
    const { data, error } = await supabase.from('noethara_chats').insert({
      user_id: session.user.id, title,
    }).select('id').single();
    if (error) throw error;
    id = data.id;
  }
  const last = items.at(-1);
  if (last) {
    const { error } = await supabase.from('noethara_messages').insert({
      chat_id: id, user_id: session.user.id, role: last.role, content: last.content,
    });
    if (error) throw error;
  }
  return id!;
}
