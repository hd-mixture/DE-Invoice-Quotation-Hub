import React from 'react';

export const metadata = {
  title: 'Privacy Policy | Darshan Enterprises',
  description: 'Privacy Policy for Darshan Enterprises Invoice & Quotation Hub',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: August 2026</p>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Welcome to the Darshan Enterprises Invoice & Quotation Hub. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we handle your data when you use our application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="mb-2">We collect and process the following information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Google Account Information:</strong> When you log in, we receive your email address and basic profile information from Google.</li>
              <li><strong>Google Drive Data:</strong> With your explicit permission, our application accesses your Google Drive solely for the purpose of creating and syncing backup files of your invoices and quotations.</li>
              <li><strong>Business Data:</strong> Invoice and quotation details entered into the system.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p className="mb-2">We use your information exclusively to provide our services:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>To authenticate you securely using Firebase and Google.</li>
              <li>To generate PDF invoices and quotations.</li>
              <li>To sync your business data safely to <strong>your own Google Drive</strong>. We do not store your private business data on our own servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Sharing and Security</h2>
            <p>
              We do not sell, trade, or otherwise transfer your personally identifiable information or business data to outside parties. Your data is synced directly between your browser and your Google Drive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your Consent</h2>
            <p>
              By using our application, you consent to our privacy policy and the necessary scopes required for Google Drive synchronization.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contact Us</h2>
            <p>
              If there are any questions regarding this privacy policy, you may contact us using the information provided on our main website.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
