import { redirect } from 'next/navigation';

export default function StoreTranfersTypoRedirect() {
  redirect('/store/transfers/addtransfer');
}
