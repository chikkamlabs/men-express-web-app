import { supabase } from './supabase';

export interface Distributor {
  id: string;
  distributor_id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  company: string | null;
  balance: number;
  status: 'active' | 'deactive';
  created_at: string;
  updated_at?: string;
}

export interface CreateDistributorInput {
  distributor_id: string;
  name: string;
  mobile?: string;
  company?: string;
  status?: 'active' | 'deactive';
}

export interface UpdateDistributorInput {
  name: string;
  mobile?: string;
  email?: string;
  company?: string;
  balance?: number;
  status: 'active' | 'deactive';
}

const LOCAL_STORAGE_KEY = 'menexpress_distributors_cache';

function getLocalCache(): Distributor[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: Distributor[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Calculate the auto-filled distributor_id using the formula:
 * distributor_id = distributor_101 + length of distributors on every new entry
 */
export function calculateNextDistributorId(
  count: number,
  existingDistributors: Distributor[] = []
): string {
  const targetNum = 101 + count;
  let candidateId = `distributor_${targetNum}`;

  const existingIds = new Set(existingDistributors.map((d) => d.distributor_id));
  if (!existingIds.has(candidateId)) {
    return candidateId;
  }

  // If candidate already exists, increment to avoid collisions
  let counter = targetNum;
  while (existingIds.has(`distributor_${counter}`)) {
    counter++;
  }
  return `distributor_${counter}`;
}

/**
 * Fetch all distributors from Supabase with graceful fallback
 */
export async function getDistributors(): Promise<{
  data: Distributor[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetch error, using local cache:', error.message);
      return { data: getLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      setLocalCache(data as Distributor[]);
      return { data: data as Distributor[], error: null };
    }

    return { data: getLocalCache(), error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getLocalCache(), error: new Error(errorMsg) };
  }
}

/**
 * Fetch total count of distributors
 */
export async function getDistributorCount(): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    const { count, error } = await supabase
      .from('distributors')
      .select('*', { count: 'exact', head: true });

    if (error || count === null) {
      const local = getLocalCache();
      return { count: local.length, error: error ? new Error(error.message) : null };
    }

    return { count, error: null };
  } catch {
    const local = getLocalCache();
    return { count: local.length, error: null };
  }
}

/**
 * Insert a new distributor into Supabase
 */
export async function createDistributor(
  input: CreateDistributorInput
): Promise<{ data: Distributor | null; error: Error | null }> {
  const payload = {
    distributor_id: input.distributor_id.trim(),
    name: input.name.trim(),
    mobile: input.mobile?.trim() || null,
    company: input.company?.trim() || null,
    balance: 0.0,
    status: input.status || 'active',
  };

  try {
    const { data, error } = await supabase
      .from('distributors')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert failed, saving to local cache fallback:', error.message);
      const local = getLocalCache();
      const newItem: Distributor = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `mock-dist-${Date.now()}`,
        distributor_id: payload.distributor_id,
        name: payload.name,
        mobile: payload.mobile,
        email: null,
        company: payload.company,
        balance: payload.balance,
        status: payload.status as 'active' | 'deactive',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updatedList = [...local, newItem];
      setLocalCache(updatedList);
      return { data: newItem, error: null };
    }

    const local = getLocalCache();
    const updatedList = [
      ...local.filter((d) => d.distributor_id !== data.distributor_id),
      data as Distributor,
    ];
    setLocalCache(updatedList);

    return { data: data as Distributor, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const newItem: Distributor = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `mock-dist-${Date.now()}`,
      distributor_id: payload.distributor_id,
      name: payload.name,
      mobile: payload.mobile,
      email: null,
      company: payload.company,
      balance: payload.balance,
      status: payload.status as 'active' | 'deactive',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedList = [...local, newItem];
    setLocalCache(updatedList);
    return { data: newItem, error: null };
  }
}

/**
 * Update an existing distributor by distributor_id. Note: distributor_id is immutable.
 */
export async function updateDistributor(
  distributor_id: string,
  input: UpdateDistributorInput
): Promise<{ data: Distributor | null; error: Error | null }> {
  const updatePayload = {
    name: input.name.trim(),
    mobile: input.mobile?.trim() || null,
    email: input.email?.trim() || null,
    company: input.company?.trim() || null,
    balance: typeof input.balance === 'number' ? input.balance : 0.0,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('distributors')
      .update(updatePayload)
      .eq('distributor_id', distributor_id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update failed, updating local cache fallback:', error.message);
      const local = getLocalCache();
      const idx = local.findIndex((d) => d.distributor_id === distributor_id);
      if (idx !== -1) {
        local[idx] = {
          ...local[idx],
          ...updatePayload,
        };
        setLocalCache(local);
        return { data: local[idx], error: null };
      }
      return { data: null, error: new Error(error.message) };
    }

    const local = getLocalCache();
    const idx = local.findIndex((d) => d.distributor_id === distributor_id);
    if (idx !== -1) {
      local[idx] = data as Distributor;
    } else {
      local.push(data as Distributor);
    }
    setLocalCache(local);

    return { data: data as Distributor, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const idx = local.findIndex((d) => d.distributor_id === distributor_id);
    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        ...updatePayload,
      };
      setLocalCache(local);
      return { data: local[idx], error: null };
    }
    const errorMsg = err instanceof Error ? err.message : 'Update failed';
    return { data: null, error: new Error(errorMsg) };
  }
}

// -----------------------------------------------------------------------------
// DISTRIBUTOR TRANSACTIONS (Supplier Ledger)
// -----------------------------------------------------------------------------

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other' | 'bill';
export type DistributorTransType = 'add' | 'subtract';

export interface DistributorTransaction {
  id: string;
  distributor_id: string;
  trans_type: DistributorTransType;
  type: PaymentMethod;
  trans_id: string;
  amount: number;
  balance: number;
  notes: string | null;
  proof_url?: string | null;
  created_at: string;
}

export interface CreateDistributorTransactionInput {
  distributor_id: string; // Distributor UUID (distributors.id)
  trans_type: DistributorTransType; // 'add' | 'subtract'
  type: PaymentMethod;
  trans_id: string;
  amount: number;
  notes?: string;
  proof_url?: string | null;
}

const TRANSACTIONS_CACHE_KEY = 'menexpress_distributor_transactions_cache';

function getLocalTransactionsCache(): DistributorTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRANSACTIONS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalTransactionsCache(items: DistributorTransaction[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRANSACTIONS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Auto-generate transaction ID: trans(5 random numbers)
 * Example: trans_58392
 */
export function generateRandomTransactionId(): string {
  const random5Digits = Math.floor(10000 + Math.random() * 90000);
  return `trans_${random5Digits}`;
}

/**
 * Fetch a single distributor by UUID or distributor_id string
 */
export async function getDistributorById(
  idOrDistributorId: string
): Promise<{ data: Distributor | null; error: Error | null }> {
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrDistributorId
    );

    let query = supabase.from('distributors').select('*');
    if (isUUID) {
      query = query.eq('id', idOrDistributorId);
    } else {
      query = query.eq('distributor_id', idOrDistributorId);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      const local = getLocalCache();
      const found = local.find(
        (d) => d.id === idOrDistributorId || d.distributor_id === idOrDistributorId
      );
      if (found) {
        return { data: found, error: null };
      }
      return {
        data: null,
        error: error ? new Error(error.message) : new Error('Distributor not found'),
      };
    }

    return { data: data as Distributor, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const found = local.find(
      (d) => d.id === idOrDistributorId || d.distributor_id === idOrDistributorId
    );
    if (found) {
      return { data: found, error: null };
    }
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch distributor';
    return { data: null, error: new Error(errorMsg) };
  }
}

/**
 * Fetch all distributor transactions for a given distributor
 */
export async function getDistributorTransactions(
  distributorIdOrUuid: string
): Promise<{ data: DistributorTransaction[]; error: Error | null }> {
  try {
    // First, resolve distributor UUID if distributor_id string was passed
    let distUuid = distributorIdOrUuid;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      distributorIdOrUuid
    );

    if (!isUUID) {
      const { data: distData } = await supabase
        .from('distributors')
        .select('id')
        .eq('distributor_id', distributorIdOrUuid)
        .maybeSingle();
      if (distData?.id) {
        distUuid = distData.id;
      }
    }

    const { data, error } = await supabase
      .from('distributor_transactions')
      .select('*')
      .eq('distributor_id', distUuid)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch distributor_transactions error:', error.message);
      const local = getLocalTransactionsCache().filter(
        (t) => t.distributor_id === distUuid || t.distributor_id === distributorIdOrUuid
      );
      return { data: local, error: new Error(error.message) };
    }

    if (data) {
      // Merge into local cache
      const local = getLocalTransactionsCache();
      const otherTransactions = local.filter((t) => t.distributor_id !== distUuid);
      setLocalTransactionsCache([...(data as DistributorTransaction[]), ...otherTransactions]);
      return { data: data as DistributorTransaction[], error: null };
    }

    const local = getLocalTransactionsCache().filter(
      (t) => t.distributor_id === distUuid || t.distributor_id === distributorIdOrUuid
    );
    return { data: local, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    const local = getLocalTransactionsCache().filter(
      (t) => t.distributor_id === distributorIdOrUuid
    );
    return { data: local, error: new Error(errorMsg) };
  }
}

/**
 * Insert into distributor_transactions and update distributors.balance
 * If trans_type is 'subtract': distributors.balance = distributors.balance - amount
 * If trans_type is 'add': distributors.balance = distributors.balance + amount
 */
export async function recordDistributorTransaction(
  input: CreateDistributorTransactionInput
): Promise<{
  data: DistributorTransaction | null;
  newBalance: number;
  error: Error | null;
}> {
  const amount = Number(input.amount);
  if (isNaN(amount) || amount <= 0) {
    return {
      data: null,
      newBalance: 0,
      error: new Error('Transaction amount must be greater than 0.'),
    };
  }

  try {
    // 1. Resolve distributor and fetch latest balance
    let distUuid = input.distributor_id;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.distributor_id
    );

    let currentBalance = 0;
    let distRecord: any = null;

    if (isUUID) {
      const { data } = await supabase
        .from('distributors')
        .select('*')
        .eq('id', input.distributor_id)
        .maybeSingle();
      distRecord = data;
    } else {
      const { data } = await supabase
        .from('distributors')
        .select('*')
        .eq('distributor_id', input.distributor_id)
        .maybeSingle();
      distRecord = data;
    }

    if (distRecord) {
      distUuid = distRecord.id;
      currentBalance = Number(distRecord.balance || 0);
    } else {
      // Check local cache
      const localDistributors = getLocalCache();
      const found = localDistributors.find(
        (d) => d.id === input.distributor_id || d.distributor_id === input.distributor_id
      );
      if (found) {
        distUuid = found.id;
        currentBalance = Number(found.balance || 0);
      }
    }

    // 2. Calculate new balance
    const newBalance =
      input.trans_type === 'subtract' ? currentBalance - amount : currentBalance + amount;

    const payload = {
      distributor_id: distUuid,
      trans_type: input.trans_type,
      type: input.type,
      trans_id: input.trans_id.trim(),
      amount: amount,
      balance: newBalance,
      notes: input.notes?.trim() || null,
      proof_url: input.proof_url?.trim() || null,
      created_at: new Date().toISOString(),
    };

    // 3. Insert transaction
    const { data: insertedTransaction, error: transError } = await supabase
      .from('distributor_transactions')
      .insert([payload])
      .select()
      .single();

    if (transError) {
      console.warn('Supabase insert transaction failed, saving fallback:', transError.message);
    }

    // 4. Update distributor balance in Supabase
    const { error: balanceUpdateError } = await supabase
      .from('distributors')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', distUuid);

    if (balanceUpdateError) {
      console.warn('Supabase update distributor balance failed:', balanceUpdateError.message);
    }

    // 5. Update local caches
    const finalTransaction: DistributorTransaction = (insertedTransaction as DistributorTransaction) || {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `mock-trans-${Date.now()}`,
      ...payload,
    };

    const localTransactions = getLocalTransactionsCache();
    setLocalTransactionsCache([finalTransaction, ...localTransactions]);

    const localDistributors = getLocalCache();
    const updatedDistributors = localDistributors.map((d) =>
      d.id === distUuid || d.distributor_id === input.distributor_id
        ? { ...d, balance: newBalance, updated_at: new Date().toISOString() }
        : d
    );
    setLocalCache(updatedDistributors);

    return {
      data: finalTransaction,
      newBalance,
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to record transaction';
    return {
      data: null,
      newBalance: 0,
      error: new Error(errorMsg),
    };
  }
}

/**
 * Specifically for Purchase completion:
 * Insert into distributor_transactions with distributor_trans_type(add), type(bill),
 * trans_id(purchase_id), amount(purchase amount), balance(distributors.balance + purchase amount),
 * notes(purchase details) and update distributors.balance = distributors.balance + purchase amount.
 */
export async function recordPurchaseDistributorTransaction(input: {
  distributor_id: string; // Distributor UUID or distributor_id code
  purchase_id: string;
  amount: number;
  notes?: string;
}): Promise<{
  data: DistributorTransaction | null;
  newBalance: number;
  error: Error | null;
}> {
  return recordDistributorTransaction({
    distributor_id: input.distributor_id,
    trans_type: 'add',
    type: 'bill',
    trans_id: input.purchase_id,
    amount: input.amount,
    notes: input.notes || `Purchase Invoice: ${input.purchase_id}`,
  });
}

/**
 * Upload payment transaction proof image to Supabase storage bucket 'payment_trans_proofs'
 * and return public URL or file path.
 */
export async function uploadPaymentProofImage(
  file: File,
  transId?: string
): Promise<{ publicUrl: string | null; error: Error | null }> {
  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const cleanFileName = `proof_${transId || 'trans'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const storagePath = `${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('payment_trans_proofs')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Upload to payment_trans_proofs failed:', uploadError.message);
      return { publicUrl: null, error: new Error(uploadError.message) };
    }

    const { data: urlData } = supabase.storage
      .from('payment_trans_proofs')
      .getPublicUrl(storagePath);

    return { publicUrl: urlData?.publicUrl || storagePath, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Upload failed';
    return { publicUrl: null, error: new Error(errorMsg) };
  }
}

