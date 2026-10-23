import Constants from 'expo-constants';

// Where the backend lives. EXPO_PUBLIC_API_URL wins if set; otherwise we reuse the
// host the Expo dev server is running on (so a phone on the same Wi-Fi reaches your
// laptop) and assume the API is on port 4000.
function resolveBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000`;
}

export const API_URL = resolveBaseUrl();

export type Loan = {
  id: number;
  friendName: string;
  amount: number;
  dueDate: string;
  repaidAt: string | null;
  isOverdue: boolean;
  receiptUrl: string | null;
  createdAt: string;
};

export type Summary = {
  totalLent: number;
  totalRepaid: number;
  outstanding: number;
  overdueAmount: number;
  overdueCount: number;
};

export type NewLoan = {
  friendName: string;
  amount: string;
  dueDate: string;
  receipt?: { uri: string; mimeType: string; fileName: string };
};

// Thrown for non-2xx responses; carries the server's error message.
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  return body as T;
}

const json = (data: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const api = {
  requestOtp: (phone: string) =>
    request<{ message: string }>('/auth/request-otp', { method: 'POST', ...json({ phone }) }),

  verifyOtp: (phone: string, code: string) =>
    request<{ token: string }>('/auth/verify-otp', { method: 'POST', ...json({ phone, code }) }),

  listLoans: (token: string) => request<Loan[]>('/loans', { token }),

  summary: (token: string) => request<Summary>('/loans/summary', { token }),

  markRepaid: (token: string, id: number) => request<Loan>(`/loans/${id}/repay`, { method: 'PATCH', token }),

  // Sent as multipart/form-data so a receipt image can ride along.
  // fetch sets the multipart Content-Type (with boundary) itself.
  async addLoan(token: string, loan: NewLoan): Promise<Loan> {
    const form = new FormData();
    form.append('friendName', loan.friendName);
    form.append('amount', loan.amount);
    form.append('dueDate', loan.dueDate);
    if (loan.receipt) {
      const { uri, mimeType, fileName } = loan.receipt;
      if (uri.startsWith('blob:') || uri.startsWith('data:')) {
        // Web: the picker gives a blob/data URL, so upload the actual Blob.
        form.append('receipt', await (await fetch(uri)).blob(), fileName);
      } else {
        // iOS/Android: React Native's FormData accepts a { uri, name, type } file descriptor.
        form.append('receipt', { uri, name: fileName, type: mimeType } as unknown as Blob);
      }
    }
    return request<Loan>('/loans', { method: 'POST', token, body: form });
  },
};
