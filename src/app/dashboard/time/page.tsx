import { redirect } from 'next/navigation';

/**
 * /dashboard/time is deprecated.
 * Time & Efficiency functionality has been merged into Urenregistratie.
 */
export default function TimePage() {
  redirect('/dashboard/time-tracking');
}
