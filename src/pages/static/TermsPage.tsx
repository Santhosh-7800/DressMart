import { Seo } from '@/components/common/Seo';

const SECTIONS = [
  { title: '1. Acceptance of Terms', body: 'By accessing or using DressMart, you agree to be bound by these Terms & Conditions and our Privacy Policy.' },
  { title: '2. Eligibility', body: 'You must be at least 18 years old, or using DressMart under the supervision of a parent or guardian, to create an account and place orders.' },
  { title: '3. Orders & Pricing', body: 'All prices are listed in INR and inclusive of applicable taxes unless stated otherwise. We reserve the right to cancel any order due to pricing errors, stock unavailability, or suspected fraudulent activity.' },
  { title: '4. Shipping & Delivery', body: 'Estimated delivery timelines are provided at checkout and on the order tracking page. Delays due to logistics partners or unforeseen circumstances are outside our control.' },
  { title: '5. Returns & Refunds', body: 'Eligible items may be returned within 7 days of delivery in original condition. Refunds are processed to the original payment method within 5-7 business days of the returned item being received.' },
  { title: '6. User Conduct', body: 'You agree not to misuse the platform, attempt unauthorized access, or engage in fraudulent transactions.' },
  { title: '7. Intellectual Property', body: 'All content on DressMart, including logos, designs, and product descriptions, is the property of DressMart and may not be reproduced without permission.' },
  { title: '8. Limitation of Liability', body: 'DressMart is not liable for indirect or consequential damages arising from the use of our platform, to the maximum extent permitted by law.' },
  { title: '9. Governing Law', body: 'These terms are governed by the laws of India, with courts in the applicable jurisdiction having exclusive authority over disputes.' },
];

export function TermsPage() {
  return (
    <div className="container-app max-w-3xl py-8">
      <Seo title="Terms & Conditions" description="DressMart's terms and conditions of use." />
      <h1 className="mb-2 text-2xl font-bold">Terms &amp; Conditions</h1>
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
