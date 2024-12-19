chrome.runtime.sendMessage({message: "fetch_user_data"}, function(response) {
  if (response.error) {
    console.error('Error:', response.error);
    document.body.innerHTML = '<p>Error loading data. Please try again later.</p>';
  } else {
    displayUserInfo(response.userData);
    displayEmails(response.userEmails);
  }
});

function displayUserInfo(userData) {
  const userInfoDiv = document.getElementById('user-info');
  userInfoDiv.innerHTML = `
    <p>Email: ${userData.email}</p>
    <p>Emails sent this month: ${userData.emailsSentThisMonth}</p>
  `;
}

function displayEmails(emails) {
  const emailListDiv = document.getElementById('email-list');
  emails.forEach(email => {
    const emailDiv = document.createElement('div');
    emailDiv.className = 'email-item';
    emailDiv.innerHTML = `
      <div class="email-subject">${email.subject}</div>
      <div class="email-opens">Opened: ${email.numberOfOpens} times</div>
      <div>Sent: ${new Date(Number(email.dateAtTimeOfSend)).toLocaleString()}</div>
    `;
    emailListDiv.appendChild(emailDiv);
  });
}