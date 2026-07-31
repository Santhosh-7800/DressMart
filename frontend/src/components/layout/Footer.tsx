import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Youtube, ShieldCheck, Truck, RotateCcw, Headphones } from 'lucide-react';

const FOOTER_LINKS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Shop',
    links: [
      { label: "Men's Wear", to: '/men' },
      { label: "Kids' Wear", to: '/kids' },
      { label: 'Flash Sale', to: '/flash-sales' },
      { label: 'Deals of the Day', to: '/deals' },
      { label: 'New Arrivals', to: '/new-arrivals' },
      { label: 'Best Sellers', to: '/best-sellers' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'My Orders', to: '/orders' },
      { label: 'Track Order', to: '/track-order' },
      { label: 'Returns', to: '/orders' },
      { label: 'Wishlist', to: '/wishlist' },
      { label: 'Coupons', to: '/coupons' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', to: '/help-center' },
      { label: 'Privacy Policy', to: '/privacy-policy' },
      { label: 'Terms & Conditions', to: '/terms' },
      { label: 'Contact Us', to: '/help-center' },
    ],
  },
];

const TRUST_BADGES = [
  { icon: Truck, label: 'Free delivery over ₹999' },
  { icon: RotateCcw, label: '7-day easy returns' },
  { icon: ShieldCheck, label: '100% secure payments' },
  { icon: Headphones, label: '24x7 customer support' },
];

export function Footer() {
  return (
    // Hidden on mobile — a heavy multi-column desktop footer has no place on a phone-sized app
    // screen; its links are reachable from the Profile tab (BottomNavBar) instead. Still shown at
    // md:+ for anyone browsing on a tablet/desktop viewport.
    <footer className="mt-16 hidden bg-primary text-primary-100 md:block">
      <div className="container-app grid grid-cols-2 gap-6 border-b border-primary-700 py-8 sm:grid-cols-4">
        {TRUST_BADGES.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon size={22} className="shrink-0 text-accent" />
            <span className="text-xs sm:text-sm">{label}</span>
          </div>
        ))}
      </div>

      <div className="container-app grid grid-cols-2 gap-8 py-12 md:grid-cols-5">
        <div className="col-span-2">
          <span className="text-xl font-bold text-white">
            Dress<span className="text-accent">Mart</span>
          </span>
          <p className="mt-3 max-w-xs text-sm text-primary-300">
            Premium online shopping for Men's and Kids' wear — curated styles, honest pricing, fast delivery.
          </p>
          <div className="mt-4 flex gap-3">
            {[Facebook, Instagram, Twitter, Youtube].map((Icon, i) => (
              <a key={i} href="#" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-800 hover:bg-primary-700" aria-label="Social link">
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        {FOOTER_LINKS.map((section) => (
          <div key={section.title}>
            <h3 className="mb-3 text-sm font-semibold text-white">{section.title}</h3>
            <ul className="space-y-2">
              {section.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm text-primary-300 hover:text-accent">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-primary-700 py-4">
        <p className="container-app text-center text-xs text-primary-400">© {new Date().getFullYear()} DressMart. All rights reserved.</p>
      </div>
    </footer>
  );
}
