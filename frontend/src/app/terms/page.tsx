import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: May 2025</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-600 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using RegCheck-India (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. Nature of the Platform</h2>
            <p>RegCheck-India is an AI-assisted compliance support tool. It is <strong>not a substitute for qualified regulatory affairs professionals.</strong> All outputs are:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>AI-generated and subject to errors, hallucinations, and omissions.</li>
              <li>Intended for use as a first-pass review aid only.</li>
              <li>Required to be reviewed by a qualified Regulatory Affairs professional before use in any regulatory submission.</li>
              <li>Not to be submitted directly to CDSCO, IEC, or any regulatory authority without professional review and sign-off.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. Permitted Use</h2>
            <p>You may use the Platform for:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Internal compliance review and gap analysis.</li>
              <li>Educational and research purposes.</li>
              <li>Pre-submission document preparation support.</li>
            </ul>
            <p className="mt-2">You may <strong>not</strong> use the Platform for:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Direct regulatory submissions without qualified human review.</li>
              <li>Processing real patient identifiable data without proper authorisation.</li>
              <li>Reverse engineering or commercial resale of Platform outputs.</li>
              <li>Any purpose that violates applicable Indian laws including DPDP Act 2023.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. Disclaimer of Liability</h2>
            <p>RegCheck-India and its founder shall not be liable for:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Regulatory submissions rejected by CDSCO or any authority based on Platform outputs.</li>
              <li>Clinical trial delays, financial losses, or reputational damage arising from reliance on Platform outputs.</li>
              <li>Inaccuracies in AI-generated compliance assessments.</li>
              <li>Data breaches resulting from submission of sensitive data by users against our recommendations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. Intellectual Property</h2>
            <p>The Platform, its codebase, agent architecture, and regulatory knowledge base are the intellectual property of RegCheck-India. You may not copy, distribute, or create derivative works without written permission.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. Demo Access</h2>
            <p>Free demo access is provided as-is with no guarantees of uptime, accuracy, or continued availability. We reserve the right to revoke demo access at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. Governing Law</h2>
            <p>These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in Maharashtra, India.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">8. Contact</h2>
            <p><a href="mailto:rushikeshbork000@gmail.com" className="text-teal-600 hover:underline">rushikeshbork000@gmail.com</a><br/>
            RegCheck-India, Dombivli, Maharashtra, India.</p>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        <Link href="/privacy" className="hover:text-teal-600 mr-4">Privacy Policy</Link>
        <Link href="/" className="hover:text-teal-600">Back to Home</Link>
      </footer>
    </div>
  )
}
