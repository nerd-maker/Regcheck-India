import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 h-16 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">R</span>
          </div>
          <span className="font-bold text-gray-900">RegCheck-India</span>
        </Link>
        <Link href="/app" className="text-sm text-teal-600 hover:underline">Launch App</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: May 2025</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-600 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. Overview</h2>
            <p>RegCheck-India (&quot;we&quot;, &quot;our&quot;, &quot;the platform&quot;) is an AI-powered regulatory compliance tool built for India&apos;s pharmaceutical sector. This Privacy Policy explains how we handle data submitted through our platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Registration data:</strong> Name, email address, organisation name, and role — collected when you register for demo access.</li>
              <li><strong>Document content:</strong> Text and files you submit to our AI agents for processing.</li>
              <li><strong>Usage data:</strong> Module usage frequency, request counts, feedback submissions.</li>
              <li><strong>API keys:</strong> Stored locally in your browser (localStorage) — never transmitted to or stored on our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. How Your Documents Are Processed</h2>
            <p>Documents you submit are processed through the <strong>Anthropic Claude API</strong>. Key data handling facts:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Anthropic does not use API inputs or outputs to train its models.</li>
              <li>Data submitted via API is automatically deleted from Anthropic servers within 30 days per their retention policy.</li>
              <li>We do not store your document content on our servers after processing.</li>
              <li>Meeting audio processed through Sarvam AI is subject to Sarvam AI&apos;s privacy policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. PII and PHI Handling</h2>
            <p>Our M1 PII Anonymiser is designed to detect and mask personal and health information before it is processed. However:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>We strongly recommend anonymising documents before submission to any AI module.</li>
              <li>Do not submit documents containing real patient data, investigator identities, or commercially sensitive formulation details without first running through M1.</li>
              <li>Pseudonymisation mapping files are encrypted and stored temporarily (24 hours) in server memory only.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. DPDP Act 2023 Compliance</h2>
            <p>RegCheck-India is designed with the Digital Personal Data Protection Act 2023 in mind. We collect only the minimum data necessary, provide transparency about processing, and do not sell or share your data with third parties for commercial purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Registration data: Retained for the duration of your access period.</li>
              <li>Document content: Not retained after processing.</li>
              <li>Usage logs: Retained for 30 days for service improvement.</li>
              <li>Feedback submissions: Retained indefinitely for product improvement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. Your Rights</h2>
            <p>You may request deletion of your registration data at any time by emailing <a href="mailto:rushikeshbork000@gmail.com" className="text-teal-600 hover:underline">rushikeshbork000@gmail.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">8. Contact</h2>
            <p>For privacy-related queries: <a href="mailto:rushikeshbork000@gmail.com" className="text-teal-600 hover:underline">rushikeshbork000@gmail.com</a><br/>
            RegCheck-India, Dombivli, Maharashtra, India.</p>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        <Link href="/terms" className="hover:text-teal-600 mr-4">Terms of Service</Link>
        <Link href="/" className="hover:text-teal-600">Back to Home</Link>
      </footer>
    </div>
  )
}
