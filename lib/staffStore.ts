import { supabase } from './supabase';

export interface Staff {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  salary: number;
  store_id?: string | null;
  status: 'active' | 'deactive';
  created_at: string;
  updated_at?: string;
}

export interface CreateStaffInput {
  name: string;
  mobile: string;
  email?: string;
  salary: number;
  status: 'active' | 'deactive';
  store_id?: string;
}

export interface UpdateStaffInput {
  name: string;
  mobile: string;
  email?: string | null;
  salary: number;
  status: 'active' | 'deactive';
}

export type StaffAttendanceStatus = 'full' | 'half' | 'absent';

export interface StaffAttendance {
  id: string;
  staff_id: string;
  date: string;
  attendance: StaffAttendanceStatus;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateAttendanceInput {
  staff_id: string;
  date: string;
  attendance: StaffAttendanceStatus;
  notes?: string | null;
}

export interface StaffSalary {
  id: string;
  staff_id: string;
  amount: number;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface CreateSalaryInput {
  staff_id: string;
  amount: number;
  date: string;
  notes?: string | null;
}

const LOCAL_STORAGE_KEY = 'menexpress_staff_cache';
const ATTENDANCE_CACHE_KEY = 'menexpress_staff_attendance_cache';
const SALARIES_CACHE_KEY = 'menexpress_staff_salaries_cache';

function getLocalCache(): Staff[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: Staff[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Fetch all staff from Supabase with graceful fallback
 */
export async function getStaffs(): Promise<{
  data: Staff[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch error for staff, using local cache:', error.message);
      return { data: getLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      setLocalCache(data as Staff[]);
      return { data: data as Staff[], error: null };
    }

    return { data: getLocalCache(), error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getLocalCache(), error: new Error(errorMsg) };
  }
}

export const getStaffList = getStaffs;

/**
 * Fetch total count of staff
 */
export async function getStaffCount(): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    const { count, error } = await supabase
      .from('staff')
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
 * Insert a new staff member into Supabase
 */
export async function createStaff(
  input: CreateStaffInput
): Promise<{ data: Staff | null; error: Error | null }> {
  // If store_id not passed, try to fetch the first available store id
  let targetStoreId = input.store_id || null;
  if (!targetStoreId) {
    try {
      const { data: storeData } = await supabase.from('stores').select('id').limit(1).maybeSingle();
      if (storeData?.id) {
        targetStoreId = storeData.id;
      }
    } catch {
      // Ignore
    }
  }

  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    mobile: input.mobile.trim() || null,
    email: input.email?.trim() || null,
    salary: typeof input.salary === 'number' && !isNaN(input.salary) ? Math.max(0, input.salary) : 0,
    status: input.status || 'active',
  };

  if (targetStoreId) {
    payload.store_id = targetStoreId;
  }

  try {
    const { data, error } = await supabase
      .from('staff')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert failed for staff, saving to local cache fallback:', error.message);
      const local = getLocalCache();
      const newItem: Staff = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `staff-${Date.now()}`,
        name: String(payload.name),
        mobile: payload.mobile as string | null,
        email: payload.email as string | null,
        salary: Number(payload.salary),
        store_id: targetStoreId,
        status: payload.status as 'active' | 'deactive',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updatedList = [newItem, ...local];
      setLocalCache(updatedList);
      return { data: newItem, error: null };
    }

    const local = getLocalCache();
    const updatedList = [
      data as Staff,
      ...local.filter((s) => s.id !== data.id),
    ];
    setLocalCache(updatedList);

    return { data: data as Staff, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const newItem: Staff = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `staff-${Date.now()}`,
      name: String(payload.name),
      mobile: payload.mobile as string | null,
      email: payload.email as string | null,
      salary: Number(payload.salary),
      store_id: targetStoreId,
      status: payload.status as 'active' | 'deactive',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedList = [newItem, ...local];
    setLocalCache(updatedList);
    return { data: newItem, error: null };
  }
}

/**
 * Update an existing staff member
 */
export async function updateStaff(
  id: string,
  input: UpdateStaffInput
): Promise<{ data: Staff | null; error: Error | null }> {
  const updatePayload = {
    name: input.name.trim(),
    mobile: input.mobile.trim() || null,
    email: input.email ? input.email.trim() : null,
    salary: typeof input.salary === 'number' && !isNaN(input.salary) ? Math.max(0, input.salary) : 0,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('staff')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update failed for staff, updating local cache fallback:', error.message);
      const local = getLocalCache();
      const idx = local.findIndex((s) => s.id === id);
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
    const idx = local.findIndex((s) => s.id === id);
    if (idx !== -1) {
      local[idx] = data as Staff;
    } else {
      local.push(data as Staff);
    }
    setLocalCache(local);

    return { data: data as Staff, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const idx = local.findIndex((s) => s.id === id);
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

// ==============================================================================
// STAFF ATTENDANCE FUNCTIONS
// ==============================================================================

function getAttendanceLocalCache(): StaffAttendance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ATTENDANCE_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setAttendanceLocalCache(items: StaffAttendance[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ATTENDANCE_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Check if attendance record already exists for a specific staff member and date
 */
export async function checkAttendanceDateExists(
  staffId: string,
  date: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('staff_attendance')
      .select('id')
      .eq('staff_id', staffId)
      .eq('date', date)
      .maybeSingle();

    if (data?.id) return true;

    // Check local cache
    const local = getAttendanceLocalCache();
    return local.some((a) => a.staff_id === staffId && a.date === date);
  } catch {
    const local = getAttendanceLocalCache();
    return local.some((a) => a.staff_id === staffId && a.date === date);
  }
}

/**
 * Add Attendance for a staff member.
 * Strictly enforces no duplicate dates for a single staff member.
 */
export async function addStaffAttendance(
  input: CreateAttendanceInput
): Promise<{ data: StaffAttendance | null; error: Error | null }> {
  const staffId = input.staff_id;
  const date = input.date.trim();

  // 1. Pre-check for duplicate date for this staff
  const isDuplicate = await checkAttendanceDateExists(staffId, date);
  if (isDuplicate) {
    return {
      data: null,
      error: new Error(`Attendance for this staff member on ${date} is already recorded.`),
    };
  }

  const payload = {
    staff_id: staffId,
    date,
    attendance: input.attendance,
    notes: input.notes?.trim() || null,
  };

  try {
    const { data, error } = await supabase
      .from('staff_attendance')
      .insert([payload])
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('uq_staff_attendance_daily')) {
        return {
          data: null,
          error: new Error(`Attendance for this staff member on ${date} is already recorded.`),
        };
      }

      console.warn('Supabase staff_attendance insert failed, saving to local cache:', error.message);
      const fallbackItem: StaffAttendance = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `att-${Date.now()}`,
        staff_id: staffId,
        date,
        attendance: input.attendance,
        notes: payload.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const local = getAttendanceLocalCache();
      setAttendanceLocalCache([fallbackItem, ...local]);
      return { data: fallbackItem, error: null };
    }

    const row = data as StaffAttendance;
    const local = getAttendanceLocalCache();
    setAttendanceLocalCache([row, ...local.filter((a) => a.id !== row.id)]);

    return { data: row, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to record attendance';
    return { data: null, error: new Error(errorMsg) };
  }
}

/**
 * Fetch attendance records for a staff member for a specific month (default: current month)
 * Returns records and summary count of present (full), half present (half), and absent.
 */
export async function getStaffAttendance(
  staffId: string,
  monthYear?: { year: number; month: number }
): Promise<{
  data: StaffAttendance[];
  summary: { present: number; half: number; absent: number; total: number };
  error: Error | null;
}> {
  const now = new Date();
  const year = monthYear?.year ?? now.getFullYear();
  const month = monthYear?.month ?? now.getMonth() + 1; // 1-12

  // Format month start and end dates
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  try {
    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*')
      .eq('staff_id', staffId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    let records: StaffAttendance[] = [];

    if (error) {
      console.warn('Supabase staff_attendance fetch error, reading local cache:', error.message);
      const local = getAttendanceLocalCache();
      records = local.filter(
        (a) => a.staff_id === staffId && a.date >= startDate && a.date <= endDate
      );
    } else if (data) {
      records = data as StaffAttendance[];
      // Sync local cache
      const local = getAttendanceLocalCache();
      const otherStaff = local.filter((a) => a.staff_id !== staffId);
      setAttendanceLocalCache([...records, ...otherStaff]);
    }

    // Sort descending by date
    records.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate this month summary
    const present = records.filter((r) => r.attendance === 'full').length;
    const half = records.filter((r) => r.attendance === 'half').length;
    const absent = records.filter((r) => r.attendance === 'absent').length;

    return {
      data: records,
      summary: {
        present,
        half,
        absent,
        total: records.length,
      },
      error: error ? new Error(error.message) : null,
    };
  } catch (err: unknown) {
    const local = getAttendanceLocalCache();
    const records = local.filter(
      (a) => a.staff_id === staffId && a.date >= startDate && a.date <= endDate
    );
    records.sort((a, b) => b.date.localeCompare(a.date));
    const present = records.filter((r) => r.attendance === 'full').length;
    const half = records.filter((r) => r.attendance === 'half').length;
    const absent = records.filter((r) => r.attendance === 'absent').length;

    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch attendance';
    return {
      data: records,
      summary: { present, half, absent, total: records.length },
      error: new Error(errorMsg),
    };
  }
}

// ==============================================================================
// STAFF SALARIES FUNCTIONS
// ==============================================================================

function getSalariesLocalCache(): StaffSalary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SALARIES_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setSalariesLocalCache(items: StaffSalary[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SALARIES_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Fetch all salary disbursement records for a specific staff member
 */
export async function getStaffSalaries(
  staffId: string
): Promise<{ data: StaffSalary[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('staff_salaries')
      .select('*')
      .eq('staff_id', staffId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase staff_salaries fetch error, using local cache:', error.message);
      const local = getSalariesLocalCache().filter((s) => s.staff_id === staffId);
      return { data: local, error: new Error(error.message) };
    }

    if (data) {
      const formatted: StaffSalary[] = (data as any[]).map((row) => ({
        id: row.id,
        staff_id: row.staff_id,
        amount: Number(row.amount || 0),
        date: row.date,
        notes: row.notes || null,
        created_at: row.created_at,
      }));

      const local = getSalariesLocalCache().filter((s) => s.staff_id !== staffId);
      setSalariesLocalCache([...formatted, ...local]);

      return { data: formatted, error: null };
    }

    return { data: [], error: null };
  } catch (err: unknown) {
    const local = getSalariesLocalCache().filter((s) => s.staff_id === staffId);
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: local, error: new Error(errorMsg) };
  }
}

/**
 * Record a new salary payment for a staff member
 */
export async function addStaffSalary(
  input: CreateSalaryInput
): Promise<{ data: StaffSalary | null; error: Error | null }> {
  const payload = {
    staff_id: input.staff_id,
    amount: Number(input.amount),
    date: input.date.trim() || new Date().toISOString().split('T')[0],
    notes: input.notes?.trim() || null,
  };

  if (isNaN(payload.amount) || payload.amount <= 0) {
    return { data: null, error: new Error('Salary amount must be greater than 0.') };
  }

  try {
    const { data, error } = await supabase
      .from('staff_salaries')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase staff_salaries insert failed, saving to local cache:', error.message);
      const fallbackItem: StaffSalary = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sal-${Date.now()}`,
        staff_id: payload.staff_id,
        amount: payload.amount,
        date: payload.date,
        notes: payload.notes,
        created_at: new Date().toISOString(),
      };

      const local = getSalariesLocalCache();
      setSalariesLocalCache([fallbackItem, ...local]);
      return { data: fallbackItem, error: null };
    }

    const row: StaffSalary = {
      id: (data as any).id,
      staff_id: (data as any).staff_id,
      amount: Number((data as any).amount || 0),
      date: (data as any).date,
      notes: (data as any).notes || null,
      created_at: (data as any).created_at,
    };

    const local = getSalariesLocalCache();
    setSalariesLocalCache([row, ...local.filter((s) => s.id !== row.id)]);

    return { data: row, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to record salary';
    return { data: null, error: new Error(errorMsg) };
  }
}
