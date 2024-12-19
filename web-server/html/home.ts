export const homePageHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Stealth Byte</title>
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
    h1 {
      text-align: center;
      color: #333333;
    }
    p {
      font-size: 18px;
      line-height: 1.6;
      color: #555555;
    }
    .button {
      display: block;
      width: 200px;
      margin: 30px auto;
      text-align: center;
      padding: 15px;
      background-color: #007BFF;
      color: #FFFFFF;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
    }
    .button:hover {
      background-color: #0056b3;
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
    <h1>Welcome to Stealth Byte</h1>
    <p>
      Stealth Byte allows you to monitor when your emails are opened by recipients.
      With real-time notifications, you can stay informed and engaged with your communication.
    </p>
    <p>
      This service is designed to be simple and efficient, providing you with the insights you need without compromising privacy.
    </p>
    <a href="/privacy-policy" class="button">View Privacy Policy</a>
  </div>
  <div class="footer">
    &copy; ${
  new Date().getFullYear()
} Stealth Byte | <a href="/privacy-policy">Privacy Policy</a>
  </div>
</body>
</html>
`;
