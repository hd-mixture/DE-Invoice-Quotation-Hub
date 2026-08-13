import React from 'react';

export const metadata = {
  title: 'Terms of Service | Darshan Enterprises',
  description: 'Terms of Service for Darshan Enterprises Invoice & Quotation Hub',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: August 2026</p>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using the Darshan Enterprises Invoice & Quotation Hub ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              The Service provides an internal tool for generating, managing, and syncing business invoices and quotations. It is designed specifically for Darshan Enterprises and its authorized personnel.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Users must provide accurate information when generating invoices and quotations.</li>
              <li>Users are responsible for maintaining the confidentiality of their Google account credentials used to access the Service.</li>
              <li>The Service relies on Google Drive for data synchronization. Users must ensure they have sufficient Drive storage and appropriate permissions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Intellectual Property</h2>
            <p>
              The Service, including its original content, features, and functionality, are owned by Darshan Enterprises and are protected by international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Limitation of Liability</h2>
            <p>
              Darshan Enterprises shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service, including but not limited to lost profits or data loss.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Changes to Terms</h2>
            <p>
              We reserve the right to modify or replace these Terms at any time. It is your responsibility to check these Terms periodically for changes.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
