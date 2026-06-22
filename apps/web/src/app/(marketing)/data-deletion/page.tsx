export const metadata = { title: "Data Deletion — TradieJet" };

export default function DataDeletionPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 prose-sm">
      <h1 className="text-3xl font-bold">Data Deletion Request</h1>
      <p className="text-sm text-gray-500 mt-1">Last updated: June 2026</p>

      <p className="mt-6 text-gray-700">
        TradieJet respects your right to have your personal data deleted. This page explains how to request
        deletion of the data we hold, including any information obtained through connected services such as
        Facebook/Meta (e.g. lead-ad data and Page connections).
      </p>

      <h2 className="text-xl font-semibold mt-8">How to request deletion</h2>
      <p className="mt-2 text-gray-700">You can request deletion of your data in either of these ways:</p>
      <ul className="mt-2 text-gray-700 list-disc pl-6 space-y-1.5">
        <li>
          <strong>Email us</strong> at{" "}
          <a href="mailto:info@tradiejet.com" className="text-brand-600 underline">info@tradiejet.com</a>{" "}
          from the email address on your account, with the subject line <em>&ldquo;Data Deletion Request&rdquo;</em>.
          Tell us your business name so we can locate your account.
        </li>
        <li>
          <strong>If you connected your Facebook/Instagram Page</strong>, you can also remove TradieJet from your
          Facebook settings (<em>Settings &amp; privacy → Settings → Business integrations</em>). Removing the app
          revokes our access, and the associated data is deleted as described below.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8">What we delete</h2>
      <ul className="mt-2 text-gray-700 list-disc pl-6 space-y-1.5">
        <li>Your account profile and login credentials.</li>
        <li>Data obtained from connected platforms (e.g. Meta lead-ad submissions and Page access tokens).</li>
        <li>Leads, customers, quotes, jobs and invoices stored in your account.</li>
      </ul>
      <p className="mt-2 text-gray-700">
        Some records may be retained where required by law (for example, tax and accounting records) or to resolve
        disputes; these are deleted once the legal retention period ends.
      </p>

      <h2 className="text-xl font-semibold mt-8">Timeframe</h2>
      <p className="mt-2 text-gray-700">
        We action verified deletion requests within <strong>30 days</strong> and confirm by email once complete.
      </p>

      <h2 className="text-xl font-semibold mt-8">Contact</h2>
      <p className="mt-2 text-gray-700">
        Questions about data deletion or privacy? Email{" "}
        <a href="mailto:info@tradiejet.com" className="text-brand-600 underline">info@tradiejet.com</a>.
        See also our <a href="/privacy" className="text-brand-600 underline">Privacy Policy</a>.
      </p>
    </article>
  );
}
