export const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <title>Email Opened Notification</title>
  <meta charset="UTF-8">
  <style type="text/css">
    /* Inline CSS styles for email compatibility */
    body {
      margin: 0;
      padding: 0;
      background-color: #F2F2F2;
      font-family: Arial, sans-serif;
      color: #000000;
    }
    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #FFFFFF;
      padding: 20px;
    }
    .content h1 {
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 30px;
    }
    .info {
      margin-bottom: 12px;
    }
    .info span {
      display: inline-block;
      font-size: 16px;
      line-height: 24px;
    }
    .info .label {
      font-weight: 700;
      width: 100px;
    }
    .info .value {
      font-weight: 400;
      color: #000000;
    }
    .divider {
      border-top: 1px solid #CFD0D0;
      margin: 30px 0;
    }
    .actions a {
      display: block;
      width: 100%;
      text-align: center;
      color: #FFFFFF;
      background-color: #007BFF;
      font-size: 18px;
      font-weight: bold;
      text-decoration: none;
      padding: 15px 0;
      border-radius: 5px;
    }
    /* Timeline styles */
    .timeline {
      position: relative;
      margin: 20px 0;
      padding-left: 40px;
    }
    .timeline::before {
      content: '';
      position: absolute;
      left: 20px;
      top: 0;
      bottom: 0;
      width: 2px;
      background-color: #007BFF;
    }
    .event {
      position: relative;
      margin-bottom: 30px;
    }
    .event:last-child {
      margin-bottom: 0;
    }
    .event::before {
      content: '';
      position: absolute;
      left: 12px;
      top: 0;
      width: 16px;
      height: 16px;
      background-color: #FFF;
      border: 2px solid #007BFF;
      border-radius: 50%;
    }
    .event .label {
      font-weight: bold;
      font-size: 16px;
    }
    .event .value {
      font-size: 16px;
    }
    @media only screen and (max-width: 600px) {
      .content h1 {
        font-size: 20px;
      }
      .info .label, .info .value, .event .label, .event .value {
        font-size: 14px;
      }
      .actions a {
        font-size: 16px;
        padding: 12px 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- Content Section -->
    <div class="content">
      <h1>Your email was opened!</h1>

      <!-- Email Information -->
      <div class="info">
        <span class="label">To:</span>
        <span class="value">{{recipient_name}}, <a href="mailto:{{recipient_email}}">{{recipient_email}}</a></span>
      </div>
      <div class="info">
        <span class="label">Subject:</span>
        <span class="value">{{email_subject}}</span>
      </div>
      <div class="info">
        <span class="label">From:</span>
        <span class="value"><a href="mailto:{{sender_email}}">{{sender_email}}</a></span>
      </div>

      <!-- Divider -->
      <div class="divider"></div>

      <!-- Open Details with Timeline Design -->
      <div class="timeline">
        <div class="event">
          <span class="label">Sent on:</span>
          <span class="value">{{sent_date}}</span>
        </div>
        <div class="event">
          <span class="label">Time to open:</span>
          <span class="value">{{time_to_open}}</span>
        </div>
        <div class="event">
          <span class="label">Read on:</span>
          <span class="value">{{read_date}}</span>
        </div>
      </div>

      <!-- Divider -->
      <div class="divider"></div>

      <!-- Actions Section -->
      <div class="actions">
        <a href="{{email_link}}">Open the email on Gmail &gt;</a>
      </div>

    </div>

  </div>
</body>
</html>
`;
