export const metadata = { title: "Privacy Policy — LeadFlow Pro" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 prose-sm">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mt-1">Last updated: June 2026</p>

      <p className="mt-6 text-gray-700">
        This Privacy Policy explains how <strong>LeadFlow Pro</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses,
        and protects personal information. We comply with the Australian Privacy Act 1988 (and the Australian
        Privacy Principles) and the New Zealand Privacy Act 2020.
      </p>

      <Section title="1. Who we are">
        LeadFlow Pro is a software platform that helps trades and small businesses capture leads, manage customers,
        send quotes and invoices, take payments, and automate communication. For data that a customer
        (&ldquo;the business&rdquo;) loads or generates about <em>their</em> clients, we act as a processor on the
        business&rsquo;s behalf; the business is the data controller.
      </Section>

      <Section title="2. Information we collect">
        <ul>
          <li><strong>Account data:</strong> name, email, phone, business name, ABN/NZBN, password (hashed).</li>
          <li><strong>Business data you enter or import:</strong> your customers&rsquo; names and contact details, leads, quotes, jobs, invoices, and prices.</li>
          <li><strong>Lead data:</strong> details submitted via your website forms or connected ad platforms (Google, Meta).</li>
          <li><strong>Payment data:</strong> processed by Stripe; we do not store full card numbers.</li>
          <li><strong>Usage data:</strong> log data, device/browser info, and basic analytics to operate and improve the service.</li>
        </ul>
      </Section>

      <Section title="3. How we use it">
        To provide and operate the service; send transactional and automated messages on your behalf (e.g. quote/
        invoice/review emails and SMS); process payments; provide support; maintain security; and comply with law.
        We do not sell your personal information.
      </Section>

      <Section title="4. Third-party services">
        We share data only as needed to run the service, with providers such as: <strong>Stripe</strong> (payments),
        <strong>Resend</strong> (email), <strong>Vonage</strong> (SMS), <strong>Xero / MYOB</strong> (accounting sync,
        when you connect them), <strong>Google &amp; Meta</strong> (lead capture, when you connect them), and our cloud
        hosting/infrastructure providers. Each processes data under their own terms.
      </Section>

      <Section title="5. Data storage &amp; security">
        Data is stored on secure cloud infrastructure. We use encryption in transit (HTTPS), encrypt sensitive
        integration tokens at rest, hash passwords, and restrict access. No system is perfectly secure, but we take
        reasonable steps to protect your information.
      </Section>

      <Section title="6. Data retention">
        We retain data for as long as your account is active and as needed to provide the service or meet legal
        obligations. You can request deletion of your account and associated data (subject to legal retention rules).
      </Section>

      <Section title="7. Your rights">
        You may request access to, correction of, or deletion of your personal information, and may withdraw consent
        to optional processing. Contact us using the details below. Businesses using LeadFlow are responsible for
        responding to such requests from their own clients.
      </Section>

      <Section title="8. Cookies">
        We use essential cookies to keep you signed in and operate the service. We do not use them to track you
        across other websites.
      </Section>

      <Section title="9. Changes">
        We may update this policy; material changes will be notified in-app or by email. Continued use after changes
        means you accept the updated policy.
      </Section>

      <Section title="10. Contact">
        Questions or privacy requests: <strong>privacy@leadflowpro.com</strong>.
      </Section>

      <p className="mt-8 text-xs text-gray-400">
        This document is a general template and not legal advice. Have it reviewed by a qualified lawyer in your
        jurisdiction (AU &amp; NZ) before relying on it, and replace contact/entity details with your registered business.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-gray-700 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:mt-1">{children}</div>
    </section>
  );
}
