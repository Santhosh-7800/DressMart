import { Seo } from '@/components/common/Seo';

const SECTIONS = [
  { title: '1. Information We Collect', body: 'We collect information you provide directly, such as your name, email, phone number, shipping addresses, and payment details, as well as information about your usage of DressMart, including browsing history, wishlist activity, and order history.' },
  { title: '2. How We Use Your Information', body: 'We use your information to process orders, personalize your shopping experience, send order updates and promotional communications (which you can opt out of), and improve our platform.' },
  { title: '3. Payment Information', body: 'DressMart never receives or stores your card, UPI, or netbanking details. Online payments are handled entirely by Razorpay’s own secure checkout — we only receive confirmation of whether a payment succeeded, along with an order/payment reference ID. For Cash on Delivery orders, no payment information is collected online at all.' },
  { title: '4. Data Sharing', body: 'We do not sell your personal data. We share information only with logistics partners for delivery, and payment processors for transaction processing, strictly as needed to fulfil your orders.' },
  { title: '5. Cookies', body: 'We use cookies and local storage to remember your preferences, keep you signed in, and understand how you use DressMart to improve our services.' },
  { title: '6. Your Rights', body: 'You may access, update, or request deletion of your personal data at any time from your Profile settings, or by contacting our support team.' },
  { title: '7. Data Security', body: 'We implement industry-standard security measures, including encryption in transit and row-level access controls, to protect your data.' },
  { title: '8. Changes to This Policy', body: 'We may update this Privacy Policy periodically. Continued use of DressMart after changes constitutes acceptance of the revised policy.' },
];

export function PrivacyPolicyPage() {
  return (
    <div className="container-app max-w-3xl py-8">
      <Seo title="Privacy Policy" description="DressMart's privacy policy — how we collect, use, and protect your data." />
      <h1 className="mb-2 hidden text-2xl font-bold md:block">Privacy Policy</h1>
      <p className="mb-8 text-sm text-primary-400">Last updated: January 2026</p>
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="mb-2 font-semibold">{section.title}</h2>
            <p className="text-sm leading-relaxed text-primary-500">{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
