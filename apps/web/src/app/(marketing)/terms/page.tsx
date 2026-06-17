export const metadata = { title: "Terms of Service — LeadFlow Pro" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-sm text-gray-500 mt-1">Last updated: June 2026</p>

      <p className="mt-6 text-gray-700 text-sm">
        These Terms govern your use of <strong>LeadFlow Pro</strong>. By creating an account or using the service, you
        agree to them.
      </p>

      <Section title="1. The service">
        LeadFlow Pro provides software for lead capture, customer management, quoting, invoicing, payments, and
        communication automation. We may update or improve features over time.
      </Section>
      <Section title="2. Accounts">
        You must provide accurate information, keep your login secure, and are responsible for activity under your
        account. You must be authorised to act for the business you register.
      </Section>
      <Section title="3. Subscriptions &amp; billing">
        Paid plans are billed monthly in advance via Stripe. A free trial may be offered. Fees are non-refundable
        except where required by law. You can cancel anytime; access continues until the end of the paid period.
        Prices may change with reasonable notice.
      </Section>
      <Section title="4. Your data &amp; acceptable use">
        You retain ownership of the data you put into LeadFlow. You grant us a licence to process it to provide the
        service. You must have the right to use any contact data you upload, must comply with anti-spam and privacy
        laws when sending messages, and must not use the service for unlawful, abusive, or harmful purposes.
      </Section>
      <Section title="5. Third-party integrations">
        Connecting services like Stripe, Xero, MYOB, Google, or Meta is subject to their terms. We are not
        responsible for third-party services or their availability.
      </Section>
      <Section title="6. Intellectual property">
        We own the LeadFlow Pro software and brand. You may not copy, resell, or reverse-engineer the platform except
        as permitted by law.
      </Section>
      <Section title="7. Availability &amp; disclaimers">
        We aim for high availability but do not guarantee uninterrupted service. The service is provided
        &ldquo;as is&rdquo; to the extent permitted by law. Nothing in these Terms excludes rights you have under the
        Australian Consumer Law or NZ Consumer Guarantees Act that cannot be excluded.
      </Section>
      <Section title="8. Limitation of liability">
        To the maximum extent permitted by law, our liability is limited to the fees you paid in the 12 months before
        the claim. We are not liable for indirect or consequential loss.
      </Section>
      <Section title="9. Termination">
        You may cancel anytime. We may suspend or terminate accounts that breach these Terms. On termination you can
        request an export of your data within a reasonable period.
      </Section>
      <Section title="10. Governing law">
        These Terms are governed by the laws of Australia / New Zealand (the jurisdiction of your registered
        business). Disputes are subject to the courts of that jurisdiction.
      </Section>
      <Section title="11. Contact">
        Questions: <strong>support@leadflowpro.com</strong>.
      </Section>

      <p className="mt-8 text-xs text-gray-400">
        This document is a general template and not legal advice. Have it reviewed by a qualified lawyer before
        relying on it, and replace contact/entity/jurisdiction details with your registered business.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-gray-700 text-sm leading-relaxed">{children}</p>
    </section>
  );
}
