export const privacyPolicyHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Privacy Policy - Stealth Byte</title>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #F7F7F7;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 800px;
      margin: 50px auto;
      background-color: #FFFFFF;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1, h2 {
      color: #333333;
    }
    p {
      font-size: 16px;
      line-height: 1.6;
      color: #555555;
    }
    ul {
      margin-left: 20px;
    }
    .footer {
      text-align: center;
      margin-top: 50px;
      font-size: 14px;
      color: #999999;
    }
    .footer a {
      color: #999999;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Privacy Policy</h1>
    <p>Last updated: ${new Date().toLocaleDateString()}</p>

    <h2>1. Introduction</h2>
    <p>
      This Privacy Policy describes how we collect, use, and disclose information when you use our Stealth Byte.
      By using the service, you agree to the collection and use of information in accordance with this policy.
    </p>

    <h2>2. Information We Collect</h2>
    <p>We collect the following types of information:</p>
    <ul>
      <li>
        <strong>User Data:</strong> When you use our service, we store your email address to authenticate and manage your account.
      </li>
      <li>
        <strong>Email Tracking Data:</strong> We collect information related to the emails you send using our service, including:
        <ul>
          <li>Recipient email addresses and names</li>
          <li>Email subject lines</li>
          <li>Timestamps of when emails are sent and opened</li>
          <li>Number of times an email is opened</li>
        </ul>
      </li>
    </ul>

    <h2>3. How We Use Your Information</h2>
    <p>Your information is used solely for the purpose of providing and improving the Stealth Byte:</p>
    <ul>
      <li>To track when your emails are opened and notify you accordingly</li>
      <li>To manage your account and usage limits (e.g., rate limiting to prevent abuse)</li>
      <li>To maintain and improve the functionality of the service</li>
    </ul>

    <h2>4. Data Storage and Security</h2>
    <p>
      We take reasonable measures to protect your information from unauthorized access, alteration, or disclosure.
      Your data is stored securely on our servers and is not shared with third parties except as required by law.
    </p>

    <h2>5. Data Retention</h2>
    <p>
      Email tracking data is retained for a period of 60 days, after which it is automatically deleted.
      User account data is retained as long as you continue to use the service.
    </p>

    <h2>6. Your Choices</h2>
    <p>
      You may choose to stop using the service at any time. If you wish to have your data deleted, please contact us, and we will promptly remove your information from our records.
    </p>

    <h2>7. Changes to This Privacy Policy</h2>
    <p>
      We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
      You are advised to review this Privacy Policy periodically for any changes.
    </p>

    <h2>8. Contact Us</h2>
    <p>
      If you have any questions about this Privacy Policy, please contact us at <a href="mailto:aditbala@berkley.edu">aditbala@berkley.edu</a>.
    </p>
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} Stealth Byte | <a href="/">Home</a>
  </div>
</body>
</html>
`;
