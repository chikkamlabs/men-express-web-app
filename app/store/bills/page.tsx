import { redirect } from 'next/navigation';

export default function StoreBillsIndexPage() {
  redirect('/store/bills/dashboard');
}
