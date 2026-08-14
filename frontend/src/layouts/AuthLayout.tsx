import { Link } from 'react-router-dom';
import { AnimatedOutlet } from '@/components/common/PageTransition';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-surface dark:bg-surface-dark">
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-primary-900 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <Link to="/" className="relative text-4xl font-bold tracking-tight">
          Dress<span className="text-accent">Mart</span>
        </Link>
        <h2 className="relative mt-8 max-w-sm text-center text-3xl font-bold leading-tight">Premium fashion for Men &amp; Kids</h2>
        <div className="relative mt-6 h-px w-14 bg-accent/60" />
        <p className="relative mt-6 max-w-xs text-center text-primary-300">Discover curated collections, exclusive deals and a shopping experience built for you.</p>
        <p className="absolute bottom-8 text-sm text-primary-400">&copy; {new Date().getFullYear()} DressMart. All rights reserved.</p>
      </div>
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 block text-center text-2xl font-bold text-primary-900 dark:text-white lg:hidden">
            Dress<span className="text-accent">Mart</span>
          </Link>
          <div className="card-surface p-6 sm:p-10">
            <AnimatedOutlet />
          </div>
        </div>
      </div>
    </div>
  );
}
